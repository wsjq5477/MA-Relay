import { readFileSync, realpathSync, statSync, existsSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, lstatSync } from 'node:fs';
import { dirname, delimiter, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { OpenCodeConfig } from './config.js';
import { BridgeError } from './core.js';

export interface ProcessIdentity { pid: number; startTicks: string; bootId: string; executable: string; command: string[]; workspace: string; uid: number }
export interface NativeIdentity extends ProcessIdentity { version: 1; configuredExecutable: string; serverUrl: string; passwordFile: string; credentialHash: string }
export const identityPath = (config: OpenCodeConfig) => config.passwordFile + '.process.json';
export function processIdentity(pid: number): ProcessIdentity | undefined {
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new BridgeError('NATIVE_OWNERSHIP', '托管进程身份不合法', 409);
  try {
    const base = '/proc/' + pid; const fields = readFileSync(base + '/stat', 'utf8').split(') ').slice(1).join(') ').trim().split(/\s+/);
    if (fields[0] === 'Z' || fields[0] === 'X') return undefined;
    return { pid, startTicks: fields[19]!, bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), executable: realpathSync(base + '/exe'),
      command: readFileSync(base + '/cmdline', 'utf8').split('\0').filter(Boolean), workspace: realpathSync(base + '/cwd'), uid: statSync(base).uid };
  } catch { if (!existsSync('/proc/' + pid)) return undefined; throw new BridgeError('NATIVE_OWNERSHIP', '无法核验存活进程归属，请检查服务身份，不能接管或停止', 409); }
}
export function sameBirth(expected: ProcessIdentity): boolean {
  const actual = processIdentity(expected.pid);
  return !!actual && actual.startTicks === expected.startTicks && actual.bootId === expected.bootId && actual.uid === expected.uid;
}
export function sameProcess(expected: ProcessIdentity): boolean {
  const actual = processIdentity(expected.pid);
  return !!actual && JSON.stringify(actual) === JSON.stringify({ pid: expected.pid, startTicks: expected.startTicks, bootId: expected.bootId,
    executable: expected.executable, command: expected.command, workspace: expected.workspace, uid: expected.uid });
}
export function credentialHash(file: string): string { return createHash('sha256').update(readFileSync(file, 'utf8').trim()).digest('hex'); }
export function readNativeIdentity(config: OpenCodeConfig): NativeIdentity | undefined {
  const path = identityPath(config); if (!existsSync(path)) return undefined;
  try {
    const st = lstatSync(path);
    if (!st.isFile() || st.uid !== process.getuid?.() || (st.mode & 0o077) !== 0) throw new Error();
    const data = JSON.parse(readFileSync(path, 'utf8')) as NativeIdentity;
    if (data.version !== 1 || !Number.isSafeInteger(data.pid) || !data.startTicks || !data.bootId || !Array.isArray(data.command) || typeof data.credentialHash !== 'string') throw new Error();
    return data;
  } catch { throw new BridgeError('NATIVE_OWNERSHIP', '托管身份文件损坏或权限不安全，不能猜测归属', 409); }
}
function executablePath(value: string): string {
  if (value.includes('/')) return realpathSync(value);
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    try { return realpathSync(resolve(directory || '.', value)); } catch { /* Keep the same PATH lookup as spawn. */ }
  }
  throw new BridgeError('NATIVE_EXECUTABLE', '无法从 PATH 找到原生可执行文件', 503);
}
export function saveNativeIdentity(config: OpenCodeConfig, process: ProcessIdentity): NativeIdentity {
  const identity: NativeIdentity = { ...process, version: 1, configuredExecutable: executablePath(config.executable), serverUrl: config.serverUrl,
    passwordFile: config.passwordFile, credentialHash: credentialHash(config.passwordFile) };
  const path = identityPath(config); const temp = path + '.' + randomUUID() + '.tmp';
  writeFileSync(temp, JSON.stringify(identity) + '\n', { mode: 0o600, flag: 'wx' });
  const fd = openSync(temp, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path); const dir = openSync(dirname(path), 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } return identity;
}
export function validateOwnedIdentity(config: OpenCodeConfig, identity: NativeIdentity): boolean {
  const actual = processIdentity(identity.pid);
  if (!actual || actual.bootId !== identity.bootId || actual.startTicks !== identity.startTicks) return false; // The recorded process has exited. Never signal a reused PID.
  if (!sameProcess(identity) || identity.uid !== process.getuid?.() || identity.workspace !== realpathSync(config.workspace)
    || identity.configuredExecutable !== executablePath(config.executable) || identity.serverUrl !== config.serverUrl
    || identity.passwordFile !== config.passwordFile || identity.credentialHash !== credentialHash(config.passwordFile)) throw new BridgeError('NATIVE_OWNERSHIP', '存活服务身份与托管记录不一致，拒绝接管或停止', 409);
  return true;
}
