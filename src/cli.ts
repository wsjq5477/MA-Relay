#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { readFileSync, statSync, realpathSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BridgeError, clip, idSchema, terminal, type Task } from './core.js';
import { initDemo, initOpenCode, loadConfig } from './config.js';
import { startHub } from './hub.js';
import { startEdge } from './edge.js';
import { request } from './client.js';
import { redactor } from './security.js';
import { doctor, up } from './local.js';
import { observe, taskText } from './observe.js';
import { type NativePermission, type NativeForm } from './drivers/opencode-client.js';
import { type Interaction } from './protocol.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { terminalCommand, safeTerminal } from './terminal.js';

const help = [
  'AgentBridge — CLI / Hub / Edge / OpenCode', '',
  'agentbridge                         首次配置向导 / 日常终端菜单',
  'agentbridge setup [--dir PATH] [--import PATH] [--advanced]',
  'agentbridge service status|stop [--dir PATH]',
  'agentbridge agents [--dir PATH] [--watch] [--json]',
  'agentbridge run [AGENT] MESSAGE [--dir PATH] [--watch]',
  'agentbridge conversations [--json]',
  'agentbridge conversation ID',
  'agentbridge continue ID MESSAGE [--watch] [--json]',
  'agentbridge cancel TASK_ID [--operation-id ID] [--json]',
  'agentbridge reconcile TASK_ID [--json]',
  'agentbridge request REQUEST_ID [--dir PATH]', '',
  'agentbridge operation TASK_ID OPERATION_ID [--dir PATH]', '',
  'agentbridge init [--dir .agentbridge] [--port 4317]',
  'agentbridge init --adapter opencode --workspace PROJECT [--model provider/model] [--dir .agentbridge-real] [--executable FILE]',
  'agentbridge doctor [--dir .agentbridge-real] [--json]',
  'agentbridge up [--dir .agentbridge-real]',
  'agentbridge hub start --config FILE',
  'agentbridge connect --config FILE',
  'agentbridge agents --config FILE [--json]',
  'agentbridge run AGENT MESSAGE --config FILE [--request-id ID] [--watch] [--json]',
  'agentbridge run AGENT (--stdin | --file FILE) --config FILE [--request-id ID]',
  'agentbridge tasks --config FILE [--watch] [--json]',
  'agentbridge task TASK_ID --config FILE [--watch] [--json] [--timeout-ms N] [--diagnostics]',
  'agentbridge native TASK_ID --config CLIENT [--edge-config EDGE] [--json]',
  'agentbridge native TASK_ID --config CLIENT --permission ID --decision once|reject',
  'agentbridge native TASK_ID --config CLIENT --form ID --answer-file JSON_FILE',
  '', 'Scope: AgentBridge-created tasks; unknown tasks retain Agent occupancy. Native helpers are local operator tools.',
  'Exit: 0 success, 1 observed task failure, 2 input/config/auth, 3 unknown/watch timeout,',
  '      4 business refusal, 5 network/service/not found, 130 observation interrupted.',
].join('\n');
export async function main(argv = process.argv.slice(2)): Promise<number> {
  let safe = (s: string) => s;
  let retainedRequestId: string | undefined;
  try {
    const interactive = await terminalCommand(argv);
    if (interactive !== undefined) return interactive;
    const { values: v, positionals: p } = parseArgs({
      args: argv, allowPositionals: true, strict: true,
      options: {
        config: { type: 'string' }, dir: { type: 'string' }, port: { type: 'string' },
        json: { type: 'boolean' }, watch: { type: 'boolean' }, stdin: { type: 'boolean' },
        file: { type: 'string' }, 'request-id': { type: 'string' }, 'timeout-ms': { type: 'string' },
        diagnostics: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
        adapter: { type: 'string' }, workspace: { type: 'string' }, executable: { type: 'string' },
        model: { type: 'string' },
        'edge-config': { type: 'string' }, permission: { type: 'string' }, decision: { type: 'string' },
        form: { type: 'string' }, 'answer-file': { type: 'string' },
      },
    });
    if (v.help || p.length === 0) { console.log(help); return 0; }
    const command = p[0];
    const allowed: Record<string, string[]> = {
      init: ['dir', 'port', 'json', 'adapter', 'workspace', 'executable', 'model'], hub: ['config'], connect: ['config'],
      doctor: ['dir', 'json'], up: ['dir'],
      native: ['config', 'edge-config', 'json', 'permission', 'decision', 'form', 'answer-file'],
      agents: ['config', 'json'], run: ['config', 'json', 'stdin', 'file', 'request-id', 'watch', 'timeout-ms'],
      tasks: ['config', 'json', 'watch', 'timeout-ms'], task: ['config', 'json', 'watch', 'timeout-ms', 'diagnostics'],
    };
    if (!command || !allowed[command]) throw new BridgeError('INVALID_COMMAND', 'Unknown command; use --help');
    for (const [name, value] of Object.entries(v)) if (value !== undefined && name !== 'help' && !allowed[command]!.includes(name)) throw new BridgeError('INVALID_ARGUMENT', 'Option is not supported by this command: --' + name);
    const print = (data: unknown, text?: string) => console.log(safeTerminal(safe(v.json ? JSON.stringify(data) : text ?? JSON.stringify(data, null, 2))));
    if (command === 'init') {
      if (p.length !== 1) throw new BridgeError('INVALID_ARGUMENT', 'init accepts no positional arguments');
      if (v.adapter !== undefined && !['mock', 'opencode'].includes(v.adapter)) throw new BridgeError('INVALID_ARGUMENT', 'Adapter must be mock or opencode');
      if (v.adapter === 'opencode' && !v.workspace || v.adapter !== 'opencode' && (v.workspace || v.executable || v.model)) throw new BridgeError('INVALID_ARGUMENT', 'Use --adapter opencode --workspace PROJECT');
      const port = v.port === undefined ? 4317 : Number(v.port);
      const files = v.adapter === 'opencode' ? initOpenCode(v.dir || '.agentbridge-real', v.workspace!, port, v.executable, v.model) : initDemo(v.dir || '.agentbridge', port);
      print({ files }, 'Created local demo configuration:\n' + files.join('\n'));
      return 0;
    }
    if (command === 'up' || command === 'doctor') {
      if (p.length !== 1) throw new BridgeError('INVALID_ARGUMENT', command + ' accepts no positional arguments');
      const directory = resolve(v.dir || '.agentbridge-real');
      if (command === 'up') return await up(directory);
      const report = await doctor(directory) as { healthy: boolean; version: string; workspace: string; serverUrl: string; model: unknown; action?: string };
      print(report, 'OpenCode: ' + report.version + '\nServer: ' + report.serverUrl + '\nWorkspace: ' + report.workspace + '\nModel: ' + JSON.stringify(report.model) + '\nHealthy: ' + report.healthy + (report.action ? '\nAction: ' + report.action : ''));
      return report.healthy ? 0 : 2;
    }
    const configPath = resolve(v.config || '.agentbridge/' + (command === 'hub' ? 'hub.json' : command === 'connect' ? 'edge-a.json' : 'client.json'));
    if (command === 'hub') {
      if (p.length !== 2 || p[1] !== 'start') throw new BridgeError('INVALID_ARGUMENT', 'Use hub start');
      const config = loadConfig(configPath, 'hub');
      safe = redactor([...config.users, ...config.connectors].map(u => u.token));
      const hub = await startHub(config, message => console.error(safe(message)));
      console.error(safe('Configuration: ' + configPath));
      await new Promise<void>((resolve, reject) => {
        let stopping = false;
        const stop = () => {
          if (stopping) return;
          stopping = true;
          void hub.close().then(resolve, reject);
        };
        process.once('SIGINT', stop); process.once('SIGTERM', stop);
      });
      return 0;
    }
    if (command === 'connect') {
      if (p.length !== 1) throw new BridgeError('INVALID_ARGUMENT', 'connect accepts no positional arguments');
      const config = loadConfig(configPath, 'edge');
      safe = redactor([config.token]);
      const edge = await startEdge(config, message => console.error(safe(message)));
      console.error(safe('Configuration: ' + configPath + ' Hub: ' + config.hubUrl));
      let intentional = false;
      const stop = () => { intentional = true; void edge.close(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      await edge.closed;
      if (!intentional) {
        console.error('EDGE_STOPPED: Edge stopped; check storage and execution evidence');
        return 5;
      }
      return 0;
    }
    const config = loadConfig(configPath, 'client');
    safe = redactor([config.token]);
    const timeout = v['timeout-ms'] === undefined ? undefined : Number(v['timeout-ms']);
    if (timeout !== undefined && (!v.watch || !Number.isInteger(timeout) || timeout <= 0)) throw new BridgeError('INVALID_ARGUMENT', '--timeout-ms requires --watch and a positive integer');
    if (command === 'native') {
      if (p.length !== 2 || !idSchema.safeParse(p[1]).success) throw new BridgeError('INVALID_ARGUMENT', 'Use native TASK_ID');
      const task = await request<Task>(config, '/v1/tasks/' + encodeURIComponent(p[1]!));
      if (!task.native) throw new BridgeError('NATIVE_MISSING', 'Task has no native execution binding');
      const waiting = await request<{ permissions: NativePermission[]; forms: NativeForm[] }>(config, '/v1/tasks/' + task.taskId + '/pending');
      const respond = async (reply: Omit<Interaction, 'taskId' | 'executionId' | 'operationId'>) => {
        const operationId = randomUUID();
        const input: Interaction = { ...reply, operationId, taskId: task.taskId, executionId: task.executionId };
        const operations = resolve(dirname(configPath), 'operations'); mkdirSync(operations, { recursive: true, mode: 0o700 });
        writeFileSync(resolve(operations, operationId + '.json'), JSON.stringify(input) + '\n', { mode: 0o600, flag: 'wx' });
        console.error('Operation ID retained: ' + operationId);
        return request(config, '/v1/tasks/' + task.taskId + '/reply', input);
      };
      if (v.permission || v.decision) {
        if (v.form || v['answer-file'] || !v.permission || !['once', 'reject'].includes(v.decision || '')) throw new BridgeError('INVALID_ARGUMENT', 'Use --permission ID --decision once|reject');
        if (!waiting.permissions.some(r => r.id === v.permission)) throw new BridgeError('NATIVE_REQUEST_MISSING', 'Permission request is not pending in this task session');
        const receipt = await respond({ action: 'permission', requestId: v.permission, decision: v.decision as 'once' | 'reject' });
        print(receipt);
      } else if (v.form || v['answer-file']) {
        if (!v.form || !v['answer-file']) throw new BridgeError('INVALID_ARGUMENT', 'Use --form ID --answer-file FILE');
        if (!waiting.forms.some(r => r.id === v.form)) throw new BridgeError('NATIVE_REQUEST_MISSING', 'Form is not pending in this task session');
        let answer: unknown;
        try {
          const path = resolve(v['answer-file']); if (statSync(path).size > 65536) throw new Error();
          answer = JSON.parse(readFileSync(path, 'utf8'));
        } catch { throw new BridgeError('INVALID_ANSWER', 'Answer file must contain valid JSON within 64 KiB'); }
        const receipt = await respond({ action: 'form', requestId: v.form, answer: answer as Interaction['answer'] });
        print(receipt);
      } else print({ taskId: task.taskId, sessionId: task.native.sessionId, ...waiting },
        'Native session: ' + task.native.sessionId + '\n' + JSON.stringify(waiting, null, 2));
      return 0;
    }
    if (command === 'agents') {
      if (p.length !== 1) throw new BridgeError('INVALID_ARGUMENT', 'agents accepts no positional arguments');
      const data = await request<{ items: { agentId: string; name: string; adapter: string; device: string; online: boolean; healthy: boolean; busy: boolean; currentTask?: { taskId?: string; summary: string; uncertaintyReason?: string } }[] }>(config, '/v1/agents');
      print(data, ['ID\tNAME\tADAPTER\tDEVICE\tONLINE\tHEALTHY\tBUSY\tTASK / SUMMARY',
        ...data.items.map(a => [a.agentId, a.name, a.adapter, a.device, a.online, a.healthy, a.busy,
          (a.currentTask?.taskId || '') + ' ' + (a.currentTask?.uncertaintyReason || a.currentTask?.summary || '')].join('\t'))].join('\n'));
      return 0;
    }
    if (command === 'run') {
      if (p.length < 2 || p.length > 3) throw new BridgeError('INVALID_ARGUMENT', 'Use run AGENT MESSAGE, --stdin or --file');
      const sources = Number(p.length === 3) + Number(!!v.stdin) + Number(v.file !== undefined);
      if (sources !== 1) throw new BridgeError('INVALID_ARGUMENT', 'Choose exactly one message source: argument, --stdin or --file');
      let bytes: Buffer;
      if (v.file !== undefined) {
        try {
          const file = resolve(v.file);
          if (statSync(file).size > 65536) throw new BridgeError('INVALID_MESSAGE', 'Message file exceeds 64 KiB');
          bytes = readFileSync(file);
        } catch (e) {
          if (e instanceof BridgeError) throw e;
          throw new BridgeError('INPUT_READ', 'Cannot read message file');
        }
      } else if (v.stdin) {
        const chunks: Buffer[] = []; let size = 0;
        for await (const raw of process.stdin) {
          const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          size += chunk.length;
          if (size > 65536) { process.stdin.destroy(); throw new BridgeError('INVALID_MESSAGE', 'stdin exceeds 64 KiB'); }
          chunks.push(chunk);
        }
        bytes = Buffer.concat(chunks);
      } else bytes = Buffer.from(p[2]!);
      let message: string;
      try { message = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new BridgeError('INVALID_MESSAGE', 'Message must be valid UTF-8'); }
      if (!message.trim() || bytes.length > 65536) throw new BridgeError('INVALID_MESSAGE', 'Message is empty or exceeds 64 KiB');
      if (!idSchema.safeParse(p[1]).success || v['request-id'] !== undefined && !idSchema.safeParse(v['request-id']).success) throw new BridgeError('INVALID_ARGUMENT', 'Agent and request IDs must contain 1–128 letters, digits or . _ : -');
      retainedRequestId = v['request-id'] || randomUUID();
      const task = await request<Task>(config, '/v1/tasks', { targetAgent: p[1], requestId: retainedRequestId, message });
      if (v.watch) return await observe(config, task.taskId, !!v.json, timeout, (data, text) => print(data, text));
      print(task, 'Task ' + task.taskId + '\nAgent: ' + task.targetAgent + '\nStatus: ' + task.status + '\nConversation: ' + task.conversationId + '\nRequest: ' + task.requestId);
      return 0;
    }
    if (command === 'task' && p.length !== 2 || command === 'tasks' && p.length !== 1) throw new BridgeError('INVALID_ARGUMENT', 'Invalid task query arguments');
    if (command === 'task' && v.watch && !v.diagnostics) return await observe(config, p[1]!, !!v.json, timeout, (data, text) => print(data, text));
    let interrupted = false;
    const stop = () => { interrupted = true; };
    if (v.watch) process.once('SIGINT', stop);
    const start = Date.now();
    let prior = '';
    try {
      do {
        let data: unknown;
        let text: string;
        let status: Task['status'] | undefined;
        if (command === 'task') {
          const task = await request<Task & { events?: unknown[] }>(config, '/v1/tasks/' + encodeURIComponent(p[1]!) + (v.diagnostics ? '?diagnostics=true' : ''));
          data = task; status = task.status;
          text = taskText(task);
        } else {
          let cursor: number | undefined = 0;
          const items: Task[] = [];
          do {
            const page: { items: Task[]; nextCursor?: number } = await request(config, '/v1/tasks?cursor=' + cursor);
            items.push(...page.items); cursor = page.nextCursor;
          } while (cursor !== undefined);
          data = { items, scope: 'AgentBridge-created tasks only' };
          text = ['Scope: AgentBridge-created tasks only', 'TASK\tAGENT\tSTATUS\tCREATED\tDURATION_MS\tSUMMARY', ...items.map(t => [
            t.taskId, t.targetAgent, t.status, t.createdAt,
            t.startedAt ? ((t.finishedAt ? new Date(t.finishedAt).getTime() : terminal(t.status) || t.status === 'unknown' ? new Date(t.updatedAt).getTime() : Date.now()) - new Date(t.startedAt).getTime()) : '-',
            clip(t.lastSummary.replaceAll('\n', ' '), 180).text,
          ].join('\t'))].join('\n');
        }
        const serialized = JSON.stringify(data);
        if (serialized !== prior || !v.watch) { print(data, text); prior = serialized; }
        if (!v.watch) return 0;
        if (status && terminal(status)) return status === 'succeeded' ? 0 : 1;
        if (status === 'unknown') return 3;
        if (timeout !== undefined && Date.now() - start >= timeout) {
          console.error('WATCH_TIMEOUT: Local observation ended; task execution was not changed');
          return 3;
        }
        if (!interrupted) await delay(100);
      } while (!interrupted);
      return 130;
    } finally { if (v.watch) process.removeListener('SIGINT', stop); }
  } catch (e) {
    const error = e instanceof BridgeError ? e : new BridgeError('COMMAND_FAILED', 'Command failed; check arguments, configuration and storage');
    console.error(safe(error.code + ': ' + error.message));
    if (retainedRequestId) console.error('Request ID retained for explicit retry: ' + safe(retainedRequestId));
    if (error.httpStatus === 130) return 130;
    if (error.httpStatus === 401 || error.httpStatus === 403 || error.httpStatus === 400 || error.httpStatus === 413) return 2;
    if (error.httpStatus === 409) return 4;
    return 5;
  }
}
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
