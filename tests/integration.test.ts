import test from 'node:test';
import assert from 'node:assert/strict';
import { runAcceptance, writeReport } from './harness.js';
test('I01 real cross-process CLI acceptance: baseline, auth, persistence, idempotency and crashes', { timeout: 180000 }, async () => {
  const report = await runAcceptance();
  assert.equal(report.baseline.success, 20);
  assert.equal(report.baseline.failure, 10);
  assert.equal(report.baseline.historyLost, 0);
  assert.equal(report.idempotency.invocations, 1);
  assert.equal(report.fault.automaticReruns, 0);
  writeReport(report);
});
