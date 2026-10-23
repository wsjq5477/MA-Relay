// Acceptance-only observer: measure actual rendered pixels, not an earlier DOM timestamp.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {PNG} = require('../node_modules/playwright-core/lib/utilsBundle.js');

function borderPosition(png, rect, color) {
  const left = Math.max(0, Math.floor(rect.x - 32)), right = Math.min(png.width - 1, Math.ceil(rect.x + 32));
  const top = Math.max(0, Math.ceil(rect.y + 30)), bottom = Math.min(png.height - 1, Math.floor(rect.y + 90));
  if (bottom - top < 30) return null;
  const runs = []; let run;
  for (let x = left; x <= right; x++) {
    let matches = 0;
    for (let y = top; y <= bottom; y++) {
      const i = (y * png.width + x) * 4;
      if (color.every((value, c) => Math.abs(png.data[i + c] - value) <= 3) && png.data[i + 3] === 255) matches++;
    }
    if (matches / (bottom - top + 1) >= 0.9) {
      if (!run) run = {x, width: 0}; run.width++;
    } else if (run) {runs.push(run); run = null;}
  }
  if (run) runs.push(run);
  // The leader has a seven-pixel solid left border. Ignore the two-pixel
  // focus/selection outline, so selecting the card cannot count as movement.
  return runs.filter(value => value.width >= 4).sort((a, b) => b.width - a.width)[0] || null;
}

async function observeFrames(page, directory) {
  const client = await page.context().newCDPSession(page), frames = [], errors = [];
  let stopped = false;
  let archived;
  const archive = () => {
    if (archived) return archived;
    fs.mkdirSync(directory, {recursive: true});
    archived = frames.map((frame, index) => {
      const name = 'frame-' + String(index).padStart(4, '0') + '.png';
      fs.writeFileSync(path.join(directory, name), frame.bytes);
      return {index, name, metadata: frame.metadata, swapAt: frame.metadata.timestamp * 1000,
        sha256: createHash('sha256').update(frame.bytes).digest('hex')};
    });
    fs.writeFileSync(path.join(directory, 'frames.json'), JSON.stringify(archived, null, 2) + '\n');
    return archived;
  };
  const receive = event => {
    frames.push({metadata: event.metadata, bytes: Buffer.from(event.data, 'base64')});
    void client.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(error => {if (!stopped) errors.push(error.message);});
  };
  client.on('Page.screencastFrame', receive);
  await client.send('Page.startScreencast', {format: 'png', everyNthFrame: 1});
  return {
    async stop() {
      if (stopped) return {frameCount: archived?.length}; stopped = true;
      await client.send('Page.stopScreencast'); client.off('Page.screencastFrame', receive);
      await client.detach();
      archive(); return {frameCount: archived.length};
    },
    analyze(samples, timeOrigin, gestures) {
      assert.equal(errors.length, 0, 'Every observed frame must be acknowledged');
      const files = archive();
      for (const frame of frames) {
        assert(Number.isFinite(frame.metadata.timestamp), 'Frame swap epoch timestamp is required; no DOM-time fallback');
      }
      const cache = new Map();
      const ordered = [...files].sort((a, b) => a.swapAt - b.swapAt);
      const imageFor = frame => {
        if (cache.has(frame.index)) return cache.get(frame.index);
        const image = PNG.sync.read(frames[frame.index].bytes);
        assert.equal(image.width, 1440); assert.equal(image.height, 960);
        assert.equal(frame.metadata.offsetTop, 0); assert.equal(frame.metadata.pageScaleFactor, 1);
        cache.set(frame.index, image); if (cache.size > 4) cache.delete(cache.keys().next().value);
        return image;
      };
      const evidence = samples.map((sample, index) => {
        const gesture = gestures[index], inputAt = timeOrigin + sample.firstMoveAt;
        const endAt = timeOrigin + (samples[index + 1]?.downAt ?? sample.secondFrame + 100);
        let prior, moved;
        ordered.filter(frame => frame.swapAt < inputAt).reverse().find(frame => {
          const border = borderPosition(imageFor(frame), gesture.rect, gesture.color);
          if (!border || Math.abs(border.x - gesture.rect.x) > 2) return false;
          prior = {frame, border}; return true;
        });
        assert(prior, 'The actual stationary border must be visible in a frame before the original input');
        ordered.filter(frame => frame.swapAt >= inputAt && frame.swapAt < endAt).find(frame => {
          const border = borderPosition(imageFor(frame), gesture.rect, gesture.color);
          if (!border || (border.x - prior.border.x) * gesture.direction < 2) return false;
          moved = {frame, border}; return true;
        });
        assert(moved, 'A rendered frame must show the original card moving in the requested direction');
        const durationMs = moved.frame.swapAt - inputAt;
        assert(durationMs >= 0 && durationMs < 10000);
        return {index: index + 1, inputAt, input: sample.inputEvents[0], rect: gesture.rect, color: gesture.color,
          baseline: {frame: prior.frame.name, swapAt: prior.frame.swapAt, border: prior.border},
          moved: {frame: moved.frame.name, swapAt: moved.frame.swapAt, border: moved.border},
          durationMs, rafUpperBoundMs: sample.feedbackUpperBoundMs};
      });
      return {method: 'PNG leader solid-border movement by at least two pixels; CDP frame swap epoch timestamp minus original pointer event epoch; no DOM/RAF fallback',
        frameCount: frames.length, samples: evidence, p95Ms: [...evidence].sort((a, b) => a.durationMs - b.durationMs)[Math.ceil(evidence.length * 0.95) - 1].durationMs};
    },
  };
}
module.exports = {borderPosition, observeFrames};
