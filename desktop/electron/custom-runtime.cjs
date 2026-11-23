'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const prefix = 'custom-runtime:';
const adapters = new Set(['hermes', 'pi', 'acp']);
const reservedArguments = {
  acp: /^--(?:resume|continue|session(?:-id|-dir)?|no-session|model|provider|api-key)(?:=|$)/,
  hermes: /^(?:--(?:query(?:-file)?|format|resume|model|provider)(?:=|$)|--$|chat$)/,
  pi: /^(?:--(?:mode|print|session(?:-dir)?|continue|resume|no-session|model|provider|api-key|help|version|export|list-models)(?:=|$)|-[pcrhv](?:.*)$|--$)/,
};
const isCustomRuntime = identity => typeof identity === 'string' && identity.startsWith(prefix);
const invalid = message => Object.assign(new Error(message), { code: 'CUSTOM_RUNTIME_INVALID' });

function parseCommand(command) {
  if (typeof command !== 'string' || command.length > 4096 || /[\0\r\n|&;<>`$%]/.test(command))
    throw invalid('请输入程序和固定参数，命令不支持 shell 运算符或变量。');
  const tokens = command.trim().match(/"[^"]*"|'[^']*'|[^\s"']+/g) || [];
  if (!tokens.length || !/^(?:(?:"[^"]*"|'[^']*'|[^\s"']+)(?:\s+|$))+$/.test(command.trim()))
    throw invalid('请填写命令，并用引号包住包含空格的路径或参数。');
  return tokens.map(token => /^["']/.test(token) ? token.slice(1, -1) : token);
}

// npm's Windows launchers point to a package's declared bin. Resolve that
// entry directly so ACP never needs a shell to run an installed Node CLI.
function windowsNpmEntry(shim) {
  if (fs.statSync(shim).size > 4096) return null;
  const batch = fs.readFileSync(shim, 'utf8');
  const match = /^(?:"%_prog%" +)?"%dp0%\\((?:node_modules\\|[.][.]\\)[^"%\r\n]+)" +%\*\s*$/im
    .exec(batch.trimEnd().split(/\r?\n/).at(-1).split(' & ').at(-1));
  if (!match || (batch.includes('"%_prog%"') && !/^ SET "_prog=node"$/im.test(batch))) return null;
  const folder = path.dirname(shim);
  const modules = path.basename(folder).toLowerCase() === '.bin' ? path.dirname(folder) : path.join(folder, 'node_modules');
  if (path.basename(modules).toLowerCase() !== 'node_modules') return null;
  const entry = path.resolve(folder, match[1]);
  const relative = path.relative(modules, entry);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  const parts = relative.split(path.sep);
  const root = path.join(modules, ...parts.slice(0, parts[0].startsWith('@') ? 2 : 1));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const name = path.basename(shim, '.cmd').toLowerCase();
  const bin = typeof manifest.bin === 'string' && String(manifest.name).split('/').at(-1).toLowerCase() === name
    ? manifest.bin : manifest.bin?.[name];
  return typeof bin === 'string' && path.resolve(root, bin).toLowerCase() === entry.toLowerCase() ? entry : null;
}

function resolveExecutable(program, environment, adapter) {
  const folders = path.isAbsolute(program) ? [''] : (environment.PATH || '').split(path.delimiter).filter(folder => path.isAbsolute(folder));
  if (!program || !path.isAbsolute(program) && /[\\/]/.test(program))
    throw invalid('请选择绝对路径或 PATH 中的程序名。');
  const windows = process.platform === 'win32';
  const suffixes = windows && !path.extname(program) ? adapter === 'acp' ? ['.exe', '.cmd'] : ['.exe'] : [''];
  for (const folder of folders) {
    for (const suffix of suffixes) {
      try {
        const candidate = folder ? path.join(folder, program + suffix) : program + suffix;
        const entry = windows && adapter === 'acp' && /\.cmd$/i.test(candidate) ? windowsNpmEntry(candidate) : candidate;
        if (!entry) continue;
        const file = fs.realpathSync(entry);
        if (process.platform === 'win32' && !/\.(exe|[cm]?js)$/i.test(file)) continue;
        if (!fs.statSync(file).isFile()) continue;
        if (!/\.[cm]?js$/i.test(file)) fs.accessSync(file, fs.constants.X_OK);
        return file;
      } catch { /* Try the next absolute PATH entry. */ }
    }
  }
  throw invalid('找不到可直接启动的程序，请检查路径或使用绝对路径。');
}

class CustomRuntimeStore {
  constructor(directory, environment = process.env) {
    this.directory = path.join(directory, 'custom-runtimes');
    this.environment = environment;
  }
  read(identity) {
    const id = isCustomRuntime(identity) ? identity.slice(prefix.length) : '';
    if (!/^[a-f0-9-]{36}$/.test(id)) return null;
    const profile = JSON.parse(fs.readFileSync(path.join(this.directory, id + '.json'), 'utf8'));
    return { ...profile, adapter: profile.adapter || 'hermes' };
  }
  list() {
    if (!fs.existsSync(this.directory)) return [];
    return fs.readdirSync(this.directory).filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).map(name => {
      const executable = prefix + name.slice(0, -5);
      const profile = this.read(executable);
      let healthy = false;
      try { healthy = resolveExecutable(profile.program, this.environment) === profile.program; } catch { /* Installation is unavailable. */ }
      return { executable, adapter: profile.adapter, name: profile.name, version: profile.version, healthy,
        ...(profile.adapter === 'acp' ? { acpResume: profile.acpResume === true } : {}),
        ...(!healthy ? { error: '自定义运行时的原程序不可用。' } : {}) };
    });
  }
  async create({ adapter, name, command, description = '', profileId }) {
    if (!adapters.has(adapter) || typeof name !== 'string' || !name.trim() || name.length > 80 ||
        typeof description !== 'string' || description.length > 500 || typeof profileId !== 'string' || !/^[a-f0-9-]{36}$/.test(profileId))
      throw invalid('请选择支持的协议，并填写有效的显示名称和描述。');
    const [programName, ...args] = parseCommand(command);
    if (args.some(arg => reservedArguments[adapter]?.test(arg)))
      throw invalid('命令包含由所选适配器管理的协议、会话或模型参数。');
    const program = resolveExecutable(programName, this.environment, adapter);
    const profile = { adapter, name: name.trim(), description: description.trim(), program, args };
    const executable = prefix + profileId;
    const same = previous => previous.adapter === adapter && ['name', 'description', 'program', 'args'].every(key => JSON.stringify(previous[key]) === JSON.stringify(profile[key]));
    const file = path.join(this.directory, profileId + '.json');
    if (fs.existsSync(file)) {
      if (!same(this.read(executable))) throw invalid('此创建请求已经使用不同配置保存。');
      return { executable };
    }
    const commandFor = require('./tool-discovery.cjs').command;
    let observation;
    if (adapter === 'acp') {
      try {
        const cwd = path.dirname(this.directory);
        fs.mkdirSync(cwd, {recursive:true});
        const result = await require('./acp-worker.cjs').probe(commandFor(program, args, this.environment), cwd);
        observation = {version:result.version, acpResume:result.resume};
      } catch {
        throw invalid('程序未通过 ACP v1 握手，请核对目标机器上的 ACP 命令与依赖。');
      }
    } else {
      const launch = commandFor(program, [...args, '--version'], this.environment);
      try {
        const { stdout, stderr } = await promisify(execFile)(launch.executable, launch.args,
          { env: launch.env, cwd: path.dirname(program), timeout: 5000, windowsHide: true, maxBuffer: 65536 });
        const version = /\b\d+\.\d+(?:\.\d+)?\b/.exec(stdout + stderr)?.[0];
        if (!version) throw new Error();
        observation = {version};
      } catch {
        throw invalid('程序未通过版本探测，请确认固定参数后可运行 --version。');
      }
    }
    fs.mkdirSync(this.directory, { recursive: true });
    const temp = path.join(this.directory, randomUUID() + '.tmp');
    try {
      fs.writeFileSync(temp, JSON.stringify({ ...profile, ...observation }), { mode: 0o600, flag: 'wx' });
      try { fs.linkSync(temp, file); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (!same(this.read(executable))) throw invalid('此创建请求已经使用不同配置保存。');
      }
    } finally { fs.rmSync(temp, { force: true }); }
    return { executable };
  }
}

module.exports = { CustomRuntimeStore, parseCommand, isCustomRuntime };
