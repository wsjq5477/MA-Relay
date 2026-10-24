// Current frozen frontend/backend, actual Windows pointer input, controlled 20/60 catalog.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const assert = require('node:assert/strict');
const {randomUUID, createHash} = require('node:crypto');
const {chromium, expect} = require('../node_modules/@playwright/test');
const {graphFixture} = require('./i06b-ui-fixture.cjs');
const [bridge, frontend, output, version = require('../package.json').version] = process.argv.slice(2);
if (process.platform !== 'win32' || !output) throw Error('Windows, frozen backend/frontend and output required');
fs.mkdirSync(output, {recursive: true});
const report = {date: new Date().toISOString(), version, status: 'running', modelCalls: 0,
  frontendKind: process.env.AGENTBRIDGE_METRIC_FRONTEND_KIND || 'frozen app.asar production frontend',
  scope: 'Production package frontend/Coordinator/AgentNetwork; controlled machines and local durable catalog, real Windows Edge pointer/paint. Not independent SSH/LAN or native-model evidence',
  hardware: {os: os.release(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryBytes: os.totalmem()},
  viewport: {width: 1440, height: 960}, theme: 'light', checks: [], errors: []};
let fixture, browser, page, server, frameObserver, profiler, timeline, measurementObserver;
const gestures = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
(async () => {
  report.resources = Object.fromEntries(['agent-network.cjs', 'coordinator-service.cjs'].map(file => [file, hash(path.join(bridge, 'desktop/electron', file))]));
  report.frontendIndexSha256 = hash(path.join(frontend, 'index.html'));
  fixture = await graphFixture({runtimeRoot: bridge}); await fixture.inject('scale');
  let snapshot = await fixture.router.snapshot();
  report.catalog = {machines: snapshot.machines.length, nodes: snapshot.nodes.length};
  assert.equal(snapshot.machines.length, 20); assert.equal(snapshot.nodes.length, 60);
  const leader = snapshot.nodes.find(node => node.adapter === 'claude' && snapshot.machines.find(machine => machine.machineId === node.machineId)?.kind === 'windows');
  await fixture.router.call('saveCollaboration', {operationId: randomUUID(), expectedRevision: snapshot.collaboration.revision, leaderId: leader.nodeId, memberIds: snapshot.nodes.filter(node => node.nodeId !== leader.nodeId).map(node => node.nodeId)});
  const relation = structuredClone(fixture.router.network.collaboration);
  server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(frontend, relative);
    if (!file.startsWith(path.resolve(frontend) + path.sep)) return res.writeHead(403).end();
    try {res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file));}
    catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const diagnosticSoftwareRendering = process.env.AGENTBRIDGE_GRAPH_DISABLE_GPU === '1';
  report.rendererMode = diagnosticSoftwareRendering ? 'diagnostic software rendering (--disable-gpu); not the default product runtime' : 'default browser rendering';
  browser = await chromium.launch({executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
    args: diagnosticSoftwareRendering ? ['--disable-gpu'] : []});
  report.browserVersion = browser.version();
  page = await browser.newPage({viewport: report.viewport, reducedMotion: 'reduce'});
  page.on('pageerror', error => report.errors.push(error.message));
  await page.exposeFunction('metricBridgeCall', (method, params) => fixture.call(method, params));
  await page.exposeFunction('commitMetricName', label => {
    fixture.router.node(leader.nodeId).name = label; fixture.router.saveNetwork();
    const persisted = JSON.parse(fs.readFileSync(fixture.router.networkFile, 'utf8'));
    assert.equal(persisted.nodes.find(node => node.nodeId === leader.nodeId).name, label);
    return {confirmedAt: Date.now(), persisted: true};
  });
  await page.addInitScript(version => {window.agentbridge = {
    call: (method, params = {}) => window.metricBridgeCall(method, params),
    preferences: async () => ({theme: 'light', platform: 'win32', version, directory: ''}),
    runtimes: async () => ({distributions: ['Ubuntu']}), pending: async () => [],
    recoverPending: async () => ({resolved: 0}), savePreferences: async value => value, closeWindow: async () => {}, stop: async () => {},
  };}, report.version);
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.getByRole('button', {name: '关系图', exact: true}).click();
  await expect(page.locator('.graph-machine')).toHaveCount(20);
  await expect(page.locator('.graph-tool')).toHaveCount(60);
  await expect(page.locator('.react-flow__edge')).toHaveCount(59);
  await expect(page.locator('.graph-view-tools').getByText('布局已保存', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '适配全图', exact: true}).click();
  await expect(page.locator('.graph-view-tools').getByText('布局已保存', {exact: true})).toBeVisible();
  await page.waitForTimeout(300);
  // Focus through the actual UI without filtering away the other 57 nodes.
  await page.getByRole('button', {name: '定位主节点', exact: true}).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.graph-view-tools').getByText('布局已保存', {exact: true})).toBeVisible();
  const selector = '.react-flow__node[data-id="' + leader.nodeId + '"]';
  if (process.env.AGENTBRIDGE_GRAPH_GEOMETRY_ONLY === '1') {
    await expect(page.locator('.network-notice').filter({hasText: '布局已保存。'})).toHaveCount(0, {timeout: 6000});
    const observation = page.evaluate(() => new Promise(resolve => {
      const start = performance.now(), samples = []; let previous;
      const observe = () => {
        const top = document.querySelector('.graph-canvas').getBoundingClientRect().top;
        const notice = document.querySelector('.network-notice')?.textContent || '';
        const value = JSON.stringify({top, notice});
        if (value !== previous) {samples.push({at: performance.now(), top, notice}); previous = value;}
        if (performance.now() - start < 5000) requestAnimationFrame(observe); else resolve(samples);
      }; observe();
    }));
    const before = (await fixture.router.call('graphLayout')).layoutRevision;
    const title = await page.locator(selector + ' .graph-tool-title').boundingBox(); assert(title);
    const x = title.x + title.width * 0.4, y = title.y + title.height * 0.5;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 20, y + 12, {steps: 6}); await page.mouse.up();
    const samples = await observation, tops = samples.map(sample => sample.top);
    report.layoutGeometry = {samples, maximumShiftPx: Math.max(...tops) - Math.min(...tops)};
    assert((await fixture.router.call('graphLayout')).layoutRevision > before, 'The actual pointer movement must be durably saved');
    assert.equal(fixture.router.network.requests.length, 0);
    assert(report.layoutGeometry.maximumShiftPx <= 0.5, 'Automatic layout-save feedback must not move the canvas under the pointer');
    report.checks.push('Confirmed automatic layout save keeps the same canvas geometry across feedback and expiry');
    report.status = 'passed'; return;
  }
  report.timeOrigin = await page.evaluate(() => performance.timeOrigin);
  if (process.env.AGENTBRIDGE_GRAPH_FRAMES === '1') {
    frameObserver = await require('./graph-frame-observer.cjs').observeFrames(page, path.join(output, 'frames'));
    await frameObserver.ready();
    await page.waitForTimeout(200);
  }
  if (process.env.AGENTBRIDGE_GRAPH_PROFILE === '1') {
    report.diagnosticProfiling = true;
    profiler = await page.context().newCDPSession(page);
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.start');
  }
  if (process.env.AGENTBRIDGE_GRAPH_TRACE === '1') {
    report.diagnosticTimeline = true;
    timeline = await require('./graph-drag-profiler.cjs').traceDrags(page, output);
  } else if (process.env.AGENTBRIDGE_GRAPH_MEASUREMENTS === '1') {
    measurementObserver = await require('./graph-drag-profiler.cjs').measureDrags(page, output);
  }
  await page.evaluate(selector => {
    const node = document.querySelector(selector);
    window.metricDrags = []; window.metricLongTasks = []; let active;
    document.addEventListener('pointerdown', event => {
      if (event.target.closest(selector)) active = {downAt: event.timeStamp, before: node.style.transform, inputEvents: []};
    }, true);
    document.addEventListener('pointermove', event => {
      if (!active || event.buttons !== 1 || active.completed) return;
      active.firstMoveAt ??= event.timeStamp;
      active.inputEvents.push({timeStamp: event.timeStamp, x: event.clientX, y: event.clientY, buttons: event.buttons});
    }, true);
    new MutationObserver(() => {
      const sample = active;
      if (!sample?.firstMoveAt || sample.completed || sample.before === node.style.transform) return;
      sample.completed = true; sample.mutatedAt = performance.now(); sample.after = node.style.transform;
      requestAnimationFrame(firstFrame => requestAnimationFrame(secondFrame => {
        window.metricDrags.push({...sample, firstFrame, secondFrame, feedbackUpperBoundMs: secondFrame - sample.firstMoveAt});
      }));
    }).observe(node, {attributes: true, attributeFilter: ['style']});
    new PerformanceObserver(list => window.metricLongTasks.push(...list.getEntries().map(entry => ({startTime: entry.startTime, duration: entry.duration})))).observe({type: 'longtask', buffered: false});
  }, selector);
  for (let index = 0; index < 20; index++) {
    const revisionBefore = (await fixture.router.call('graphLayout')).layoutRevision;
    const box = await page.locator(selector + ' .graph-tool-title').boundingBox(); assert(box);
    if (frameObserver) gestures.push(await page.locator(selector + ' .graph-tool').evaluate((node, index) => {
      const rect = node.getBoundingClientRect(), color = getComputedStyle(node).borderLeftColor.match(/\d+/g).slice(0, 3).map(Number);
      return {rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}, color, direction: index % 2 ? -1 : 1};
    }, index));
    const x = box.x + box.width * 0.4, y = box.y + box.height * 0.5;
    const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest('.react-flow__node')?.getAttribute('data-id'), {x, y});
    assert.equal(hit, leader.nodeId, 'Real pointer coordinates must hit the visible original node');
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + (index % 2 ? -12 : 12), y + (index % 2 ? -8 : 8), {steps: 8});
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.metricDrags.length)).toBe(index + 1);
    await expect(page.locator('.graph-view-tools').getByText('布局已保存', {exact: true})).toBeVisible();
    await expect.poll(async () => (await fixture.router.call('graphLayout')).layoutRevision).toBeGreaterThan(revisionBefore);
    await expect(page.locator('.graph-tool')).toHaveCount(60);
    await expect(page.locator('.graph-machine')).toHaveCount(20);
  }
  const drag = await page.evaluate(() => ({samples: window.metricDrags, longTasks: window.metricLongTasks, zoom: new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a}));
  await timeline?.stop();
  if (profiler) {
    const {profile} = await profiler.send('Profiler.stop');
    fs.writeFileSync(path.join(output, 'drag-cpu-profile.json'), JSON.stringify(profile) + '\n');
    await profiler.detach(); profiler = null;
  }
  report.graph = {...drag, gestures, machines: 20, nodes: 60, edges: 59,
    p95Ms: percentile(drag.samples.map(sample => sample.feedbackUpperBoundMs), 0.95),
    maximumLongTaskMs: Math.max(0, ...drag.longTasks.map(entry => entry.duration))};
  if (measurementObserver) report.graph.textMeasurements = await measurementObserver.stop();
  if (process.env.AGENTBRIDGE_EXPECT_RETAINED_EDGES === '1') {
    assert.equal(report.graph.textMeasurements?.count, 0, 'Stable edge labels must not remount and remeasure while only coordinates change');
    report.checks.push('All existing edge labels retain their measured DOM across 20 coordinate-only drags');
  }
  if (frameObserver) {
    await frameObserver.stop();
    report.graph.presentation = frameObserver.analyze(drag.samples, report.timeOrigin, gestures);
  }
  assert.equal(drag.samples.length, 20); assert(drag.samples.every(sample => sample.before !== sample.after && sample.inputEvents.length > 0));
  assert.deepEqual(fixture.router.network.collaboration, relation);
  await page.screenshot({path: path.join(output, 'graph-20-machines.png'), fullPage: true});
  report.checks.push('20 actual pointer drags with all 20 machines/60 nodes/59 edges retained, raw input/style/next-frame records and unchanged authorization');
  report.sync = {samples: [], scope: 'Confirmed local AgentNetwork atomic persistence -> normal frontend polling -> next rendered frame; controlled catalog, no SSH/LAN latency'};
  for (let index = 0; index < 20; index++) {
    const label = '同步样本 ' + String(index + 1).padStart(2, '0');
    const sample = await page.evaluate(async ({selector, label}) => {
      const title = document.querySelector(selector + ' .graph-tool-title strong');
      return new Promise((resolve, reject) => {
        let committed, scheduled = false;
        const timer = setTimeout(() => {observer.disconnect(); reject(Error('Original persisted change not observed'));}, 10000);
        const check = () => {
          if (!committed || title.textContent !== label || scheduled) return;
          scheduled = true; const observedAt = Date.now();
          requestAnimationFrame(() => requestAnimationFrame(() => {
            observer.disconnect(); clearTimeout(timer);
            resolve({label, ...committed, observedAt, renderedAt: Date.now(), durationMs: Date.now() - committed.confirmedAt});
          }));
        };
        const observer = new MutationObserver(check); observer.observe(title, {childList: true, characterData: true, subtree: true});
        window.commitMetricName(label).then(value => {committed = value; check();}, error => {clearTimeout(timer); observer.disconnect(); reject(error);});
      });
    }, {selector, label});
    assert(sample.persisted); assert(sample.durationMs >= 0); report.sync.samples.push(sample);
  }
  report.sync.p95Ms = percentile(report.sync.samples.map(sample => sample.durationMs), 0.95);
  snapshot = await fixture.router.snapshot();
  assert.equal(snapshot.tasks.length, 0); assert.equal(snapshot.delegations.length, 0);
  assert.equal(fixture.router.network.requests.length, 0); assert.deepEqual(fixture.router.network.collaboration, relation);
  assert.deepEqual(report.errors, []);
  report.checks.push('20 confirmed durable catalog changes reach the production DOM through normal polling, no task or delegation requests');
  const graphP95 = report.graph.presentation?.p95Ms ?? report.graph.p95Ms;
  assert(graphP95 <= 100, 'Graph rendered feedback p95 exceeds 100ms');
  assert(report.graph.maximumLongTaskMs <= 500, 'Graph main-thread stall exceeds 500ms');
  assert(report.sync.p95Ms <= 2000, 'Local durable state-to-render p95 exceeds 2s');
  report.status = 'passed';
})().catch(async error => {report.status = 'failed'; report.error = error.message; process.exitCode = 1; try {report.partial = await page?.evaluate(() => ({samples: window.metricDrags, longTasks: window.metricLongTasks, composerVisible: !!document.querySelector('.compose-dialog')})); await page?.screenshot({path: path.join(output, 'failure.png'), fullPage: true});} catch {}})
  .finally(async () => {await measurementObserver?.stop().catch(error => {report.measurementArchiveError = error.message; report.status = 'failed'; process.exitCode = 1;}); await timeline?.stop(); await profiler?.detach(); await frameObserver?.stop(); await browser?.close(); fixture?.close(); if (server) await new Promise(resolve => server.close(resolve)); fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({status: report.status, checks: report.checks.length, graphP95: report.graph?.presentation?.p95Ms ?? report.graph?.p95Ms, rafUpperBoundP95: report.graph?.p95Ms, syncP95: report.sync?.p95Ms, error: report.error}));});
