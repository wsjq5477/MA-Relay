import {readFileSync,readdirSync,mkdirSync,copyFileSync,statSync,rmSync} from 'node:fs';
import {resolve,dirname,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),doc=resolve(root,'doc'),output=resolve(doc,'public/references');
rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});
const siteSources=new Set(['doc/.vitepress/config.mts','doc/.vitepress/theme/index.ts','doc/.vitepress/theme/custom.css','doc/.vitepress/theme/MermaidDiagram.vue']);
const allowed=new Set(['.md','.ts','.mts','.vue','.css','.cjs','.mjs','.json','.log','.tap','.png','.svg','.ps1','.sh']);let copied=0;
function scan(folder){for(const entry of readdirSync(folder,{withFileTypes:true})){
  if(entry.name.startsWith('.'))continue;const file=resolve(folder,entry.name);if(entry.isDirectory()){scan(file);continue;}if(!file.endsWith('.md'))continue;
  const text=readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'');
  for(const link of text.matchAll(/!?\[[^\]]+\]\(([^\s()]+)\)/g)){
    const href=link[1].split('#')[0];if(!href||/^(?:[a-z]+:|#|\/)/i.test(href))continue;
    const target=resolve(dirname(file),decodeURIComponent(href)),name=relative(root,target);
    if((target.startsWith(doc+'/')&&!siteSources.has(name))||name.startsWith('..')||(name.split('/').some(p=>p.startsWith('.'))&&!siteSources.has(name))||!allowed.has(extname(name)))continue;
    try{if(!statSync(target).isFile())continue;const out=resolve(output,name+(['.md','.ts','.mts','.vue','.css','.cjs','.mjs','.ps1','.sh'].includes(extname(name))?'.txt':''));mkdirSync(dirname(out),{recursive:true});copyFileSync(target,out);copied++;}catch{}
  }
}}
scan(doc);console.log(`文档引用资源已准备：${copied} 个链接；不导出隐藏状态、凭据或 EXE。`);
