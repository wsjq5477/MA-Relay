import {defineConfig} from 'vitepress';
import {readdirSync, readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const docRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const title=(file:string)=>readFileSync(resolve(docRoot,file),'utf8').match(/^#\s+(.+)$/m)?.[1]?.replace(/^M\d+\s*/, '')||file;
const page=(file:string,text?:string)=>({text:text||title(file),link:'/'+file.replace(/\.md$/,'')});
const moduleNames={'01-desktop':'桌面界面与交互','02-coordinator':'中央协调后台','03-machine-network':'机器与 Agent 节点','04-ssh-access':'SSH 接入与安装','05-linux-daemon':'Linux 后台与协议','06-native-adapters':'原生 Agent 适配','07-task-session':'任务、会话与恢复','08-collaboration':'主从关系与协作','09-cli-hub-edge':'CLI 与 Hub/Edge','10-packaging':'构建与发布','11-documentation-portal':'文档网页入口'};
const modules=readdirSync(resolve(docRoot,'modules'),{withFileTypes:true}).filter(i=>i.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>({text:moduleNames[i.name]||title(`modules/${i.name}/design.md`).replace(/设计$/,''),collapsed:true,items:[page(`modules/${i.name}/design.md`,'功能设计'),page(`modules/${i.name}/test-report.md`,'测试报告'),...readdirSync(resolve(docRoot,'modules',i.name),{withFileTypes:true}).filter(c=>c.isDirectory()).map(c=>({text:c.name==='claude'?'Claude Code':c.name==='codex'?'Codex':'OpenCode',collapsed:true,items:[page(`modules/${i.name}/${c.name}/design.md`,'功能设计'),page(`modules/${i.name}/${c.name}/test-report.md`,'测试报告')]}))]}));
const iterations=readdirSync(resolve(docRoot,'iterations'),{withFileTypes:true}).filter(i=>i.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(i=>({text:i.name,collapsed:true,items:readdirSync(resolve(docRoot,'iterations',i.name)).filter(f=>f.endsWith('.md')).map(f=>page(`iterations/${i.name}/${f}`))}));
export default defineConfig({
  title:'AgentBridge 文档',description:'AgentBridge 整体设计、模块设计、测试报告和迭代记录',lang:'zh-CN',cleanUrls:true,
  appearance:true,ignoreDeadLinks:[/^\/references\//],
  head:[['link',{rel:'icon',href:'/agentbridge.png'}]],
  vite:{server:{host:'127.0.0.1',port:4188,strictPort:true,watch:{ignored:['**/public/references/**','**/.vitepress/dist/**']}}},
  themeConfig:{logo:'/agentbridge.png',siteTitle:'AgentBridge Docs',
    nav:[{text:'首页',link:'/'},{text:'整体设计',link:'/product-design'},{text:'模块文档',link:'/module-plan'},{text:'测试验收',link:'/testing'},{text:'迭代记录',link:'/iterations/README'},{text:'维护规范',link:'/development-guide'}],
    sidebar:[{text:'项目概览',items:[page('README.md','文档首页'),page('product-design.md','整体功能设计'),page('architecture.md','系统架构'),page('data-model.md','对象与数据'),page('protocol.md','接口与协议'),page('project-plan.md','迭代路线'),page('web-reading.md','网页阅读与启动')]},
      {text:'模块设计与测试',items:modules},{text:'验收与维护',items:[page('testing.md','整体验证报告'),page('development-guide.md','人类与 Agent 协作维护')]},
      {text:'迭代历史',collapsed:true,items:[page('iterations/README.md','迭代目录'),...iterations]},
      {text:'历史资料',collapsed:true,items:[page('archive/README.md','历史资料说明')]}],
    search:{provider:'local',options:{_render:(src,env,md)=>env.relativePath?.startsWith('archive/legacy/')?'':md.render(src,env),locales:{root:{translations:{button:{buttonText:'搜索文档',buttonAriaLabel:'搜索文档'},modal:{displayDetails:'显示详细信息',resetButtonTitle:'清除搜索',backButtonTitle:'返回',noResultsText:'没有找到相关文档',footer:{selectText:'选择',navigateText:'切换',closeText:'关闭'}}}}}}},
    outline:{level:[2,3],label:'本页目录'},docFooter:{prev:'上一篇',next:'下一篇'},darkModeSwitchLabel:'切换主题',sidebarMenuLabel:'文档目录',returnToTopLabel:'返回顶部',
    footer:{message:'同一份 Markdown，供人类阅读与 Agent 维护。',copyright:'AgentBridge · 设计、实现与验收分别标注'}
  },
  markdown:{config(md){
    const fence=md.renderer.rules.fence!;
    md.renderer.rules.fence=(tokens,idx,options,env,self)=>tokens[idx].info.trim()==='mermaid'?`<MermaidDiagram encoded="${Buffer.from(tokens[idx].content).toString('base64')}" />`:fence(tokens,idx,options,env,self);
    const link=md.renderer.rules.link_open||((tokens,idx,options,env,self)=>self.renderToken(tokens,idx,options));
    md.renderer.rules.link_open=(tokens,idx,options,env,self)=>{
      const token=tokens[idx],href=token.attrGet('href')||'';
      if(href&&!/^(?:[a-z]+:|#|\/)/i.test(href)){
        const current=env.path||env.realPath||resolve(docRoot,'index.md');const target=resolve(current.slice(0,current.lastIndexOf('/')),decodeURIComponent(href.split('#')[0]));
        if(!target.startsWith(docRoot+'/')||target.startsWith(docRoot+'/.vitepress/')){const repo=resolve(docRoot,'..');const rel=target.slice(repo.length+1);token.attrSet('href',(rel.startsWith('.')&&!rel.startsWith('doc/.vitepress/'))||rel.endsWith('.exe')?'/web-reading#文件下载范围':'/references/'+rel+(['.md','.ts','.mts','.vue','.css','.cjs','.mjs','.ps1','.sh'].includes(extname(rel))?'.txt':'')+(href.includes('#')?'#'+href.split('#')[1]:''));}
      }
      if(token.attrGet('href')?.startsWith('/references/')){token.attrSet('target','_blank');token.attrSet('rel','noopener');}
      return link(tokens,idx,options,env,self);
    };
  }}
});
