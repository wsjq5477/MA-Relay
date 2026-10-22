import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, relative, sep, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {repositoryRoot, publishedFiles, publishedAssets, internalText, validateUserDocs} from './doc-site-content.mjs';

export function checkDocSite(folder = resolve(repositoryRoot, 'doc/.vitepress/dist')) {
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, {withFileTypes: true})) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(file); else files.push(relative(folder, file).split(sep).join('/'));
    }
  }
  walk(folder);
  const expected = new Set([...publishedFiles].map(file => file.replace(/\.md$/, '.html')).concat('404.html'));
  const pages = files.filter(file => file.endsWith('.html'));
  if (pages.length !== expected.size || pages.some(file => !expected.has(file))) throw Error('网页构建含未登记页面或缺少用户页面');
  const generatedAssets = files.filter(file => file.startsWith('assets/') && /\.[\w-]{8,}\.(?:js|css)$/.test(file)).map(file => basename(file));
  for (const file of files) {
    if (!expected.has(file) && !publishedAssets.includes(file) && file !== 'hashmap.json' && !file.startsWith('assets/')) throw Error('网页构建含非公开材料：' + file);
    if (/\.(?:html|js|json)$/.test(file)) {
      const text = readFileSync(resolve(folder, file), 'utf8');
      // Vite content hashes may coincidentally contain an iteration-like token.
      // Normalize only known generated filenames; their bodies are still audited.
      let content = text;
      for (const asset of generatedAssets) content = content.split(asset).join(asset.replace(/\.[\w-]{8,}\.(js|css)$/, '.BUILDHASH.$1'));
      if (internalText.test(content) || /(?:\/references\/|\/modules\/\d{2}-|\/iterations\/|\/archive\/|test-report\.md)/.test(text)) throw Error('网页或搜索资源混入内部材料：' + file);
    }
  }
  for (const asset of publishedAssets) if (!existsSync(resolve(folder, asset))) throw Error('缺少公开品牌资源：' + asset);
  const home = readFileSync(resolve(folder, 'index.html'), 'utf8'), dsh = readFileSync(resolve(folder, 'agents/dsh.html'), 'utf8');
  for (const heading of ['原生 CLI', '原生 API', 'MCP', 'ACP', '插件', 'SDK']) if (!home.includes(heading)) throw Error('首页缺少接入总结列：' + heading);
  for (const entry of ['DSH CLI', 'DSH Windows Desktop', 'DSH Linux / WSL Web', '为什么采用原生 API']) if (!dsh.includes(entry)) throw Error('DSH 章节缺少入口或说明：' + entry);
  return {ok: true, ...validateUserDocs(), htmlPages: pages.length, internalPagesPublished: 0, evidenceFilesExported: 0, searchAndPageAssetsChecked: files.filter(file => /\.(?:html|js|json)$/.test(file)).length};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(checkDocSite(), null, 2));
