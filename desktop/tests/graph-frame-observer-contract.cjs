// Explicit verifier contract, synthetic pixels; not real display evidence.
const {test} = require('node:test'), assert = require('node:assert/strict');
const {PNG} = require('../node_modules/playwright-core/lib/utilsBundle.js');
const {analyzeCapturedFrames} = require('./graph-frame-observer.cjs');
const color = [28, 100, 216], rect = {x: 100, y: 200, width: 280, height: 132};
function frame(index, swapAt, x) {
  const png = new PNG({width: 1440, height: 960}); png.data.fill(255);
  for (let y = 200; y < 332; y++) for (let dx = 0; dx < 7; dx++) {
    const at = (y * png.width + x + dx) * 4;
    for (let c = 0; c < 3; c++) png.data[at + c] = color[c];
  }
  const metadata = {timestamp: swapAt / 1000, offsetTop: 0, pageScaleFactor: 1};
  return {frame: {metadata, bytes: PNG.sync.write(png)}, file: {index, name: `frame-${index}.png`, metadata, swapAt}};
}
const captured = [frame(0, 900, 100), frame(1, 1200, 104)];
const sample = {firstMoveAt: 1000, downAt: 990, secondFrame: 1050, feedbackUpperBoundMs: 50, inputEvents: [{timeStamp: 1000}]};
const gesture = {rect, color, direction: 1};
const analyze = (samples, gestures) => analyzeCapturedFrames({frames: captured.map(v => v.frame), files: captured.map(v => v.file), samples, gestures, timeOrigin: 0});
test('last gesture retains a genuinely late captured frame and its latency above the unchanged 100ms threshold', () => {
  const result = analyze([sample], [gesture]);
  assert.equal(result.samples.length, 1); assert.equal(result.p95Ms, 200);
  assert(result.p95Ms > 100); assert.equal(result.samples[0].moved.frame, 'frame-1.png');
});
test('an earlier gesture cannot borrow a frame after the next original pointerdown', () => {
  assert.throws(() => analyze([sample, {...sample, downAt: 1100, firstMoveAt: 1110}], [gesture, gesture]), /Sample 1: a rendered frame/);
});
test('the observer rejects missing swap timestamps and motion in the wrong direction rather than using DOM timing', () => {
  const invalid = captured.map(v => ({...v.frame, metadata: {...v.frame.metadata, timestamp: undefined}}));
  assert.throws(() => analyzeCapturedFrames({frames: invalid, files: captured.map(v => v.file), samples: [sample], gestures: [gesture], timeOrigin: 0}), /swap epoch timestamp/);
  assert.throws(() => analyze([sample], [{...gesture, direction: -1}]), /Sample 1: a rendered frame/);
});
