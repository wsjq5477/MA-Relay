const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { createHash, randomUUID } = require('node:crypto');
const { problem } = require('./ssh-known-hosts.cjs');

// Observer failures are diagnostic only; never reinterpret them as SFTP faults.
function progressFailure(error,progress={}){
  const causeCode=['EPERM','EACCES','EBUSY','ENOSPC','EDQUOT'].includes(error?.code)?error.code:'LOCAL_PROGRESS_FAILED';
  return {code:'SSH_PROGRESS_WARNING',causeCode,phase:progress.phase||'uploading',completedBytes:progress.completedBytes||0,totalBytes:progress.totalBytes||0,message:'进度显示更新失败（'+causeCode+'），上传继续；发送维护前仍须保存本地台账。'};
}
function quote(value) {
  if (typeof value !== 'string' || !value || /[\0\r\n]/.test(value)) throw problem('INVALID_INPUT', '远端受控路径包含不支持的字符。');
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
function remoteExec(client, command, input = '', options = {}) {
  return new Promise((resolve, reject) => {
    let channel, settled = false, out = [], errorBytes = 0, size = 0;
    const fail = error => { if (settled) return; settled = true; clearTimeout(timer); channel?.close(); reject(error); };
    const timer = setTimeout(() => fail(problem('SSH_COMMAND_TIMEOUT', 'SSH 环境检测或安装步骤超时，请检查服务器。')), options.timeoutMs || 15000);
    client.exec(command, { pty: false }, (error, stream) => {
      if (error) return fail(problem('SSH_EXEC_FAILED', '服务器拒绝了无终端的后台命令' + (Number.isSafeInteger(error.reason) ? '（通道原因码 ' + error.reason + '）' : '') + '，请检查 SSH 权限。', { stage: 'open' }));
      channel = stream;
      stream.on('data', chunk => { size += chunk.length; if (size > (options.maxBytes || 65536)) return fail(problem('SSH_BOOTSTRAP_OUTPUT', '服务器启动脚本输出过多，无法安全解析后台检测结果。')); out.push(chunk); });
      stream.stderr.on('data', chunk => { errorBytes += chunk.length; if (errorBytes > 65536) fail(problem('SSH_BOOTSTRAP_OUTPUT', '服务器后台命令诊断输出过多，请检查启动脚本。')); });
      stream.on('error', () => fail(problem('SSH_EXEC_FAILED', 'SSH 后台命令通道已中断。', { stage: 'stream' })));
      stream.on('close', code => { if (settled) return; settled = true; clearTimeout(timer); if (code !== 0) reject(problem(options.errorCode || 'SSH_EXEC_FAILED', options.errorMessage || ('远端后台命令执行失败（退出码 ' + (code === null || code === undefined ? '未知' : code) + '），请检查运行条件。'), { stage: 'exit' })); else resolve(Buffer.concat(out).toString('utf8')); });
      stream.end(input);
    });
  });
}
const probeScript = `set -eu
ab_home=$(cd "$HOME" && pwd -P)
ab_node=''
ab_version=''
for ab_candidate in /usr/bin/node /usr/local/bin/node "$HOME/.local/bin/node" "$HOME/.nvm/versions/node"/*/bin/node "$HOME/.local/share/fnm/node-versions"/*/installation/bin/node "$HOME/.fnm/node-versions"/*/installation/bin/node; do
  if [ -x "$ab_candidate" ]; then
    ab_candidate_version=$("$ab_candidate" -p 'process.versions.node' 2>/dev/null || true)
    case "$ab_candidate_version" in [0-9]*.[0-9]*.[0-9]*) ab_node=$ab_candidate; ab_version=$ab_candidate_version;; esac
    if "$ab_candidate" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' >/dev/null 2>&1; then break; fi
  fi
done
printf '%s\\n' 'AGENTBRIDGE_PROBE_V2' "$(uname -s)" "$(uname -m)" "$(id -u)" "$(id -un)" "$ab_home" "$(getconf GNU_LIBC_VERSION 2>/dev/null || true)" "$(df -Pk "$ab_home" | awk 'END {print $4}')" "$ab_node" "$ab_version" "\${XDG_STATE_HOME:-}" 'END_AGENTBRIDGE_PROBE'
`;
function sufficientNode(version) { const parts = String(version || '').replace(/^v/, '').split('.').map(Number); return parts[0] > 22 || (parts[0] === 22 && parts[1] >= 13); }
function validateManifest(manifest) {
  if (manifest.protocolVersion !== 2 || manifest.platform !== 'linux' || manifest.arch !== 'x64' || !/^[a-zA-Z0-9.-]{1,80}$/.test(manifest.version) || !Array.isArray(manifest.files) || !manifest.files.length) throw problem('SSH_PACKAGE_INVALID', 'Linux 后台发布清单无效。');
  const seen = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || !/^[a-zA-Z0-9_@.+/-]+$/.test(file.path) || file.path.startsWith('/') || file.path.split('/').some(part => !part || part === '.' || part === '..') || seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) throw problem('SSH_PACKAGE_INVALID', 'Linux 发布清单含不安全或重复路径。');
    seen.add(file.path);
  }
  if (!manifest.runtime || !seen.has(manifest.runtime.path) || !sufficientNode(manifest.runtime.version)) throw problem('SSH_PACKAGE_INVALID', 'Linux 发布包缺少可用的私有 Node 运行时。');
  if (manifest.compatibleDaemons !== undefined) {
    if (!Array.isArray(manifest.compatibleDaemons) || manifest.compatibleDaemons.length > 32) throw problem('SSH_PACKAGE_INVALID', '兼容后台清单索引无效。');
    const versions = new Set();
    for (const pin of manifest.compatibleDaemons) {
      if (!pin || !/^[a-zA-Z0-9.-]{1,80}$/.test(pin.version) || versions.has(pin.version) || pin.manifestPath !== 'compatible-daemons/' + pin.version + '.json' || !seen.has(pin.manifestPath) || !/^[a-f0-9]{64}$/.test(pin.manifestDigest)) throw problem('SSH_PACKAGE_INVALID', '兼容后台清单索引含不安全路径或重复版本。');
      versions.add(pin.version);
    }
  }
}
function localManifest(directory) {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')); } catch { throw problem('SSH_PACKAGE_UNAVAILABLE', '客户端缺少 Linux 后台离线包，请使用包含 I06A 资源的客户端。'); }
  validateManifest(manifest);
  for (const file of manifest.files) {
    const target = path.join(directory, ...file.path.split('/')); let stat;
    try { stat = fs.lstatSync(target); } catch { throw problem('SSH_PACKAGE_INVALID', 'Linux 发布包文件缺失。'); }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.size || createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== file.sha256) throw problem('SSH_PACKAGE_CHECKSUM', 'Linux 发布包本机摘要校验失败，停止安装。');
  }
  const digest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  return { manifest, digest };
}
function sftpCall(sftp, method, ...args) { return new Promise((resolve, reject) => sftp[method](...args, (error, result) => error ? reject(error) : resolve(result))); }
function sftpOpen(client) { return new Promise((resolve, reject) => client.sftp((error, sftp) => error ? reject(problem('SSH_SFTP_UNAVAILABLE', '服务器未启用 SFTP，无法安装后台。')) : resolve(sftp))); }
function missing(error) { return error?.code === 2 || error?.code === 'ENOENT'; }
async function lstat(sftp, target) { try { return await sftpCall(sftp, 'lstat', target); } catch (error) { if (missing(error)) return null; throw error; } }
async function existingPrivateDirectory(sftp, target, home, uid) {
  if (target !== home && !target.startsWith(home + '/')) throw problem('REMOTE_DIRECTORY_UNSAFE', '兼容后台路径必须位于已认证用户的 HOME 中。');
  const targets = [home];let current = home;
  for (const component of target.slice(home.length).split('/').filter(Boolean)) { current += '/' + component;targets.push(current); }
  for (const entry of targets) {
    const stat = await lstat(sftp, entry);
    if (!stat?.isDirectory() || stat.isSymbolicLink() || stat.uid !== uid) throw problem('REMOTE_DIRECTORY_UNSAFE', '兼容后台路径缺失、包含符号链接或属于其他用户。');
  }
}
async function privateDirectory(sftp, target, home, uid) {
  if (target !== home && !target.startsWith(home + '/')) throw problem('REMOTE_DIRECTORY_UNSAFE', '自动安装目录必须位于已认证用户的真实 HOME 中。');
  let current = home;
  const root = await lstat(sftp, home);
  if (!root || !root.isDirectory() || root.isSymbolicLink() || root.uid !== uid) throw problem('REMOTE_DIRECTORY_UNSAFE', '远端 HOME 的类型或拥有者不符合当前 SSH 用户。');
  for (const component of target.slice(home.length).split('/').filter(Boolean)) {
    current += '/' + component; const stat = await lstat(sftp, current);
    if (!stat) { await sftpCall(sftp, 'mkdir', current, { mode: 0o700 }); continue; }
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== uid) throw problem('REMOTE_DIRECTORY_UNSAFE', '远端安装目录包含符号链接或属于其他用户，停止安装。');
  }
  await sftpCall(sftp, 'chmod', target, 0o700);
}
async function readJson(sftp, target) {
  const stat = await lstat(sftp, target); if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) throw problem('REMOTE_DIRECTORY_UNSAFE', '远端安装标记文件类型或大小不正确。');
  const output = await new Promise((resolve, reject) => {
    const stream = sftp.createReadStream(target); const chunks = []; let size = 0;
    stream.on('data', chunk => { size += chunk.length; if (size > 1048576) { stream.destroy(); reject(problem('REMOTE_DIRECTORY_UNSAFE', '安装标记文件过大。')); } else chunks.push(chunk); });
    stream.on('error', reject); stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
  try { return JSON.parse(output); } catch { throw problem('REMOTE_DIRECTORY_UNSAFE', '已有远端目录没有有效的 Bridge 安装标记。'); }
}
async function writeRemote(sftp, target, data, mode = 0o600) {
  await new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(target, { flags: 'wx', mode }); stream.on('error', reject); stream.on('close', resolve); stream.end(data);
  });
}
/** Pack the manifest's regular files into one reproducible ustar+gzip archive.
 * One stream replaces thousands of per-file round trips on high-latency links. */
async function packArchive(manifest, directory) {
  const digest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const cache = path.join(os.tmpdir(), 'agentbridge-package-' + digest.slice(0, 24) + '.tgz');
  const sidecar = cache + '.json';
  try {
    const saved = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
    if (saved.digest === digest && fs.statSync(cache).size === saved.size) return { archive: cache, sha256: saved.sha256, size: saved.size, cached: true };
  } catch { /* Rebuild below; a partial cache entry is never trusted. */ }
  const stage = cache + '.' + randomUUID() + '.tmp';
  const gzip = zlib.createGzip({ level: 6 });
  const hash = createHash('sha256');
  let size = 0;
  const output = fs.createWriteStream(stage, { mode: 0o600 });
  const write = chunk => new Promise((resolve, reject) => gzip.write(chunk, error => error ? reject(error) : resolve()));
  gzip.on('data', chunk => { size += chunk.length; hash.update(chunk); });
  gzip.on('error', () => {});
  const finished = new Promise((resolve, reject) => { output.on('error', reject); output.on('close', resolve); });
  gzip.pipe(output);
  const header = file => {
    if (file.path.length > 100) throw problem('SSH_PACKAGE_INVALID', '发布包路径超出离线归档格式限制。');
    const block = Buffer.alloc(512);
    block.write(file.path, 0, 100, 'ascii');
    block.write((file.path === manifest.runtime.path ? 0o700 : (file.mode || 0o600)).toString(8).padStart(7, '0') + '\0', 100);
    block.write('0000000\0', 108); block.write('0000000\0', 116); // uid/gid 0: ownership comes from the extracting user.
    block.write(file.size.toString(8).padStart(11, '0') + '\0', 124);
    block.write('00000000000\0', 136); // mtime 0 keeps the archive reproducible.
    block.write('        ', 148); // checksum placeholder of spaces
    block.write('0', 156); block.write('ustar\0', 257); block.write('00', 263);
    let sum = 0; for (const byte of block) sum += byte;
    block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    return block;
  };
  try {
    for (const file of manifest.files) {
      await write(header(file));
      const source = path.join(directory, ...file.path.split('/'));
      const input = fs.createReadStream(source, { highWaterMark: 1 << 20 });
      await new Promise((resolve, reject) => {
        input.on('data', chunk => gzip.write(chunk, error => error ? reject(error) : void 0));
        input.on('error', reject); input.on('end', resolve);
      });
      if (file.size % 512) await write(Buffer.alloc(512 - (file.size % 512)));
    }
    await write(Buffer.alloc(1024));
    gzip.end();
    await finished;
    if (output.bytesWritten !== size) throw new Error('archive stream incomplete');
    const sha256 = hash.digest('hex');
    fs.writeFileSync(sidecar, JSON.stringify({ digest, size, sha256 }), { mode: 0o600 });
    fs.renameSync(stage, cache);
    return { archive: cache, sha256, size, cached: false };
  } catch (error) {
    gzip.destroy(); output.destroy();
    fs.rmSync(stage, { force: true }); fs.rmSync(sidecar, { force: true });
    throw error.code ? error : problem('SSH_PACKAGE_UNAVAILABLE', '本地构建 Linux 离线安装包失败：' + (error.message || ''));
  }
}
function verifyScript(finalPath, manifest) {
  return `const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const root=${JSON.stringify(finalPath)},manifest=${JSON.stringify(manifest)};for(const file of manifest.files){const target=path.join(root,file.path),stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid()||stat.size!==file.size||crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==file.sha256)throw new Error('CHECKSUM');}process.stdout.write(JSON.stringify({verified:true}));`;
}
function hashScript(archivePath, expected) {
  return `const fs=require('node:fs'),crypto=require('node:crypto');const h=crypto.createHash('sha256');const input=fs.createReadStream(${JSON.stringify(archivePath)});input.on('data',c=>h.update(c));input.on('error',()=>process.exit(3));input.on('end',()=>{const d=h.digest('hex');if(d!==${JSON.stringify(expected)}){process.stderr.write('MISMATCH');process.exit(4);}process.stdout.write(JSON.stringify({verified:true,size:fs.statSync(${JSON.stringify(archivePath)}).size}));});`;
}
/** Pipelined SFTP writer: many outstanding WRITE packets instead of one per
 * round trip, so a single archive can fill a long fat network. */
async function uploadArchive(sftp, source, target, onProgress = () => {}, options = {}) {
  const descriptor = fs.openSync(source, 'r'), size = fs.fstatSync(descriptor).size;
  const CHUNK = 32768, WINDOW = 24;
  // A buffer belongs to its WRITE until its callback, including ssh2's split
  // writes. A later ACK must not recycle an earlier outstanding buffer.
  const buffers = Array.from({ length: WINDOW }, () => Buffer.allocUnsafe(CHUNK));
  let progressWarning;
  let handle, position = 0, inFlight = 0, completedBytes = 0, settled = false, closing = false, pumping = false, timer;
  const failure = (error, step) => {
    const reason = error?.code === 3 || error?.code === 'EACCES' || error?.code === 'EPERM' ? '服务器拒绝写入，请检查登录用户的目录权限'
      : error?.code === 'ENOSPC' || error?.code === 'EDQUOT' ? '远端磁盘空间或用户配额不足'
      : error?.code === 4 ? '服务器返回 SFTP Failure，请检查磁盘空间、用户配额与 SFTP 写入限制'
      : error?.code === 'UPLOAD_IDLE' ? '服务器长时间未确认数据，请检查网络与 SFTP 服务'
      : error?.code === 7 || error?.code === 'CHANNEL_CLOSED' || ['ECONNRESET','EPIPE','ENOTCONN'].includes(error?.code) ? 'SSH/SFTP 通道已关闭，请检查网络与服务器连接限制'
      : '服务器未能完成 SFTP 写入，请检查网络、目录权限和存储';
    const code = typeof error?.code === 'number' && Number.isSafeInteger(error.code) ? `（SFTP ${error.code}）` : '';
    return Object.assign(problem('SSH_UPLOAD_FAILED', `安装包上传失败：${reason}${code}。阶段：${step}；已确认 ${completedBytes} / ${size} 字节。未解包或激活后台，请重新检测后安装。`),{details:{stage:step,causeCode:typeof error?.code==='number'?error.code:['EPERM','EACCES','EBUSY','ENOSPC','EDQUOT','ECONNRESET','EPIPE','ENOTCONN','UPLOAD_IDLE','CHANNEL_CLOSED'].includes(error?.code)?error.code:'SFTP_FAILED',completedBytes,totalBytes:size,extracted:false,remoteInputSent:false}});
  };
  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => {clearTimeout(timer); sftp.removeListener('error', onError); sftp.removeListener('close', onClose); sftp.removeListener('end', onClose);};
      const fail = (error, step = '写入数据') => {
        if (settled) return;
        settled = true; cleanup();
        if (handle && !closing) {try {sftp.close(handle, () => {});} catch {/* The transport may already be gone. */}}
        reject(error?.code === 'SSH_PACKAGE_UNAVAILABLE' ? error : failure(error, step));
      };
      const touch = () => {clearTimeout(timer); timer = setTimeout(() => fail({code:'UPLOAD_IDLE'}, closing ? '关闭上传文件' : handle ? '写入数据' : '打开上传文件'), options.idleTimeoutMs || 60000);};
      const onError = error => fail(error);
      const onClose = () => fail({code:'CHANNEL_CLOSED'});
      sftp.on('error', onError); sftp.on('close', onClose); sftp.on('end', onClose);
      const finish = () => {
        if (settled || closing || position < size || inFlight) return;
        closing = true; touch();
        try {sftp.close(handle, error => {
          if (settled) return;
          if (error) return fail(error, '关闭上传文件');
          settled = true; cleanup(); resolve();
        });} catch (error) {fail(error, '关闭上传文件');}
      };
      const pump = () => {
        if (pumping || settled) return;
        pumping = true;
        try {
          while (!settled && buffers.length && position < size) {
            const length = Math.min(CHUNK, size - position), at = position, buffer = buffers.pop();
            let bytesRead;
            try {bytesRead = fs.readSync(descriptor, buffer, 0, length, at);} catch {throw problem('SSH_PACKAGE_UNAVAILABLE', '本地安装包读取失败。');}
            if (bytesRead !== length) throw problem('SSH_PACKAGE_UNAVAILABLE', '本地安装包读取不完整。');
            position += length; inFlight++;
            sftp.write(handle, buffer, 0, bytesRead, at, error => {
              if (settled) return;
              if (error) return fail(error);
              inFlight--; completedBytes += bytesRead; buffers.push(buffer); touch();
              try {onProgress({completedBytes, totalBytes:size});} catch (error) {progressWarning=progressFailure(error,{completedBytes,totalBytes:size});}
              pump(); finish();
            });
          }
          finish();
        } catch (error) {fail(error);}
        finally {pumping = false;}
      };
      touch();
      try {sftp.open(target, 'w', 0o600, (error, opened) => {
        if (settled) {if (opened) {try {sftp.close(opened, () => {});} catch {}} return;}
        if (error) return fail(error, '打开上传文件');
        handle = opened; touch(); pump();
      });} catch (error) {fail(error, '打开上传文件');}
    });
    return {size,...(progressWarning?{progressWarning}:{})};
  } finally {fs.closeSync(descriptor);}
}
class SshInstaller {
  constructor(options) { this.options = options; this.profileId = createHash('sha256').update(options.coordinatorId + '\0' + path.resolve(options.directory)).digest('hex').slice(0, 24); }
  bundle() { return localManifest(this.options.packageDirectory); }
  release(version, bundle = this.bundle()) {
    if (!version || version === bundle.manifest.version) return bundle;
    const pin = bundle.manifest.compatibleDaemons?.find(row => row.version === version);
    if (!pin || !bundle.manifest.files.some(file => file.path === pin.manifestPath) || !/^[a-f0-9]{64}$/.test(pin.manifestDigest)) throw problem('SSH_DAEMON_UPGRADE_REQUIRED', '远端后台版本未列入本客户端已验证的兼容范围；保留原后台，请使用对应客户端。');
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(path.join(this.options.packageDirectory, pin.manifestPath), 'utf8')); } catch { throw problem('SSH_PACKAGE_INVALID', '客户端缺少兼容后台的校验清单。'); }
    validateManifest(manifest);
    const digest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
    if (manifest.version !== version || digest !== pin.manifestDigest) throw problem('SSH_PACKAGE_CHECKSUM', '兼容后台清单摘要或版本不符，连接已停止。');
    return { manifest, digest };
  }
  async probe(client, sharedSftp = null) {
    const output = await remoteExec(client, '/bin/sh -s', probeScript);
    const lines = output.replace(/\n$/, '').split('\n');
    if (lines.length !== 12 || lines[0] !== 'AGENTBRIDGE_PROBE_V2' || lines.at(-1) !== 'END_AGENTBRIDGE_PROBE') throw problem('SSH_BOOTSTRAP_OUTPUT', '非交互 SSH 启动脚本输出污染了检测结果，请移除后台登录时的欢迎文本。');
    const [, platform, architecture, uidText, username, home, libc, disk, nodePath, nodeVersion, xdgStateHome] = lines;
    if (platform !== 'Linux' || architecture !== 'x86_64') throw problem('SSH_PLATFORM_UNSUPPORTED', 'I06A 自动安装目前支持 Linux x86_64；此机器的平台或架构尚不支持。');
    const libcVersion = libc.match(/^glibc (\d+)\.(\d+)$/);
    if (!libcVersion || Number(libcVersion[1]) < 2 || (Number(libcVersion[1]) === 2 && Number(libcVersion[2]) < 28)) throw problem('SSH_LIBC_UNSUPPORTED', '此 Linux 需要 glibc 2.28 或更新版本；当前环境不支持发布的 Node 运行时。');
    const uid = Number(uidText), diskAvailable = Number(disk) * 1024;
    if (!Number.isSafeInteger(uid) || uid < 0 || !Number.isSafeInteger(diskAvailable) || !home.startsWith('/') || /[\0\r\n]/.test(home) || home === '/') throw problem('SSH_PROBE_INVALID', '远端用户目录或检测数据无效，停止安装。');
    const bundle = this.bundle();
    const installPath = path.posix.join(home, '.local/share/agentbridge/profiles', this.profileId);
    const stateDirectory = path.posix.join(xdgStateHome || path.posix.join(home, '.local/state'), 'agentbridge/profiles', this.profileId);
    // A shared session halves the channels a maintenance preview opens; a
    // session-budget-limited sshd must not reject the preview's own reads.
    const shared = !!sharedSftp, sftp = shared ? sharedSftp : await sftpOpen(client);
    let marker, current;
    try {
      const stat = await lstat(sftp, installPath);
      if (stat) {
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== uid) throw problem('REMOTE_DIRECTORY_UNSAFE', '已有安装路径属于其他用户或是符号链接。');
        marker = await readJson(sftp, path.posix.join(installPath, 'install.json'));
        if (!marker || marker.kind !== 'agentbridge-install' || marker.ownerCoordinatorId !== this.options.coordinatorId || marker.profileId !== this.profileId) throw problem('REMOTE_DIRECTORY_UNSAFE', '目标目录已被非本 Bridge 安装占用，停止安装。');
        current = await readJson(sftp, path.posix.join(installPath, 'current.json'));
      }
    } finally { if (!shared) sftp.end(); }
    const { manifest, digest } = this.release(current?.version, bundle);
    const versionPath = path.posix.join(installPath, 'versions', manifest.version);
    if (current && (current.digest !== digest || current.versionPath !== versionPath)) throw problem('SSH_VERSION_CONFLICT', '已安装后台的版本路径或摘要与可信发布清单不符，保留旧目录并停止连接。');
    const installNeeded = !(current?.version === manifest.version && current?.digest === digest && current?.versionPath === versionPath);
    const totalBytes = manifest.files.reduce((sum, file) => sum + file.size, 0);
    if (installNeeded && diskAvailable < totalBytes * 2 + 32 * 1024 * 1024) throw problem('SSH_DISK_SPACE', '远端可用空间不足，请释放用户目录空间后再连接。');
    const probe = { home, platform: 'linux', arch: 'x64', uid, username, glibcVersion: libcVersion[1] + '.' + libcVersion[2], nodePath, nodeVersion, runtimeNeeded: !sufficientNode(nodeVersion), installNeeded, installPath, stateDirectory, versionPath, diskAvailable, packageBytes: totalBytes, daemonVersion: manifest.version, clientDaemonVersion: bundle.manifest.version, reuseCompatible: manifest.version !== bundle.manifest.version, protocolVersion: 2, profileId: this.profileId, manifestDigest: digest };
    // Free space fluctuates with ordinary use; it is checked separately at
    // install time and must not invalidate the summary a user confirmed.
    const { diskAvailable: _, ...stable } = probe;
    probe.previewId = createHash('sha256').update(JSON.stringify(stable)).digest('hex');
    probe.summary = probe.reuseCompatible ? `复用已验证兼容的 Linux 后台 ${manifest.version}，保留任务与历史，不替换运行中的后台。` : `Linux 后台 ${manifest.version}，用户目录安装，不需要 sudo。${probe.runtimeNeeded ? '使用 Bridge 私有 Node，不修改系统环境。' : '使用已安装的 Node。'}`;
    return probe;
  }
  async maintenancePreview(client){
    const sftp=await sftpOpen(client);let probe,previous;
    try{
      probe=await this.probe(client,sftp);
      previous=await readJson(sftp,path.posix.join(probe.installPath,'previous.json'));
    }finally{sftp.end();}
    let rollbackVersion;
    if(previous){const release=this.release(previous.version);if(previous.digest!==release.digest||previous.versionPath!==path.posix.join(probe.installPath,'versions',previous.version))throw problem('SSH_VERSION_CONFLICT','旧版本回退路径或摘要不可验证。');rollbackVersion=previous.version;}
    return {...probe,targetVersion:this.bundle().manifest.version,rollbackVersion};
  }
  async stageMaintenance(client,probe,operationId,onProgress){
    const bundle=this.bundle(),target={...probe,daemonVersion:bundle.manifest.version,manifestDigest:bundle.digest,versionPath:path.posix.join(probe.installPath,'versions',bundle.manifest.version),installNeeded:true};
    const staged=await this.install(client,target,operationId,onProgress,{deferActivation:true});
    const controller=path.posix.join(probe.stateDirectory,'maintenance-runtime',bundle.digest);
    const script=`const fs=require('node:fs'),path=require('node:path');const source=${JSON.stringify(target.versionPath)},target=${JSON.stringify(controller)},uid=${probe.uid};let current='/';for(const part of target.split('/').filter(Boolean)){current=path.join(current,part);if(!fs.existsSync(current))fs.mkdirSync(current,{mode:0o700});const s=fs.lstatSync(current);if(s.isSymbolicLink()||!s.isDirectory())throw Error('unsafe');if(current.startsWith(${JSON.stringify(probe.stateDirectory)})&&(s.uid!==uid||(s.mode&0o077)))throw Error('owner');}const files=['package.json','runtime/node','runtime/owned-stop','desktop/electron/remote-maintenance.cjs','desktop/electron/machine-daemon.cjs','desktop/electron/machine-protocol.cjs','desktop/electron/runtime-capabilities.cjs'];for(const file of files){const dst=path.join(target,file);fs.mkdirSync(path.dirname(dst),{recursive:true,mode:0o700});let component=target;for(const part of path.dirname(file).split('/').filter(x=>x!=='.')){component=path.join(component,part);const stat=fs.lstatSync(component);if(stat.isSymbolicLink()||!stat.isDirectory()||stat.uid!==uid)throw Error('unsafe');}if(fs.existsSync(dst)){const stat=fs.lstatSync(dst);if(stat.isSymbolicLink()||!stat.isFile()||stat.uid!==uid)throw Error('unsafe');}const tmp=dst+'.tmp-'+process.pid;fs.writeFileSync(tmp,fs.readFileSync(path.join(source,file)),{flag:'wx',mode:file.startsWith('runtime/')?0o700:0o600});fs.renameSync(tmp,dst);}process.stdout.write('ready');`;
    await remoteExec(client,quote(path.posix.join(target.versionPath,'runtime/node'))+' -',script,{timeoutMs:60000,errorCode:'DAEMON_MAINTENANCE_STAGE',errorMessage:'维护运行资源暂存失败，原版本保留。'});
    return {directory:controller,release:{version:bundle.manifest.version,digest:bundle.digest,manifest:bundle.manifest},...(staged.progressWarning?{progressWarning:staged.progressWarning}:{})};
  }
  async remoteMaintenance(client,input,controller){
    const node=path.posix.join(controller,'runtime/node'),entry=path.posix.join(controller,'desktop/electron/remote-maintenance.cjs');
    const raw=await remoteExec(client,quote(node)+' '+quote(entry),JSON.stringify(input),{timeoutMs:60000,errorCode:'DAEMON_MAINTENANCE_TRANSPORT',errorMessage:'维护回应尚未确认，请查询原操作。'});
    try{return JSON.parse(raw);}catch{throw problem('DAEMON_PROTOCOL','维护收据无法读取，请查询原操作。');}
  }
  async install(client, probe, operationId, onProgress = () => {}, options = {}) {
    const bundle = this.bundle();
    const { manifest, digest } = this.release(probe.daemonVersion, bundle);
    const reuseCompatible = manifest.version !== bundle.manifest.version;
    if (probe.manifestDigest !== digest) throw problem('INSTALL_PREVIEW_CHANGED', '安装包已变化，请重新检测并确认安装摘要。');
    const sftp = await sftpOpen(client);
    let versionPath = probe.versionPath,ownedArchive,progressWarning;
    const notify=progress=>{try{onProgress(progress);}catch(error){progressWarning=progressFailure(error,progress);}};
    try {
      if (reuseCompatible) {
        if (probe.installNeeded || versionPath !== path.posix.join(probe.installPath, 'versions', manifest.version)) throw problem('INSTALL_PREVIEW_CHANGED', '兼容复用摘要已变化，请重新检测。');
        for (const directory of [probe.installPath, versionPath, probe.stateDirectory]) await existingPrivateDirectory(sftp, directory, probe.home, probe.uid);
        const marker = await readJson(sftp, path.posix.join(probe.installPath, 'install.json'));
        const current = await readJson(sftp, path.posix.join(probe.installPath, 'current.json'));
        const release = await readJson(sftp, path.posix.join(versionPath, '.bridge-release.json'));
        if (marker?.kind !== 'agentbridge-install' || marker.ownerCoordinatorId !== this.options.coordinatorId || marker.profileId !== this.profileId || release?.ownerCoordinatorId !== this.options.coordinatorId) throw problem('REMOTE_DIRECTORY_UNSAFE', '兼容后台不属于当前中央或 profile。');
        if (current?.version !== manifest.version || current.digest !== digest || current.versionPath !== versionPath || release.digest !== digest) throw problem('INSTALL_PREVIEW_CHANGED', '已安装后台在检测后发生变化，保留原后台并重新检测。');
        const runtime = path.posix.join(versionPath, manifest.runtime.path);
        if (!sufficientNode(probe.nodeVersion)) {
          const sha = await remoteExec(client, 'sha256sum ' + quote(runtime), '', { errorCode: 'SSH_PACKAGE_CHECKSUM', errorMessage: '兼容后台私有 Node 校验失败。' });
          if (sha.trim().split(/\s+/)[0] !== manifest.files.find(file => file.path === manifest.runtime.path).sha256) throw problem('SSH_PACKAGE_CHECKSUM', '兼容后台私有 Node 摘要不符。');
        }
        const node = sufficientNode(probe.nodeVersion) ? probe.nodePath : runtime;
        await remoteExec(client, quote(node) + ' -', verifyScript(versionPath, manifest), { timeoutMs: 60000, errorCode: 'SSH_PACKAGE_CHECKSUM', errorMessage: '兼容后台逐文件校验失败，连接已停止。' });
        return { node, versionPath, stateDirectory: probe.stateDirectory, profileId: this.profileId, version: manifest.version };
      }
      await privateDirectory(sftp, probe.installPath, probe.home, probe.uid);
      let marker = await readJson(sftp, path.posix.join(probe.installPath, 'install.json'));
      if (!marker) {
        const existing = (await sftpCall(sftp, 'readdir', probe.installPath)).filter(item => item.filename !== '.' && item.filename !== '..');
        if (existing.length) throw problem('REMOTE_DIRECTORY_UNSAFE', '目标目录已有非 Bridge 内容，不能覆盖。');
        marker = { kind: 'agentbridge-install', ownerCoordinatorId: this.options.coordinatorId, profileId: this.profileId, createdAt: new Date().toISOString() };
        await writeRemote(sftp, path.posix.join(probe.installPath, 'install.json'), JSON.stringify(marker));
      }
      if (marker.kind !== 'agentbridge-install' || marker.ownerCoordinatorId !== this.options.coordinatorId || marker.profileId !== this.profileId) throw problem('REMOTE_DIRECTORY_UNSAFE', '远端安装标记与当前中央后台不符。');
      await privateDirectory(sftp, probe.stateDirectory, probe.home, probe.uid);
      await privateDirectory(sftp, path.posix.join(probe.installPath, 'versions'), probe.home, probe.uid);
      if (probe.installNeeded) {
        const finalStat = await lstat(sftp, versionPath);
        if (finalStat) {
          if (!finalStat.isDirectory() || finalStat.isSymbolicLink() || finalStat.uid !== probe.uid) throw problem('REMOTE_DIRECTORY_UNSAFE', '已有版本路径的拥有者或类型不正确。');
          const finalMarker = await readJson(sftp, path.posix.join(versionPath, '.bridge-release.json'));
          if (finalMarker?.digest !== digest || finalMarker?.ownerCoordinatorId !== this.options.coordinatorId) throw problem('SSH_VERSION_CONFLICT', '同名版本目录内容不一致，停止安装并保留已有文件。');
        } else {
          // One compressed archive replaces per-file uploads: a high-latency
          // link pays one round trip per file otherwise.
          const bundle = await packArchive(manifest, this.options.packageDirectory);
          const stage = path.posix.join(probe.installPath, '.staging-' + createHash('sha256').update(operationId).digest('hex').slice(0, 16) + '-' + randomUUID().slice(0, 8));
          await privateDirectory(sftp, stage, probe.home, probe.uid);
          await writeRemote(sftp, path.posix.join(stage, '.bridge-release.json'), JSON.stringify({ ownerCoordinatorId: this.options.coordinatorId, operationId, digest, version: manifest.version }));
          const remoteArchive = ownedArchive = path.posix.join(probe.installPath, '.upload-' + createHash('sha256').update(operationId).digest('hex').slice(0,16) + '-' + randomUUID().slice(0, 8) + '.tgz');
          notify({ phase: 'uploading', completedBytes: 0, totalBytes: bundle.size });
          const upload=await uploadArchive(sftp, bundle.archive, remoteArchive, progress => notify({ ...progress, phase: 'uploading' }));progressWarning ||= upload.progressWarning;
          notify({ phase: 'extracting', completedBytes: bundle.size, totalBytes: bundle.size });
          await remoteExec(client, 'tar -xzf ' + quote(remoteArchive) + ' -C ' + quote(stage), '', { timeoutMs: 240000, errorCode: 'SSH_PACKAGE_EXTRACT', errorMessage: '远端解压安装包失败，未激活安装。' });
          try { await sftpCall(sftp, 'unlink', remoteArchive);ownedArchive=undefined; } catch { /* A leftover upload is inert staging garbage. */ }
          const runtime = path.posix.join(stage, manifest.runtime.path);
          // The runtime hash is verified remotely before anything executes it;
          // the per-file check below re-confirms the whole tree afterwards.
          const runtimeSha = await remoteExec(client, 'sha256sum ' + quote(runtime), '', { timeoutMs: 60000, errorCode: 'SSH_PACKAGE_CHECKSUM', errorMessage: '远端私有 Node 摘要校验失败，未激活安装。' });
          if (runtimeSha.trim().split(/\s+/)[0] !== manifest.files.find(file => file.path === manifest.runtime.path).sha256) throw problem('SSH_PACKAGE_CHECKSUM', '远端私有 Node 摘要校验失败，未激活安装。');
          const node = sufficientNode(probe.nodeVersion) ? probe.nodePath : runtime;
          notify({ phase: 'verifying', completedBytes: bundle.size, totalBytes: bundle.size });
          await remoteExec(client, quote(node) + ' -', verifyScript(stage, manifest), { timeoutMs: 120000, errorCode: 'SSH_PACKAGE_CHECKSUM', errorMessage: '远端发布包摘要校验失败，未激活安装。' });
          await sftpCall(sftp, 'rename', stage, versionPath);
        }
        if(!options.deferActivation){
        const currentTemp = path.posix.join(probe.installPath, '.current-' + randomUUID() + '.json');
        await writeRemote(sftp, currentTemp, JSON.stringify({ version: manifest.version, digest, versionPath }));
        await sftpCall(sftp, 'rename', currentTemp, path.posix.join(probe.installPath, 'current.json'));
        }
      }
      const node = sufficientNode(probe.nodeVersion) ? probe.nodePath : path.posix.join(versionPath, manifest.runtime.path);
      await remoteExec(client, quote(node) + ' -', verifyScript(versionPath, manifest), { timeoutMs: 60000, errorCode: 'SSH_PACKAGE_CHECKSUM', errorMessage: '已安装后台的文件校验失败，连接已停止。' });
      return { node, versionPath, stateDirectory: probe.stateDirectory, profileId: this.profileId, version: manifest.version,...(progressWarning?{progressWarning}:{}) };
    } finally {
      if(ownedArchive)try{const stat=await lstat(sftp,ownedArchive);if(stat?.isFile()&&!stat.isSymbolicLink()&&stat.uid===probe.uid)await sftpCall(sftp,'unlink',ownedArchive);}catch{/* Only this operation's generated archive is eligible; leave inaccessible files intact. */}
      sftp.end();
    }
  }
}
module.exports = { SshInstaller, quote, remoteExec, probeScript, sufficientNode, localManifest, privateDirectory, verifyScript, hashScript, packArchive, uploadArchive, sftpCall, progressFailure };
