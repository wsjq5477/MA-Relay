'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const prefix = 'custom-runtime:';
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

function resolveExecutable(program, environment) {
  const folders = path.isAbsolute(program) ? [''] : (environment.PATH || '').split(path.delimiter).filter(folder => path.isAbsolute(folder));
  if (!program || !path.isAbsolute(program) && /[\\/]/.test(program))
    throw invalid('请选择绝对路径或 PATH 中的程序名。');
  const suffixes = process.platform === 'win32' && !path.extname(program) ? ['.exe'] : [''];
  for (const folder of folders) {
    for (const suffix of suffixes) {
      try {
        const file = fs.realpathSync(folder ? path.join(folder, program + suffix) : program + suffix);
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
    return JSON.parse(fs.readFileSync(path.join(this.directory, id + '.json'), 'utf8'));
  }
  list() {
    if (!fs.existsSync(this.directory)) return [];
    return fs.readdirSync(this.directory).filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).map(name => {
      const executable = prefix + name.slice(0, -5);
      const profile = this.read(executable);
      let healthy = false;
      try { healthy = resolveExecutable(profile.program, this.environment) === profile.program; } catch { /* Installation is unavailable. */ }
      return { executable, adapter: 'hermes', name: profile.name, version: profile.version, healthy,
        ...(!healthy ? { error: '自定义运行时的原程序不可用。' } : {}) };
    });
  }
  async create({ adapter, name, command, description = '', profileId }) {
    if (adapter !== 'hermes' || typeof name !== 'string' || !name.trim() || name.length > 80 ||
        typeof description !== 'string' || description.length > 500 || typeof profileId !== 'string' || !/^[a-f0-9-]{36}$/.test(profileId))
      throw invalid('请选择 Hermes，并填写有效的显示名称和描述。');
    const [programName, ...args] = parseCommand(command);
    if (args.some(arg => /^(?:--(?:query(?:-file)?|format|resume|model|provider)(?:=|$)|--$|chat$)/.test(arg)))
      throw invalid('命令包含由 Hermes 适配器管理的参数。');
    const program = resolveExecutable(programName, this.environment);
    const profile = { name: name.trim(), description: description.trim(), program, args };
    const executable = prefix + profileId;
    const same = previous => JSON.stringify({ ...previous, version: undefined }) === JSON.stringify(profile);
    const file = path.join(this.directory, profileId + '.json');
    if (fs.existsSync(file)) {
      if (!same(this.read(executable))) throw invalid('此创建请求已经使用不同配置保存。');
      return { executable };
    }
    const launch = require('./tool-discovery.cjs').command(program, [...args, '--version'], this.environment);
    let version;
    try {
      const { stdout, stderr } = await promisify(execFile)(launch.executable, launch.args,
        { env: launch.env, cwd: path.dirname(program), timeout: 5000, windowsHide: true, maxBuffer: 65536 });
      version = /\b\d+\.\d+(?:\.\d+)?\b/.exec(stdout + stderr)?.[0];
      if (!version) throw new Error();
    } catch {
      throw invalid('程序未通过版本探测，请确认固定参数后可运行 --version。');
    }
    fs.mkdirSync(this.directory, { recursive: true });
    const temp = path.join(this.directory, randomUUID() + '.tmp');
    try {
      fs.writeFileSync(temp, JSON.stringify({ ...profile, version }), { mode: 0o600, flag: 'wx' });
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
