const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const fail = (code, message) => Object.assign(new Error(message), { code });
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const emptyLayout = () => ({ version: 1, layoutRevision: 0, groups: {}, nodes: {}, viewport: { x: 0, y: 0, zoom: 1 } });
function operationId(id) {
  if (typeof id !== 'string' || !id || id.length > 128) throw fail('INVALID_INPUT', '保存需要稳定操作 ID。');
}
function replaceFile(source,target) {
  const pause=new Int32Array(new SharedArrayBuffer(4));
  for(let attempt=0;;attempt++){
    try{fs.renameSync(source,target);return;}
    catch(error){
      if(attempt>=5||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;
      // Short Windows sharing violations must not turn a durable intent into
      // an ambiguous dispatch. Keep the replacement atomic and the wait bounded.
      Atomics.wait(pause,0,0,20*(attempt+1));
    }
  }
}
function atomicWrite(file, value) {
  const tmp = file + '.' + randomUUID() + '.tmp';
  try {
    const fd=fs.openSync(tmp,'wx',0o600);
    try { fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    replaceFile(tmp,file);
  }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
class GraphLayoutStore {
  constructor(directory) {
    this.file = path.join(directory, 'graph-layout.json');
    this.state = { version: 1, layout: emptyLayout(), operations: [] };
    if (fs.existsSync(this.file)) {
      try {
        const state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (state.version !== 1 || !Array.isArray(state.operations)) throw Error('Invalid layout');
        this.validate(state.layout);
        this.state = state;
      } catch {
        this.warning = '布局记录损坏，已保留副本并恢复默认布局；授权和历史不受影响。';
        fs.copyFileSync(this.file, this.file + '.corrupt-' + randomUUID());
      }
    }
  }
  validate(layout, machines, nodes) {
    if (!layout || layout.version !== 1 || !Number.isSafeInteger(layout.layoutRevision) || layout.layoutRevision < 0)
      throw fail('INVALID_INPUT', '布局版本或修订不合法。');
    const point = (p, relative = false) => p && typeof p === 'object' && Object.keys(p).every(k => ['x', 'y'].includes(k))
      && [p.x, p.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1000000 && (!relative || n >= 0));
    for (const [key, known, limit] of [['groups', machines, 1024], ['nodes', nodes, 4096]]) {
      const rows = layout[key];
      if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.keys(rows).length > limit)
        throw fail('INVALID_INPUT', '布局条目不合法或过多。');
      for (const [id, p] of Object.entries(rows)) {
        if (!point(p, key === 'nodes') || ['__proto__', 'prototype', 'constructor'].includes(id) || (known && !known.includes(id)))
          throw fail('INVALID_INPUT', '布局引用未知节点/机器，或坐标不合法。');
      }
    }
    const v = layout.viewport;
    if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || Math.abs(v.x) > 1000000 || Math.abs(v.y) > 1000000 || !Number.isFinite(v.zoom) || v.zoom < .25 || v.zoom > 2)
      throw fail('INVALID_INPUT', '视图缩放或坐标不合法。');
    if (Object.keys(layout).some(k => !['version', 'layoutRevision', 'groups', 'nodes', 'viewport'].includes(k)) || Object.keys(v).some(k => !['x', 'y', 'zoom'].includes(k)))
      throw fail('INVALID_INPUT', '布局只能包含位置与视口。');
  }
  get() { return structuredClone({ ...this.state.layout, ...(this.warning ? { warning: this.warning } : {}) }); }
  operation(id) { operationId(id); return structuredClone(this.state.operations.find(o => o.operationId === id) || { operationId: id, state: 'not_found' }); }
  save(params, machines, nodes) {
    operationId(params.operationId);
    const fingerprint = digest({ expectedLayoutRevision: params.expectedLayoutRevision, layout: params.layout });
    const prior = this.state.operations.find(o => o.operationId === params.operationId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw fail('OPERATION_CONFLICT', '原布局操作 ID 已用于其他内容，请查询原操作。');
      return structuredClone(prior);
    }
    if (params.expectedLayoutRevision !== this.state.layout.layoutRevision) throw fail('LAYOUT_REVISION_CONFLICT', '另一窗口已更新布局，请读取最新布局后再保存。');
    if (this.state.operations.length >= 4096) throw fail('OPERATION_LIMIT', '布局收据达到上限，请保留记录并联系维护者。');
    this.validate(params.layout, machines, nodes);
    const layout = structuredClone({ ...params.layout, layoutRevision: this.state.layout.layoutRevision + 1 });
    const receipt = { operationId: params.operationId, state: 'confirmed', fingerprint, data: layout };
    const next = { version: 1, layout, operations: [...this.state.operations, receipt] };
    atomicWrite(this.file, next);
    this.state = next; this.warning = undefined;
    return structuredClone(receipt);
  }
}
module.exports = { GraphLayoutStore, atomicWrite, digest, operationId };
