import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, dirname, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const userDocRoot = resolve(repositoryRoot, 'doc/user');
export const userPages = [
  ['index.md', '文档首页'], ['quickstart.md', '快速开始'],
  ['product.md', '产品功能'], ['architecture.md', '系统设计'],
  ['machines.md', '机器与 Agent'], ['sessions.md', '任务与会话'],
  ['collaboration.md', '关系与协作'], ['materials.md', '工作材料'],
  ['agents/index.md', '原生 Agent 适配'], ['agents/claude.md', 'Claude Code'],
  ['agents/codex.md', 'Codex'], ['agents/opencode.md', 'OpenCode'],
  ['agents/opendesk.md', 'OpenDesk'], ['agents/hermes.md', 'Hermes'], ['agents/pi.md', 'Pi'], ['agents/dsh.md', 'DSH'],
  ['integration-methods.md', '接入方式比较'], ['connections.md', 'MCP 与连接授权'],
];
export const publishedFiles = new Set(userPages.map(([file]) => file));
export const publishedAssets = ['agentbridge.png'];
export const generatedFragments = ['connection-table.md', 'capability-table.md'];
const require = createRequire(import.meta.url);
const descriptors = () => require('../desktop/electron/builtin-adapters.cjs').adapters.list();
const identities = [
  ['claude', 'Claude Code'], ['opencode', 'OpenCode'], ['codex', 'Codex'],
  ['hermes', 'Hermes'], ['pi', 'Pi'], ['dsh', 'DSH CLI'],
  ['dsh-desktop', 'DSH Desktop'], ['dsh-web', 'DSH Web'],
  ['opendesk', 'OpenDesk CLI'], ['opendesk-desktop', 'OpenDesk Desktop'],
];

// Use the current repository matrix as the single inventory of integration
// methods; do not publish its implementation notes, evidence or planning rows.
export function connectionTable() {
  const text = readFileSync(resolve(repositoryRoot, 'doc/agent-integration-matrix.md'), 'utf8');
  const lines = text.split('\n'), start = lines.findIndex(line => /^\| Agent \/ 入口 \| 原生 CLI \|/.test(line));
  if (start < 0) throw Error('Agent接入矩阵缺少方式总结表');
  const rows = [];
  for (const line of lines.slice(start + 2)) {if (!line.startsWith('|')) break; rows.push(line.split('|').slice(1, -1).map(cell => cell.trim()));}
  const actual = descriptors();
  if (rows.length !== identities.length || actual.length !== identities.length || identities.some(([id]) => !actual.some(row => row.id === id))) throw Error('用户接入总结必须同步全部已注册入口');
  const matrixNames = ['Claude Code', 'OpenCode', 'Codex', 'Hermes Agent', 'Pi', 'DSH CLI', 'DSH Windows Desktop', 'DSH Linux / WSL Web', 'OpenDesk CLI', 'OpenDesk Windows Desktop'];
  if (rows.some((row, index) => row[0] !== matrixNames[index])) throw Error('接入矩阵入口与用户汇总不一致');
  return '| Agent / 入口 | 原生 CLI | 原生 API | MCP | ACP | 插件 | SDK |\n| --- | --- | --- | --- | --- | --- | --- |\n'
    + rows.map((row, i) => {
      if (row.length !== 7 || !/已接入|未接入/.test(row[1])) throw Error('接入矩阵表格格式不符');
      return '| ' + [identities[i][1], ...row.slice(1).map((cell, column) => cell.includes('未接入') ? '—' : cell.includes('已接入') ? column === 0 && cell.includes('启动') ? '启动服务' : column === 1 ? cell.includes('WebSocket') ? 'WebSocket' : 'HTTP' : '✓' : (() => {throw Error('未知接入状态：' + cell);})())].join(' | ') + ' |';
    }).join('\n') + '\n';
}
export function capabilityTable() {
  // Capability names follow the reviewed registry. `mcpClient` is the current
  // name for "can call the AgentBridge MCP"; `bridgeMcp` stays a fallback for an
  // older descriptor projection.
  const all = descriptors(), keys = ['execution', 'resume', 'cancellation', 'delegation', 'mcpClient', 'permissions'];
  const capability = (row, key) => row.capabilities[key] === true || (key === 'mcpClient' && row.capabilities.bridgeMcp === true);
  return '| Agent / 入口 | 直接会话 | 续聊 | 取消 | 被委派 | 调用 Bridge MCP | 权限回复 |\n| --- | --- | --- | --- | --- | --- | --- |\n'
    + identities.map(([id, name]) => '| ' + [name, ...keys.map(key => capability(all.find(row => row.id === id), key) ? '✓' : '—')].join(' | ') + ' |').join('\n') + '\n';
}
export const internalText = /\b(?:AB-F\d+|M\d{2}(?:-(?:OC|CC|CX))?-F\d+|T-M\d{2}(?:-[A-Z]+)?-\d+|CT-\d+|I\d{2}[A-Z]?)\b|测试报告|验收记录|交付记录|迭代记录|开发过程|历史记录|冻结源码|受控测试|缺陷复盘/;
function markdownFiles(folder) {
  return readdirSync(folder, {withFileTypes: true}).flatMap(item => item.name.startsWith('.') || ['public', '_generated'].includes(item.name) ? [] : item.isDirectory() ? markdownFiles(resolve(folder, item.name)) : item.isFile() && item.name.endsWith('.md') ? [relative(userDocRoot, resolve(folder, item.name)).split(sep).join('/')] : []);
}
export function validateUserDocs() {
  const files = markdownFiles(userDocRoot);
  if (files.length !== publishedFiles.size || files.some(file => !publishedFiles.has(file))) throw Error('用户站点存在未登记或缺失页面');
  for (const file of files) {
    const text = readFileSync(resolve(userDocRoot, file), 'utf8');
    validatePublicPage(file, text);
  }
  return {pages: files.length, generatedTables: generatedFragments.length};
}
export function validatePublicPage(file, text) {
  if (internalText.test(text)) throw Error('用户正文出现内部过程或编号：' + file);
  if (/<(?:a|img|iframe|script|object)\b/i.test(text) || /\]\s*\[[^\]]*\]|^\s*\[[^\]]+\]:/m.test(text)) throw Error('用户链接必须使用可校验的 Markdown 内联格式：' + file);
  for (const link of text.matchAll(/!?\[[^\]\n]+\]\(([^\s()]+)\)/g)) {
    const href = link[1].split('#')[0]; if (!href || /^(?:https?:|mailto:)/.test(href)) continue;
    const target = href.startsWith('/') ? resolve(userDocRoot, '.' + decodeURIComponent(href)) : resolve(dirname(resolve(userDocRoot, file)), decodeURIComponent(href));
    const name = relative(userDocRoot, target).split(sep).join('/');
    if (!publishedFiles.has(name) && !publishedAssets.some(asset => name === 'public/' + asset)) throw Error('用户正文链接到非发布材料：' + file + ' → ' + href);
    if (!existsSync(target)) throw Error('用户链接不存在：' + href);
  }
  for (const include of text.matchAll(/<!--@include:\s*(.*?)\s*-->/g)) {
    const target = resolve(dirname(resolve(userDocRoot, file)), include[1]);
    if (!generatedFragments.some(name => target === resolve(userDocRoot, '_generated', name)) || !existsSync(target)) throw Error('用户文档引用了未许可的正文：' + file);
  }
}
