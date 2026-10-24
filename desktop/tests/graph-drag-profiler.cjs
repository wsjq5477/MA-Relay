// Explicit isolated acceptance diagnostics; never loaded by the product.
const fs = require('node:fs'), path = require('node:path');
async function measureDrags(page, directory) {
  await page.evaluate(() => {
    const original = SVGGraphicsElement.prototype.getBBox;
    window.metricTextMeasurements = [];
    SVGGraphicsElement.prototype.getBBox = function (...args) {
      const start = performance.now(), result = original.apply(this, args);
      window.metricTextMeasurements.push({at: start, durationMs: performance.now() - start,
        className: this.getAttribute('class'), text: this.textContent?.slice(0, 80),
        stack: window.metricTextMeasurements.length < 3 ? new Error().stack : undefined});
      return result;
    };
  });
  let result;
  return {async stop() {
    if (result) return result;
    const measurements = await page.evaluate(() => window.metricTextMeasurements);
    fs.writeFileSync(path.join(directory, 'text-measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
    result = {count: measurements.length, durationMs: measurements.reduce((sum, value) => sum + value.durationMs, 0)};
    return result;
  }};
}
async function traceDrags(page, directory) {
  const measurements = await measureDrags(page, directory);
  const client = await page.context().newCDPSession(page);
  await client.send('Tracing.start', {categories: '-*,devtools.timeline,blink.user_timing,cc,viz,input,benchmark,disabled-by-default-devtools.timeline.frame', transferMode: 'ReturnAsStream'});
  let stopped = false;
  return {async stop() {
    if (stopped) return; stopped = true;
    const complete = new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
    await client.send('Tracing.end');
    const {stream} = await complete;
    const chunks = []; let eof = false;
    while (!eof) {
      const part = await client.send('IO.read', {handle: stream});
      chunks.push(Buffer.from(part.data, part.base64Encoded ? 'base64' : 'utf8')); eof = part.eof;
    }
    await client.send('IO.close', {handle: stream}); await client.detach();
    fs.writeFileSync(path.join(directory, 'drag-timeline.json'), Buffer.concat(chunks));
    await measurements.stop();
  }};
}
module.exports = {traceDrags, measureDrags};
