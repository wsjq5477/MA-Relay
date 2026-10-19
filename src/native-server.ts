import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import type { OpenCodeConfig } from './config.js';
import { BridgeError } from './core.js';
import { OpenCodeClient } from './drivers/opencode-client.js';
import { readNativeIdentity, validateOwnedIdentity, saveNativeIdentity, processIdentity, sameProcess, sameBirth, type NativeIdentity } from './native-identity.js';

export interface NativeServerHandle { pid: number; reused?: boolean; close(): Promise<void>; closed: Promise<void> }
export async function startNativeServer(config: OpenCodeConfig): Promise<NativeServerHandle> {
  const url = new URL(config.serverUrl);
  if (url.hostname !== '127.0.0.1' || !url.port) throw new BridgeError('NATIVE_ADDRESS', 'Managed OpenCode requires 127.0.0.1 and an explicit port');
  const previous = readNativeIdentity(config);
  if (previous && validateOwnedIdentity(config, previous)) {
    const info = await new OpenCodeClient(config).call<{ version: string }>('/api/info');
    if (!/^2\./.test(info.version)) throw new BridgeError('NATIVE_OWNERSHIP', '存活服务认证或类型无法确认', 409);
    let resolveClosed!: () => void; const closed = new Promise<void>(r => { resolveClosed = r; });
    const monitor = setInterval(() => { try { if (!sameProcess(previous)) { clearInterval(monitor); resolveClosed(); } } catch { clearInterval(monitor); resolveClosed(); } }, 250);
    return { pid: previous.pid, reused: true, closed, async close() {
      if (!sameProcess(previous)) { clearInterval(monitor); resolveClosed(); return; }
      process.kill(previous.pid, 'SIGTERM');
      const force = setTimeout(() => { try { if (sameProcess(previous)) process.kill(previous.pid, 'SIGKILL'); } catch { /* Never signal an unverified process. */ } }, 5000);
      await closed; clearTimeout(force);
    } };
  }
  const portOccupied = () => new Promise<boolean>((done, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: Number(url.port) });
    const timer = setTimeout(() => { socket.destroy(); reject(new BridgeError('NATIVE_OWNERSHIP', '端口占用情况无法确认', 409)); }, 1000);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); done(true); });
    socket.once('error', (e: NodeJS.ErrnoException) => { clearTimeout(timer); socket.destroy(); if (e.code === 'ECONNREFUSED') done(false); else if (['ECONNRESET', 'ECONNABORTED'].includes(e.code || '')) done(true); else reject(new BridgeError('NATIVE_OWNERSHIP', '端口身份无法确认（' + (e.code || 'unknown') + '）', 409)); });
  });
  let occupied = await portOccupied();
  const releaseDeadline = Date.now() + (previous ? 2000 : 0);
  while (occupied && previous && Date.now() < releaseDeadline) { await delay(100); occupied = await portOccupied(); }
  if (occupied) throw new BridgeError('NATIVE_OWNERSHIP', '端口已有未确认归属的服务；请在高级设置连接已有服务或核对旧托管实例', 409);
  // OpenCode 2 accepts OPENCODE_PASSWORD. Detached-safe stdio is essential:
  // pipes to a killed controller can later terminate the surviving native server on EPIPE.
  const password = randomBytes(32).toString('base64url');
  writeFileSync(config.passwordFile, password + '\n', { mode: 0o600 }); chmodSync(config.passwordFile, 0o600);
  let identity: NativeIdentity | undefined;
  const environment:NodeJS.ProcessEnv={...process.env, OPENCODE_PASSWORD: password, OPENCODE_SERVER_PASSWORD: password};
  const mcpFile=resolve(dirname(config.passwordFile),'bridge-mcp.json');
  if(existsSync(mcpFile)){
    const bridgeConfig=JSON.parse(readFileSync(mcpFile,'utf8')) as {instructions?:string[];mcp:{servers:Record<string,unknown>}};
    const inherited=JSON.parse(environment.OPENCODE_CONFIG_CONTENT||'{}') as {instructions?:string[];mcp?:{servers?:Record<string,unknown>}};
    environment.OPENCODE_CONFIG_CONTENT=JSON.stringify({...inherited,instructions:[...(inherited.instructions||[]),...(bridgeConfig.instructions||[])],mcp:{...inherited.mcp,servers:{...inherited.mcp?.servers,...bridgeConfig.mcp.servers}}});
  }
  const command=createRequire(import.meta.url)('../desktop/electron/tool-discovery.cjs').command(config.executable,['serve', '--hostname', '127.0.0.1', '--port', url.port],environment) as {executable:string;args:string[];env:NodeJS.ProcessEnv};
  const child = spawn(command.executable, command.args, {
    cwd: config.workspace, stdio: 'ignore', shell: false, windowsHide: true,
    env: command.env,
  });
  let ended = false; let launchError = false;
  const closed = new Promise<void>(resolve => { child.once('exit', () => { ended = true; resolve(); }); child.once('error', () => { ended = true; launchError = true; resolve(); }); });
  let stopping = false;
  const close = async () => {
    if (stopping) return closed;
    stopping = true; if (!identity || sameBirth(identity)) child.kill('SIGTERM');
    const force = setTimeout(() => { if (!identity || sameBirth(identity)) child.kill('SIGKILL'); }, 5000); force.unref();
    await closed; clearTimeout(force);
  };
  try {
    const deadline = Date.now() + 20000; const client = new OpenCodeClient(config);
    while (Date.now() < deadline) {
      if (ended) throw new BridgeError(launchError ? 'NATIVE_EXECUTABLE' : 'NATIVE_EXITED', launchError ? 'Cannot launch OpenCode; check the executable path' : 'OpenCode exited during startup; check configuration', 503);
      if (!identity && child.pid) { const current = processIdentity(child.pid); if (current) identity = saveNativeIdentity(config, current); }
      try {
        const info = await client.call<{ version: string }>('/api/info');
        if (!/^2\./.test(info.version)) throw new BridgeError('NATIVE_VERSION', 'This adapter requires OpenCode 2', 503);
        if (!identity || !sameBirth(identity)) throw new BridgeError('NATIVE_OWNERSHIP', '服务进程身份在启动期间改变', 409);
        const settled = processIdentity(child.pid!); if (!settled) throw new BridgeError('NATIVE_EXITED', '服务就绪后退出', 503);
        identity = saveNativeIdentity(config, settled);
        return { pid: child.pid!, reused: false, close, closed };
      } catch (e) { if (e instanceof BridgeError && ['NATIVE_VERSION', 'NATIVE_OWNERSHIP'].includes(e.code)) throw e; }
      await delay(100);
    }
    throw new BridgeError('NATIVE_START_TIMEOUT', 'OpenCode did not become ready within 20 seconds', 503);
  } catch (e) { await close(); throw e; }
}
