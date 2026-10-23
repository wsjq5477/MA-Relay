const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createHash, randomUUID} = require('node:crypto');
const fail = (code, message) => Object.assign(new Error(message), {code});
const surfaces = new Set(['dsh-desktop', 'dsh-web']);
const root = options => path.join(options.home || os.homedir(), '.agentbridge', 'dsh-connections');
function address(value) {
  let url;
  try { url = new URL(value); } catch { throw fail('INVALID_INPUT', '请输入 DSH 的完整连接地址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.pathname !== '/' || [...url.searchParams.keys()].some(k => k !== 'token') || url.searchParams.getAll('token').length > 1
    || (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))
    throw fail('INVALID_INPUT', 'DSH 地址需要根路径；HTTP 仅连接目标机器的本机地址，其他地址请使用 HTTPS。');
  return {origin: url.origin, token: url.searchParams.get('token') || ''};
}
function read(file) {
  try {
    const row = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!surfaces.has(row.adapter) || address(row.origin).origin !== row.origin || typeof row.token !== 'string' || !row.token || /[\r\n]/.test(row.token)) throw Error();
    return row;
  } catch { throw fail('DSH_CONFIG', 'DSH 连接配置不可用，请在机器与 Agent 中打开该 DSH 的配置，核对原连接。'); }
}
function status(options = {}) {
  const directory = root(options);
  if (!fs.existsSync(directory)) return {items: []};
  return {items: fs.readdirSync(directory).filter(n => /^(dsh-desktop|dsh-web)-[a-f0-9]{32}\.json$/.test(n)).map(n => {
    const file = path.join(directory, n);
    try { const row = read(file); return {adapter: row.adapter, origin: row.origin, enabled: row.enabled !== false, executable: file, connectionId: n.slice(0,-5)}; }
    catch { return {adapter: n.startsWith('dsh-desktop-') ? 'dsh-desktop' : 'dsh-web', origin: '', enabled: true, executable: file, connectionId: n.slice(0,-5), error: 'DSH 连接配置损坏，请保留原文件并核对。'}; }
  })};
}
function configure(options, params) {
  if (!surfaces.has(params.adapter)) throw fail('INVALID_INPUT', '请选择 DSH Desktop 或 DSH Web。');
  const {origin, token: fromUrl} = address(params.url), token = params.token || fromUrl;
  const directory = root(options), key = createHash('sha256').update(params.adapter + ':' + origin).digest('hex').slice(0, 32), file = path.join(directory, params.adapter + '-' + key + '.json');
  const previous = fs.existsSync(file) ? read(file) : null;
  const secret = token || previous?.token;
  if (typeof secret !== 'string' || !secret || secret.length > 8192 || /[\r\n]/.test(secret)) throw fail('INVALID_INPUT', '请填写 DSH 启动地址中的连接 token。');
  if (params.enabled !== undefined && typeof params.enabled !== 'boolean') throw fail('INVALID_INPUT', '连接状态无效。');
  require('./private-directory.cjs').ensurePrivateDirectory(directory);
  require('./graph-layout.cjs').atomicWrite(file, {adapter: params.adapter, origin, token: secret, enabled: params.enabled !== false});
  return {...status(options), selectedConnectionId: params.adapter + '-' + key};
}
async function client(file, expectedOrigin) {
  const row = read(file);
  if (expectedOrigin && row.origin !== expectedOrigin) throw fail('DSH_CONFIG', 'DSH 原连接地址发生变化，原请求未重发。');
  const url = new URL('/', row.origin); url.searchParams.set('token', row.token);
  let response;
  try { response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(5000)}); }
  catch { throw fail('DSH_OFFLINE', '无法连接 DSH，请核对目标机器上的原生服务。'); }
  const cookies = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  await response.body?.cancel();
  if (response.status === 403) throw fail('DSH_ACCESS', 'DSH 拒绝浏览器访问；请在 DSH Desktop 原生设置中开启浏览器访问后重试。');
  if (![302, 303].includes(response.status) || !cookies) throw fail('DSH_AUTH', 'DSH 连接认证失败，请打开该 DSH 的配置，更新原启动地址的 token。');
  async function rpc(method, args) {
    const rpcId = randomUUID();
    // Typert transports named method parameters, rather than flattening the
    // Session request fields into args. list names its parameter _request;
    // all other supported Session methods name it request.
    const parameters = method === 'session/list' ? {_request: args} : {request: args};
    let reply;
    try { reply = await fetch(new URL('/api/' + method, row.origin), {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: {'content-type': 'application/json', cookie: cookies, origin: row.origin}, body: JSON.stringify({type: 'client-request', rpcId, method, payload: {args: parameters}})}); }
    catch { throw fail('DSH_TRANSPORT', 'DSH 请求回应未知，请核对原请求，不要重新提交。'); }
    if (!reply.ok) { await reply.body?.cancel(); throw fail('DSH_HTTP', 'DSH 接口返回 HTTP ' + reply.status + '，请核对原请求。'); }
    const size = Number(reply.headers.get('content-length'));
    if (size > 4 * 1024 * 1024) { await reply.body?.cancel(); throw fail('DSH_PROTOCOL', 'DSH 回应超过 4 MiB。'); }
    const chunks = []; let bytes = 0;
    for await (const chunk of reply.body) { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) throw fail('DSH_PROTOCOL', 'DSH 回应超过 4 MiB。'); chunks.push(Buffer.from(chunk)); }
    let envelope;
    try { envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('DSH_PROTOCOL', 'DSH 回应不是有效 JSON。'); }
    if (envelope?.type !== 'server-response' || envelope.rpcId !== rpcId || typeof envelope.result?.ok !== 'boolean') throw fail('DSH_PROTOCOL', 'DSH 回应身份或协议不匹配。');
    if (!envelope.result.ok) throw fail('DSH_REJECTED', 'DSH 原生接口拒绝了 ' + method + '；请在原生界面核对配置或等待。');
    return envelope.result.value;
  }
  return {rpc, origin: row.origin};
}
async function discover(options = {}) {
  const configured = status(options).items;
  const result = await Promise.all(configured.filter(row => row.enabled).map(async row => {
    const base = {adapter: row.adapter, name: row.adapter === 'dsh-desktop' ? 'DSH Desktop' : 'DSH Web', executable: row.executable};
    try { const c = await client(row.executable); const value = await c.rpc('session/list', {}); if (!Array.isArray(value?.items)) throw fail('DSH_PROTOCOL', 'DSH 会话接口不兼容。'); return {...base, healthy: true, version: 'web-api-v1'}; }
    catch (error) { return {...base, healthy: false, error: error.message}; }
  }));
  // Desktop does not have to install a CLI command. Report its real app
  // installation without starting Electron or treating installation as login.
  const env = options.environment || process.env;
  if ((options.platform || process.platform) === 'linux' && !configured.some(row => row.adapter === 'dsh-web')) {
    const manifest = path.join(env.DSH_HOME || path.join(options.home || os.homedir(), '.dsh'), 'profiles/web/package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (pkg.name === 'dsh-profile-web') result.push({adapter:'dsh-web', name:'DSH Web', executable:manifest,
        healthy:false, errorCode:'DSH_CONNECTION_REQUIRED', error:'已安装 DSH Web profile；请先运行原生 Web 服务，再在机器与 Agent 的本机器 DSH Web 行点击“配置”，保存服务地址和连接 token，然后重新扫描。'});
    } catch { /* A profile is only an installation hint, never a service URL or credential source. */ }
  }
  if ((options.platform || process.platform) === 'win32' && !configured.some(row => row.adapter === 'dsh-desktop')) {
    const local = env.LOCALAPPDATA || path.join(options.home || os.homedir(), 'AppData/Local');
    for (const name of ['DSH Desktop', 'DeepSeek Harness']) {
      const directory = path.join(local, 'Programs', name), executable = path.join(directory, name + '.exe');
      const manifest = path.join(directory, 'resources/app/package.json');
      try {
        if (!fs.statSync(executable).isFile()) continue;
        const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (!['dsh-plugin-desktop', '@deepseek-ai/dsh-desktop'].includes(pkg.name)) continue;
        result.push({adapter:'dsh-desktop', name:'DSH Desktop', executable, version:pkg.version, healthy:false, errorCode:'DSH_CONNECTION_REQUIRED', error:'已安装 DSH Desktop；请在机器与 Agent 的 DSH Desktop 行点击“配置”，保存服务地址和连接 token，再重新扫描。'}); break;
      } catch { /* Other native installation layouts require explicit connection. */ }
    }
  }
  return result;
}
module.exports = {surfaces, address, read, status, configure, client, discover};
