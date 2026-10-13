import type { Descriptor, TaskEvent } from '../core.js';
import type { Execution } from '../protocol.js';

export interface DriverCapabilities {
  concurrency: 1; progress: true; cancel: boolean; nativeSessions: boolean;
}
export interface AgentDriver {
  readonly descriptor: Descriptor;
  readonly capabilities: DriverCapabilities;
  health(): boolean;
  execute(execution: Execution, signal?: AbortSignal): AsyncIterable<Exclude<TaskEvent, { kind: 'accepted' }>>;
}
