import { setTimeout as delay } from 'node:timers/promises';
import type { ClientConfig } from './config.js';
import { request } from './client.js';
import { terminal, type StoredEvent, type Task } from './core.js';

export function taskText(task: Task): string {
  return [
    'Task: ' + task.taskId, 'Agent: ' + task.targetAgent, 'Status: ' + task.status,
    'Message: ' + task.message, 'Summary: ' + task.lastSummary,
    ...(task.native ? ['Native session: ' + task.native.sessionId, 'Native message: ' + task.native.messageId, 'Workspace: ' + task.native.workspace] : []),
    ...(task.waiting ? ['Waiting (' + task.waiting.kind + '): ' + task.waiting.summary,
      'Use: agentbridge native ' + task.taskId + ' --config CLIENT_FILE --edge-config EDGE_FILE'] : []),
    ...(task.result ? ['Result:\n' + task.result.message, ...(task.result.truncated ? ['Result truncated; inspect the native session for full output'] : [])] : []),
    ...(task.error ? ['Error: ' + task.error.code + ' ' + task.error.message] : []),
    ...(task.uncertaintyReason ? ['Unknown: ' + task.uncertaintyReason, 'Agent occupancy retained; native execution may still be active; no automatic retry'] : []),
  ].join('\n');
}
export async function observe(config: ClientConfig, taskId: string, json: boolean, timeout: number | undefined, print: (data: unknown, text: string) => void): Promise<number> {
  let interrupted = false; let prior = ''; let seq = 0; let priorStatus = ''; let priorSummary = '';
  const stop = () => { interrupted = true; };
  process.once('SIGINT', stop); const start = Date.now();
  try {
    do {
      const task = await request<Task & { events?: StoredEvent[] }>(config, '/v1/tasks/' + encodeURIComponent(taskId));
      if (json) {
        const key = JSON.stringify(task);
        if (key !== prior) print(task, ''); prior = key;
      } else {
        if (!priorStatus) print(task, 'Task: ' + task.taskId + '\nAgent: ' + task.targetAgent + '\nRequest: ' + task.requestId);
        if (task.status !== priorStatus) print(task, 'Status: ' + task.status);
        for (const item of task.events || []) {
          if (item.seq <= seq) continue; seq = item.seq;
          const event = item.event;
          if (event.kind === 'progress') print(item, event.text);
          if (event.kind === 'output') print(item, 'Answer (in progress):\n' + event.text);
          if (event.kind === 'native') print(item, 'Native session: ' + event.reference.sessionId + '\nWorkspace: ' + event.reference.workspace);
          if (event.kind === 'waiting') print(item, event.waiting ? 'Waiting (' + event.waiting.kind + '): ' + event.waiting.summary + '\nUse: agentbridge native ' + taskId + ' --config CLIENT_FILE --edge-config EDGE_FILE' : 'Native execution resumed');
        }
        if (!task.events && task.lastSummary !== priorSummary) print(task, task.lastSummary);
        if (terminal(task.status) || task.status === 'unknown') print(task, taskText(task));
        priorStatus = task.status; priorSummary = task.lastSummary;
      }
      if (terminal(task.status)) return task.status === 'succeeded' ? 0 : 1;
      if (task.status === 'unknown') return 3;
      if (timeout !== undefined && Date.now() - start >= timeout) {
        console.error('WATCH_TIMEOUT: Local observation ended; task execution was not changed'); return 3;
      }
      if (!interrupted) await delay(200);
    } while (!interrupted);
    return 130;
  } finally { process.removeListener('SIGINT', stop); }
}
