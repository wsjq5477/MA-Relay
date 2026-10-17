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
    candidates: { claude: string[]; codex: string[]; opencode?: string[] } }): Promise<ScannedTool[]>;
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
    candidates: { claude: [], codex: [], ...(options.executable ? { opencode: [options.executable] } : {}) } });
  // Installation detection accepts other majors; this adapter requires OpenCode 2 API.
  return items.filter(item => item.healthy && /^2\./.test(item.version))
    .map(({ name, executable, version }) => ({ name, executable, version }));
}
