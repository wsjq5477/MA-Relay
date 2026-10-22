'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {randomUUID} = require('node:crypto');
const fail = (code, message) => Object.assign(new Error(message), {code});
function nativeHome(options = {}) {
  const env = options.environment || process.env;
  const configured = env.OPENDESK_CONFIG_DIRECTORY || env.OPENDDESK_CONFIG_DIRECTORY;
  if (configured) return path.resolve(configured);
  const suffix = env.OPENDESK_DEBUG_MODE === '1' ? '-debug' : '';
  return env.APPDATA ? path.join(env.APPDATA, 'opendesk' + suffix) : path.join(options.home || os.homedir(), '.opendesk' + suffix);
}
const settingsFile = options => path.join(nativeHome(options), 'setting.json');
function json(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw fail('OPENDESK_CONFIG', 'OpenDesk 配置文件不可用。');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function desktopConfig(file, options = {}) {
  const setting = json(file), config = setting.applications?.devicemgr || {};
  let host = (config.host || '127.0.0.1').trim().toLowerCase();
  if (config.enabled === false || ['none', 'off', 'disabled', '无'].includes(host)) throw fail('OPENDESK_GATEWAY_DISABLED', '请在 OpenDesk 原生设置中启用设备网关。');
  if (['*', '0.0.0.0'].includes(host)) host = '127.0.0.1';
  if (host === '::') host = '[::1]';
  if (host === '::1') host = '[::1]';
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) throw fail('OPENDESK_CONNECTION', 'OpenDesk 桌面接入需要本机网关地址。');
  const port = config.port ?? 19010;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw fail('OPENDESK_CONFIG', 'OpenDesk 网关端口无效。');
  const identity = json(path.join(path.dirname(file), 'apps', 'devicemgr', 'identity', 'device.json'));
  if (!/^[a-f0-9]{64}$/.test(identity.deviceId)) throw fail('OPENDESK_IDENTITY', '请先运行 OpenDesk 原生设备网关以建立身份。');
  const env = options.environment || process.env;
  let workspace = setting.default_workspace;
  try { if (!workspace || !fs.statSync(workspace).isDirectory()) workspace = null; } catch { workspace = null; }
  if (!workspace) workspace = (options.platform || process.platform) === 'win32'
    ? path.join(env.USERPROFILE || env.HOME || options.home || os.homedir(), 'opendesk') : path.join(path.dirname(file), 'workspace');
  return {origin: 'ws://' + host + ':' + port, deviceId: identity.deviceId, workspace: path.resolve(workspace)};
}
function alive(state) {
  if (!state?.pid || Date.now() - Date.parse(state.time) > 5000 || state.protocol !== 'opendesk-existing-v1') return false;
  try { process.kill(state.pid, 0); return true; } catch { return false; }
}
function controller(root) { try { const state = json(path.join(root, 'controller.json')); return alive(state) ? state : null; } catch { return null; } }
async function httpClient(service, workspace) {
  const url = new URL(service.origin);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/' || url.search || url.hash || url.username || url.password || !service.password) throw fail('OPENDESK_CONNECTION', 'Bridge 保存的 OpenDesk 原服务连接无效。');
  const headers = {'content-type': 'application/json', authorization: 'Basic ' + Buffer.from('opencode:' + service.password).toString('base64'), 'x-opencode-directory': encodeURIComponent(workspace)};
  async function request(route, body, options = {}) {
    const response = await fetch(service.origin + route, {method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: options.signal || AbortSignal.timeout(options.timeout || 12000), redirect:'error'});
    if (!response.ok) throw fail('OPENDESK_HTTP', 'OpenDesk 原接口未确认此操作（HTTP ' + response.status + '）。');
    let size = 0; const chunks = [];
    for await (const chunk of response.body) { size += chunk.length; if (size > 8 * 1024 * 1024) throw fail('OPENDESK_PROTOCOL', 'OpenDesk 回应超出核对上限。'); chunks.push(Buffer.from(chunk)); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const health = await request('/global/health');
  if (health?.healthy !== true) throw fail('OPENDESK_PROTOCOL', 'OpenDesk 原生 HTTP 服务尚未就绪。');
  return {request};
}
async function desktopClient(config) {
  const socket = new WebSocket(config.origin), pending = new Map(), listeners = new Set(), closed = new Set();
  let dead = false, connectionId, connectId;
  const close = () => { socket.close(); };
  function request(method, params = {}) {
    if (dead) return Promise.reject(fail('OPENDESK_DISCONNECTED', 'OpenDesk 原桌面连接已断开，不能重建原会话。'));
    return new Promise((resolve, reject) => {
      const id = randomUUID(), timer = setTimeout(() => {pending.delete(id); reject(fail('OPENDESK_TIMEOUT', 'OpenDesk 桌面接口回应超时。'));}, 12000);
      pending.set(id, {resolve, reject, timer});
      try { socket.send(JSON.stringify({type:'req', id, method, params})); } catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {close(); reject(fail('OPENDESK_TIMEOUT', 'OpenDesk 桌面网关连接超时。'));}, 6000);
    const broken = () => {
      dead = true; clearTimeout(timer); reject(fail('OPENDESK_DISCONNECTED', 'OpenDesk 原桌面通道已断开。'));
      for (const item of pending.values()) {clearTimeout(item.timer); item.reject(fail('OPENDESK_DISCONNECTED', 'OpenDesk 原桌面通道已断开。'));} pending.clear();
      for (const fn of closed) fn();
    };
    socket.addEventListener('error', broken); socket.addEventListener('close', broken);
    socket.addEventListener('message', event => {
      try {
        if (typeof event.data !== 'string' || Buffer.byteLength(event.data) > 1048576) throw Error();
        const frame = JSON.parse(event.data);
        if (frame.type === 'event' && frame.event === 'connect.challenge' && !connectId) {
          connectId = randomUUID(); socket.send(JSON.stringify({type:'req', id:connectId, method:'connect', params:{minProtocol:3,maxProtocol:4,client:{id:'agentbridge',version:'1',platform:process.platform,mode:'operator'},role:'operator',scopes:[]}}));
        }
        if (frame.type === 'res' && frame.id === connectId) {
          if (!frame.ok || frame.payload?.type !== 'hello-ok' || !frame.payload.server?.connId || !['chat.send','chat.history','chat.abort'].every(m=>frame.payload.features?.methods?.includes(m))) throw Error();
          connectionId = frame.payload.server.connId; clearTimeout(timer); resolve();
        } else if (frame.type === 'res' && pending.has(frame.id)) {
          const item = pending.get(frame.id); pending.delete(frame.id); clearTimeout(item.timer);
          frame.ok ? item.resolve(frame.payload) : item.reject(fail('OPENDESK_NATIVE', 'OpenDesk 原接口拒绝了此操作。'));
        } else if (frame.type === 'event') for (const fn of listeners) fn(frame);
      } catch {close(); broken();}
    });
  });
  try {
    await ready;
    const identity = await request('gateway.identity.get');
    if (identity?.deviceId !== config.deviceId) throw fail('OPENDESK_IDENTITY', '网关不属于此 OpenDesk 安装，未发送需求。');
  } catch (error) {close(); throw error;}
  return {request, connectionId, close, get dead(){return dead;}, onEvent(fn){listeners.add(fn);return()=>listeners.delete(fn);}, onClose(fn){closed.add(fn);return()=>closed.delete(fn);}};
}
async function discover(options = {}) {
  if ((options.platform || process.platform) !== 'win32') return [];
  const file = settingsFile(options);
  if (!fs.existsSync(file)) return [];
  const base = {adapter:'opendesk-desktop',name:'OpenDesk Desktop',executable:file};
  try { const config=desktopConfig(file,options),c=await desktopClient(config);c.close();return [{...base,healthy:true,version:'gateway-existing-v1'}]; }
  catch(error){return [{...base,healthy:false,errorCode:error.code||'OPENDESK_CONNECTION',error:'请运行 OpenDesk 桌面版并核对设备网关；原安装及配置不会被修改。'}];}
}
module.exports = {nativeHome,settingsFile,desktopConfig,httpClient,desktopClient,controller,alive,discover};
