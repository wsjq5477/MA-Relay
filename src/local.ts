import { resolve } from 'node:path';
import { loadConfig, type OpenCodeConfig } from './config.js';
import { BridgeError } from './core.js';
import { startNativeServer, type NativeServerHandle } from './native-server.js';
import { OpenCodeClient } from './drivers/opencode-client.js';
import { startHub, type HubHandle } from './hub.js';
import { startEdge, type EdgeHandle } from './edge.js';

export function localConfig(dir: string) {
  const edge = loadConfig(resolve(dir, 'edge-a.json'), 'edge');
  if (edge.agents.length !== 1 || edge.agents[0]?.adapter !== 'opencode') throw new BridgeError('LOCAL_CONFIG', 'Local OpenCode commands require one opencode Agent');
  const agent = edge.agents[0];
  return { edge, agent, hub: loadConfig(resolve(dir, 'hub.json'), 'hub') };
}
export async function doctor(dir: string): Promise<unknown> {
  const { agent } = localConfig(dir); let native: NativeServerHandle | undefined;
  const client = new OpenCodeClient(agent);
  try {
    // Reuse a configured running service. Only launch a new one if it is genuinely unavailable.
    let check: Awaited<ReturnType<OpenCodeClient['check']>>;
    try { check = await client.check(3000); }
    catch (e) {
      if (!agent.managed || !(e instanceof BridgeError) || !['NATIVE_UNAVAILABLE', 'NATIVE_AUTH_UNAVAILABLE'].includes(e.code)) throw e;
      native = await startNativeServer(agent); check = await client.check(3000);
    }
    return { ...check, serverUrl: agent.serverUrl, agentId: agent.agentId,
      ...(check.healthy ? {} : { action: 'Configure an available model in native OpenCode, then rerun doctor' }) };
  } finally { await native?.close(); }
}
export async function up(dir: string, log: (s: string) => void = console.error): Promise<number> {
  const config = localConfig(dir);
  let native: NativeServerHandle | undefined; let hub: HubHandle | undefined; let edge: EdgeHandle | undefined;
  let resolveStop!: () => void; let requested = false;
  const stopped = new Promise<void>(r => { resolveStop = r; });
  const stop = () => { requested = true; resolveStop(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    if (config.edge.hubUrl !== 'http://' + config.hub.host + ':' + config.hub.port) throw new BridgeError('LOCAL_CONFIG', 'Hub and Edge addresses do not match');
    if (config.agent.managed) native = await startNativeServer(config.agent);
    const check = await new OpenCodeClient(config.agent).check(3000);
    if (!check.healthy) log('MODEL_UNAVAILABLE: Configure a model in native OpenCode; Agent will remain unhealthy until it is available');
    if (requested) return 0;
    hub = await startHub(config.hub, log);
    edge = await startEdge(config.edge, log);
    log('AgentBridge ready — OpenCode ' + check.version + '\nWorkspace: ' + check.workspace + '\nClient configuration: ' + resolve(dir, 'client.json'));
    log('Use another terminal: node dist/cli.js run opencode "分析这个项目" --watch --config ' + resolve(dir, 'client.json'));
    await Promise.race([stopped, edge.closed, ...(native ? [native.closed] : [])]);
    if (!requested) throw new BridgeError('LOCAL_SERVICE_ENDED', 'A local service ended; uncertain tasks are not automatically resubmitted', 503);
    return 0;
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    await edge?.close(); await hub?.close(); await native?.close();
  }
}
export function matchingAgent(configFile: string, target: string, native: { serverUrl: string; workspace: string }): OpenCodeConfig {
  const config = loadConfig(configFile, 'edge');
  const agent = config.agents.find(a => a.agentId === target);
  if (!agent || agent.adapter !== 'opencode' || agent.serverUrl !== native.serverUrl || agent.workspace !== native.workspace) throw new BridgeError('NATIVE_BINDING', 'Local Edge configuration does not match this task');
  return agent;
}
