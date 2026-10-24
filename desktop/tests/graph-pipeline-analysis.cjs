// Offline diagnostics only. Never changes the PNG gate or infers physical presentation.
const fs = require('node:fs'), assert = require('node:assert/strict');

function distribution(values, optional = false) {
  if (optional && values.length === 0) return {count: 0, totalMs: null, p95Ms: null, maximumMs: null};
  assert(values.length > 0, 'The requested trace event must exist');
  const sorted = [...values].sort((a, b) => a - b);
  return {count: values.length, totalMs: values.reduce((sum, value) => sum + value, 0),
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], maximumMs: sorted.at(-1)};
}

function summarize(metrics, trace) {
  const events = trace.traceEvents, samples = metrics.graph.samples;
  const pixels = metrics.graph.presentation;
  assert.equal(samples.length, 20); assert.equal(pixels.samples.length, samples.length);
  const dispatches = events.filter(event => event.name === 'EventDispatch' && event.ph === 'X');
  const type = event => event.args?.data?.type;
  const downs = dispatches.filter(event => type(event) === 'pointerdown').sort((a, b) => a.ts - b.ts);
  const ups = dispatches.filter(event => type(event) === 'pointerup').sort((a, b) => a.ts - b.ts);
  assert.equal(downs.length, samples.length); assert.equal(ups.length, samples.length);
  const spans = name => events.filter(event => event.name === name && event.ph === 'X' && Number.isFinite(event.dur));
  const overlays = spans('SkiaOutputDevice->ScheduleOverlays()');
  const mainFrames = spans('ProxyMain::BeginMainFrame');
  const overlaps = (event, start, end) => event.ts < end && event.ts + event.dur > start;
  const rows = samples.map((sample, index) => {
    const down = downs[index], up = ups[index];
    assert(down.ts < up.ts && (!downs[index + 1] || up.ts < downs[index + 1].ts));
    assert.equal(down.pid, up.pid); assert.equal(down.tid, up.tid);
    const moves = dispatches.filter(event => type(event) === 'pointermove' && event.pid === down.pid &&
      event.tid === down.tid && event.ts > down.ts && event.ts < up.ts);
    assert.equal(moves.length, 8, 'All original eight drag moves must be present in this gesture window');
    const gpu = overlays.filter(event => overlaps(event, down.ts, up.ts));
    const main = mainFrames.filter(event => event.pid === down.pid && overlaps(event, down.ts, up.ts));
    return {index: index + 1, traceMoveCount: moves.length,
      domMutationMs: sample.mutatedAt - sample.firstMoveAt,
      rafUpperBoundMs: sample.feedbackUpperBoundMs,
      pngObservationMs: pixels.samples[index].durationMs,
      mainFrameMaximumDuringDragMs: Math.max(0, ...main.map(event => event.dur / 1000)),
      gpuScheduleMaximumDuringDragMs: gpu.length ? Math.max(...gpu.map(event => event.dur / 1000)) : null,
      gpuSchedulesOver100MsDuringDrag: gpu.filter(event => event.dur > 100000).length};
  });
  return {version: metrics.version, rendererMode: metrics.rendererMode || 'default browser rendering (original runner)',
    diagnosticTimeline: metrics.diagnosticTimeline === true, modelCalls: metrics.modelCalls,
    method: 'Pair all original renderer pointerdown/up dispatches and eight pointermove events by order and renderer identity. Correlate whole trace spans overlapping each trace-clock drag window. DOM/RAF/PNG delays retain their original reports; no cross-clock subtraction or gate change.',
    limitations: 'Trace span overlap is correlation, not causal attribution or physical display latency. Profiling and PNG capture can affect runtime. Software rendering is a separate diagnostic environment.',
    gpu: Object.fromEntries(['gpu-gl-renderer', 'gpu-gl-vendor', 'gpu-driver-version'].map(key => [key, trace.metadata?.[key] ?? null])),
    mainFrameWork: distribution(mainFrames.map(event => event.dur / 1000)),
    resizeObserverWork: distribution(spans('LocalFrameView::NotifyResizeObservers').map(event => event.dur / 1000)),
    gpuScheduleWork: distribution(overlays.map(event => event.dur / 1000), true),
    pngP95Ms: pixels.p95Ms, rafP95Ms: metrics.graph.p95Ms, syncP95Ms: metrics.sync?.p95Ms ?? null,
    originalStatus: metrics.status, originalError: metrics.error ?? null, thresholdMs: 100, samples: rows};
}

if (require.main === module) {
  const [metricsFile, traceFile, output] = process.argv.slice(2);
  const result = summarize(JSON.parse(fs.readFileSync(metricsFile, 'utf8')), JSON.parse(fs.readFileSync(traceFile, 'utf8')));
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({status: result.originalStatus, samples: result.samples.length,
    pngP95Ms: result.pngP95Ms, syncP95Ms: result.syncP95Ms, gpuScheduleMaximumMs: result.gpuScheduleWork.maximumMs}));
}
module.exports = {summarize};
