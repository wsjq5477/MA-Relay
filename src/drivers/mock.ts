import { setTimeout as delay } from 'node:timers/promises';
import type { MockConfig } from '../config.js';
import type { Descriptor, TaskEvent } from '../core.js';
import type { Execution } from '../protocol.js';
import type { AgentDriver, DriverCapabilities } from './driver.js';

export class MockDriver implements AgentDriver {
  readonly descriptor: Descriptor;
  readonly capabilities: DriverCapabilities = { concurrency: 1, progress: true, cancel: false, nativeSessions: false };
  constructor(private readonly config: MockConfig, private readonly recordInvocation: (executionId: string) => void) {
    this.descriptor = { agentId: config.agentId, name: config.name, adapter: 'mock', healthy: config.healthy };
  }
  health(): boolean { return this.config.healthy; }
  async *execute(execution: Execution, signal?: AbortSignal): AsyncIterable<Exclude<TaskEvent, { kind: 'accepted' }>> {
    this.recordInvocation(execution.executionId);
    yield { kind: 'started' };
    yield { kind: 'progress', text: 'Mock executing on ' + this.config.agentId };
    await delay(this.config.delayMs, undefined, { signal });
    if (this.config.mode === 'failure') {
      yield { kind: 'failed', error: { code: 'MOCK_FAILURE', message: 'Configured Mock failure on ' + this.config.agentId, phase: 'execution' } };
    } else {
      yield { kind: 'output', text: execution.message };
      yield { kind: 'completed', result: { agentId: this.config.agentId, message: execution.message } };
    }
  }
}
