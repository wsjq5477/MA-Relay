import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = [
  '01-desktop', '02-coordinator', '03-machine-network', '04-ssh-access',
  '05-linux-daemon', '06-native-adapters', '07-task-session',
  '08-collaboration', '09-cli-hub-edge', '10-packaging', '11-documentation-portal',
  '06-native-adapters/opencode', '06-native-adapters/claude', '06-native-adapters/codex',
];
const required = ['README.md', 'product-design.md', 'architecture.md', 'data-model.md',
  'protocol.md', 'module-plan.md', 'testing.md', 'project-plan.md', 'development-guide.md', 'iterations/README.md'];
const errors = [];
function walk(directory) {
  return readdirSync(directory, {withFileTypes:true}).flatMap(row => {
    const file = resolve(directory, row.name);
    return row.isDirectory() ? walk(file) : row.isFile() && row.name.endsWith('.md') ? [file] : [];
  });
}
for (const name of [...required, ...modules.flatMap(module => ['design.md','test-report.md'].map(name => `modules/${module}/${name}`))])
  if (!existsSync(resolve(root,'doc',name))) errors.push(`缺少材料：doc/${name}`);

const markdown = [...walk(resolve(root,'doc')), ...['README.md','AGENTS.md','desktop/README.md','docs/README.md'].map(name=>resolve(root,name))];
const texts = new Map(); let links = 0, diagrams = 0;
for (const file of markdown) {
  const raw = readFileSync(file,'utf8'); let open = null; const body=[];
  for (const [index,line] of raw.split('\n').entries()) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (!open) {open={char:fence[1][0],length:fence[1].length,line:index+1};if(fence[2].trim()==='mermaid') diagrams++;}
      else if (fence[1][0]===open.char&&fence[1].length>=open.length&&!fence[2].trim()) open=null;
      continue;
    }
    if (!open) body.push(line);
  }
  if (open) errors.push(`${relative(root,file)}:${open.line} 代码围栏未闭合`);
  const text=body.join('\n');texts.set(file,text);
  for (const match of text.matchAll(/!?\[[^\]\n]+\]\((<[^>]+>|[^\s()]+)(?:\s+"[^"\n]*")?\)/g)) {
    let href=match[1].replace(/^<|>$/g,'');
    if (/^[a-z][a-z\d+.-]*:/i.test(href)||href.startsWith('#')) continue;
    href=href.split('#')[0];if (!href) continue;
    try {href=decodeURIComponent(href);} catch {errors.push(`${relative(root,file)} 链接编码无效：${href}`);continue;}
    const target=href.startsWith('/')?href:resolve(dirname(file),href);links++;
    if (!existsSync(target)) errors.push(`${relative(root,file)} 本地链接不存在：${href}`);
  }
}

const featurePattern = /\bM\d{2}(?:-(?:OC|CC|CX))?-F\d{2}\b/g;
const casePattern = /\bT-M\d{2}(?:-(?:OC|CC|CX))?-\d{2,3}\b/g;
const features=new Set(),cases=new Map();
const caseReferences=[];
for (const module of modules) {
  const file=resolve(root,'doc/modules',module,'design.md');
  const ids=[...(texts.get(file)||'').matchAll(featurePattern)].map(match=>match[0]);
  if(!ids.length) errors.push(`${relative(root,file)} 未定义模块功能编号`);
  ids.forEach(id=>features.add(id));
}
for (const module of modules) {
  const file=resolve(root,'doc/modules',module,'test-report.md'),text=texts.get(file)||'';
  const ids=new Set([...text.matchAll(casePattern)].map(match=>match[0]));
  const child=module.split('/')[1];
  const suffix={opencode:'OC',claude:'CC',codex:'CX'}[child];
  const owner='T-M'+module.slice(0,2)+(suffix?'-'+suffix:'')+'-';
  const owned=[...ids].filter(id=>id.startsWith(owner)&&/^\d/.test(id.slice(owner.length)));
  if(!owned.length) errors.push(`${relative(root,file)} 缺少本模块测试场景编号`);
  for(const id of ids) {
    if(!owned.includes(id)) {caseReferences.push({id,file});continue;}
    if(cases.has(id)) errors.push(`测试编号 ${id} 在多份报告重复定义：${relative(root,file)} / ${cases.get(id)}`);
    else cases.set(id,relative(root,file));
  }
  for(const match of text.matchAll(featurePattern))
    if(!features.has(match[0])) errors.push(`${relative(root,file)} 引用未定义功能：${match[0]}`);
}
for(const {id,file} of caseReferences)
  if(!cases.has(id)) errors.push(`${relative(root,file)} 引用未定义测试：${id}`);
const product=readFileSync(resolve(root,'doc/product-design.md'),'utf8');
for(let i=1;i<=18;i++) {
  const id='AB-F'+String(i).padStart(2,'0');
  if(!product.includes(id)) errors.push(`整体功能目录缺少 ${id}`);
}
const result={ok:!errors.length,markdownFiles:markdown.length,moduleDesignReportPairs:modules.length,
  localLinks:links,mermaidDiagrams:diagrams,moduleFeatures:features.size,testCases:cases.size,errors};
console.log(JSON.stringify(result,null,2));
if(errors.length) process.exitCode=1;
