import { createRequire } from 'node:module';

export interface DetectedAgent { executable: string; version: string; name: string }
interface DiscoveryEnvironment {
  path?: string;
  home?: string;
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  executable?: string;
}
interface ScannedTool extends DetectedAgent { adapter: string; healthy: boolean }
const { scanTools } = createRequire(import.meta.url)('../desktop/electron/tool-discovery.cjs') as {
  scanTools(options: { home?: string; platform: NodeJS.Platform; environment: NodeJS.ProcessEnv;
    candidates: { claude: string[]; codex: string[]; hermes: string[]; pi: string[]; dsh: string[]; opencode?: string[] } }): Promise<ScannedTool[]>;
};

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
  return items.filter(item => item.healthy)
    .map(({ name, executable, version }) => ({ name, executable, version }));
}
