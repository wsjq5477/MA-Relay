import {defineConfig} from 'vitepress';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publishedFiles, userPages, validateUserDocs} from '../../scripts/doc-site-content.mjs';
const docRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const titles = new Map(userPages);
const page = (file: string) => ({text: titles.get(file)!, link: file === 'index.md' ? '/' : '/' + file.replace(/(?:index)?\.md$/, '')});
validateUserDocs();
export default defineConfig({
  srcDir: 'user', srcExclude: ['_generated/**'],
  title: 'AgentBridge 文档', description: 'AgentBridge 当前功能、系统设计与原生 Agent 使用说明', lang: 'zh-CN', cleanUrls: true,
  appearance: true,
  head: [['link', {rel: 'icon', href: '/agentbridge.png'}]],
  vite: {publicDir: resolve(docRoot, 'user/public'), server: {host: '127.0.0.1', port: 4188, strictPort: true, watch: {ignored: ['**/.vitepress/dist/**']}}},
  transformPageData(data) {
    if (!publishedFiles.has(data.relativePath)) throw Error('非用户文档不得进入网页：' + data.relativePath);
  },
  themeConfig: {
    logo: '/agentbridge.png', siteTitle: 'AgentBridge',
    nav: [{text: '快速开始', link: '/quickstart'}, {text: '产品设计', link: '/product'}, {text: 'Agent 接入', link: '/agents/'}, {text: '接入方式', link: '/integration-methods'}],
    sidebar: [
      {text: '开始使用', items: ['index.md', 'quickstart.md', 'product.md', 'architecture.md'].map(page)},
      {text: '功能设计', items: ['machines.md', 'sessions.md', 'collaboration.md', 'materials.md', 'connections.md'].map(page)},
      {text: '原生 Agent 适配', items: ['agents/index.md', 'agents/claude.md', 'agents/codex.md', 'agents/opencode.md', 'agents/opendesk.md', 'agents/hermes.md', 'agents/pi.md', 'agents/dsh.md'].map(page)},
      {text: '接入方式', items: ['integration-methods.md'].map(page)},
    ],
    search: {provider: 'local', options: {locales: {root: {translations: {button: {buttonText: '搜索文档', buttonAriaLabel: '搜索文档'}, modal: {displayDetails: '显示详细信息', resetButtonTitle: '清除搜索', backButtonTitle: '返回', noResultsText: '没有找到相关文档', footer: {selectText: '选择', navigateText: '切换', closeText: '关闭'}}}}}}},
    outline: {level: [2, 3], label: '本页目录'}, docFooter: {prev: '上一篇', next: '下一篇'}, darkModeSwitchLabel: '切换主题', sidebarMenuLabel: '文档目录', returnToTopLabel: '返回顶部',
    footer: {message: '连接你已有的 Agent，沿用它们的账号与原生配置。', copyright: 'AgentBridge · 功能与使用说明'},
  },
  markdown: {config(md) {
    const fence = md.renderer.rules.fence!;
    md.renderer.rules.fence = (tokens, idx, options, env, self) => tokens[idx].info.trim() === 'mermaid'
      ? `<MermaidDiagram encoded="${Buffer.from(tokens[idx].content).toString('base64')}" />`
      : fence(tokens, idx, options, env, self);
  }},
});
