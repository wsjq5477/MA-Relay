import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface DetectedAgent { executable: string; version: string; name: string }
interface DiscoveryEnvironment {
  path?: string;
  home?: string;
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  executable?: string;
}
interface ScannedTool extends DetectedAgent { adapter: string; healthy: boolean }
import { BridgeError } from './core.js';
const { scanTools, openCodeCompatibility, command } = createRequire(import.meta.url)('../desktop/electron/tool-discovery.cjs') as {
  command(executable:string, args:string[], environment:NodeJS.ProcessEnv): {executable:string;args:string[];env:NodeJS.ProcessEnv};
  openCodeCompatibility(version: unknown): {supported:boolean;code?:string;message?:string};
  scanTools(options: { home?: string; platform: NodeJS.Platform; environment: NodeJS.ProcessEnv;
    candidates: { claude: string[]; codex: string[]; hermes: string[]; pi: string[]; dsh: string[]; opencode?: string[] } }): Promise<ScannedTool[]>;
};

/** Read only the chosen installation's version, using the same launcher as serve. */
export async function readOpenCodeVersion(executable:string):Promise<string> {
  const launch = command(executable, ['--version'], process.env);
  const result = await promisify(execFile)(launch.executable, launch.args, {
    env:launch.env, shell:false, windowsHide:true, timeout:10000, maxBuffer:65536,
  });
  return result.stdout.trim().slice(0,100);
}

/** Read-only discovery and exact selected-installation checks. No service or model calls. */
export async function discoverOpenCode(options: DiscoveryEnvironment = {}): Promise<DetectedAgent[]> {
  const platform = options.platform ?? process.platform;
  const environment = { ...process.env, ...options.environment };
  if (options.path !== undefined) {
    environment.PATH = options.path;
    if (platform === 'win32') environment.Path = options.path;
  }
  const items = await scanTools({ home: options.home, platform, environment,
    candidates: { claude: [], codex: [], hermes: [], pi: [], dsh: [], ...(options.executable ? { opencode: [options.executable] } : {}) } });
  // CLI display versions do not establish the HTTP contract. Connect probes the
  // selected installation before admitting work, including enterprise builds.
  return items.filter(item => item.adapter === 'opencode' && item.healthy)
    .map(({ name, executable, version }) => ({ name, executable, version }));
}

export function requireOpenCodeVersion(version: unknown): void {
  const compatibility=openCodeCompatibility(version);
  if(!compatibility.supported)throw new BridgeError('NATIVE_VERSION',compatibility.message!,503);
}
/** Revalidate only the original selected installation; never choose an alias. */
export async function verifyOpenCodeInstallation(executable:string):Promise<DetectedAgent>{
  const [installation]=await discoverOpenCode({executable});
  if(!installation)throw new BridgeError('DISCOVERY_CHANGED','这个 OpenCode 已不可用，请核对原安装后重新扫描。');
  requireOpenCodeVersion(installation.version);
  return installation;
}
