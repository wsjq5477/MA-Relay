import {useEffect,useRef,useState} from 'react';
import {call} from './api';
import type {AgentNode,Collaboration,GraphLayout,GraphReceipt} from './types';

export const emptyLayout=():GraphLayout=>({version:1,layoutRevision:0,groups:{},nodes:{},viewport:{x:0,y:0,zoom:1}});
export const sameRelation=(a:Collaboration,b:Collaboration)=>a.leaderId===b.leaderId&&JSON.stringify([...a.memberIds].sort())===JSON.stringify([...b.memberIds].sort());
export function connectionError(relation:Collaboration,nodes:AgentNode[],source:string|null,target:string|null){
  if(!source||source!==relation.leaderId)return '请先将这个节点设为主 Agent；只有主节点可以委派。';
  if(source===target)return '主 Agent 不能连接自己。';
  const node=nodes.find(n=>n.nodeId===target);
  if(!node?.connected||!node.executionSupported)return '目标必须已接入并支持执行。';
  if(relation.memberIds.includes(node.nodeId))return '已存在这条授权。';
  return '';
}
type Pending={operationId:string;params:Record<string,unknown>;foreign?:boolean};
interface State {base:Collaboration;draft:Collaboration;layout:GraphLayout;layoutDirty:boolean;relationPending:Pending|null;layoutPending:Pending|null;}
const rejected=new Set(['INVALID_INPUT','NODE_NOT_FOUND','NODE_DISCONNECTED','REVISION_CONFLICT','LAYOUT_REVISION_CONFLICT','OPERATION_CONFLICT','OPERATION_LIMIT','GRAPH_INTENT_FAILED']);
// A pending write survives page switches and window reopen. Its only recovery
// action is querying the original operation; absence of a receipt stays unknown.
export function useGraphDraft(directory:string,remote:Collaboration,notify:(s:string)=>void,online:boolean){
  const storageKey='agentbridge.graph.'+directory;
  const [state,setState]=useState<State>(()=>{
    try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored?.base&&stored?.draft&&stored?.layout)return stored;}catch{/* Keep authoritative data if the browser cache is unreadable. */}
    return {base:remote,draft:remote,layout:emptyLayout(),layoutDirty:false,relationPending:null,layoutPending:null};
  });
  const current=useRef(state);current.current=state;
  const [loaded,setLoaded]=useState(false),[serverLayout,setServerLayout]=useState<GraphLayout>(emptyLayout());
  const [layoutAvailable,setLayoutAvailable]=useState(false),[layoutError,setLayoutError]=useState<string|null>(null);
  const [layoutFailure,setLayoutFailure]=useState(false);
  const mounted=useRef(true);
  function remember(next:State){localStorage.setItem(storageKey,JSON.stringify(next));}
  function update(fn:(s:State)=>State){setState(s=>{const next=fn(s);current.current=next;return next;});}
  useEffect(()=>{try{remember(state);}catch{notify('本机无法保存图草稿；请检查桌面存储空间。');}},[state,storageKey]);
  async function readLayout(){
    try{
      const value=await call<GraphLayout>('graphLayout');if(!mounted.current)return;setServerLayout(value);setLoaded(true);setLayoutAvailable(true);setLayoutError(null);
      if(value.warning)notify(value.warning);
      update(s=>s.layoutDirty||s.layoutPending?s:{...s,layout:value});
    }catch(e){
      if(!mounted.current)return;
      // A failed read is not an unknown write. Allow local view edits while
      // keeping every original pending ID; never fall back to legacy writes.
      setLoaded(true);setLayoutAvailable(false);setLayoutError((e as Error).message);
    }
  }
  async function readPending(){
    const rows=await call<(Pending&{lane:'relation'|'layout'})[]>('graphPending');
    if(!mounted.current)return;
    update(s=>{
      let next=s;
      for(const row of rows){
        if(row.lane==='relation'&&!s.relationPending)next={...next,relationPending:{...row,foreign:true}};
        if(row.lane==='layout'&&!s.layoutPending)next={...next,layoutPending:{...row,foreign:true}};
      }
      return next;
    });
  }
  useEffect(()=>{mounted.current=true;void readLayout();void readPending().catch(()=>{});return()=>{mounted.current=false;};},[directory]);
  const dirty=!sameRelation(state.base,state.draft);
  const conflict=dirty&&remote.revision>state.base.revision;
  const layoutConflict=layoutAvailable&&state.layoutDirty&&state.layout.layoutRevision!==serverLayout.layoutRevision;
  useEffect(()=>{update(s=>!s.relationPending&&sameRelation(s.base,s.draft)&&remote.revision>s.base.revision?{...s,base:remote,draft:remote}:s);},[remote.revision,state.relationPending,state.base.revision,dirty]);
  function settle(lane:'relation'|'layout',receipt:GraphReceipt<Collaboration|GraphLayout>,id:string){
    if(receipt.operationId!==id||receipt.state!=='confirmed'||!receipt.data)return false;
    const data=receipt.data;
    update(s=>{
      if((lane==='relation'?s.relationPending:s.layoutPending)?.operationId!==id)return s;
      if(lane==='relation'&&s.relationPending?.foreign)return {...s,relationPending:null};
      if(lane==='layout'&&s.layoutPending?.foreign&&s.layoutDirty)return {...s,layoutPending:null};
      return lane==='relation'?{...s,base:data as Collaboration,draft:data as Collaboration,relationPending:null}
        :{...s,layout:data as GraphLayout,layoutDirty:false,layoutPending:null};
    });
    if(lane==='layout')setServerLayout(data as GraphLayout);
    notify(lane==='relation'?'协作授权已保存。':'布局已保存。');return true;
  }
  async function reconcile(lane:'relation'|'layout'){
    const pending=lane==='relation'?current.current.relationPending:current.current.layoutPending;if(!pending||!online)return;
    try{
      const receipt=await call<GraphReceipt<Collaboration|GraphLayout>>(lane==='relation'?'collaborationOperation':'graphLayoutOperation',{operationId:pending.operationId});
      if(!mounted.current)return;
      if(!settle(lane,receipt,pending.operationId))notify(lane==='relation'?'原授权保存尚未确认，继续只读核对。':'原布局保存尚未确认，继续只读核对。');
    }catch{/* Keep the original operation and payload. */}
  }
  const pendingKey=(state.relationPending?.operationId||'')+':'+(state.layoutPending?.operationId||'');
  useEffect(()=>{if(!state.relationPending&&!state.layoutPending)return;void reconcile('relation');void reconcile('layout');const timer=setInterval(()=>{void reconcile('relation');void reconcile('layout');},5000);return()=>clearInterval(timer);},[pendingKey,online]);
  async function save(lane:'relation'|'layout'){
    const s=current.current;
    if(!online||!loaded||!layoutAvailable||(lane==='relation'?s.relationPending||sameRelation(s.base,s.draft)||remote.revision>s.base.revision:s.layoutPending||!s.layoutDirty||s.layout.layoutRevision!==serverLayout.layoutRevision))return;
    const id=crypto.randomUUID();
    const cleanLayout={version:s.layout.version,layoutRevision:s.layout.layoutRevision,groups:s.layout.groups,nodes:s.layout.nodes,viewport:s.layout.viewport};
    const params=lane==='relation'?{operationId:id,expectedRevision:s.base.revision,leaderId:s.draft.leaderId,memberIds:s.draft.memberIds}
      :{operationId:id,expectedLayoutRevision:s.layout.layoutRevision,layout:cleanLayout};
    const pending={operationId:id,params};
    const next={...s,...(lane==='relation'?{relationPending:pending}:{layoutPending:pending})};
    try{remember(next);}catch{notify('操作未发送：无法持久保存原操作 ID。请检查本机存储。');return;}
    current.current=next;setState(next);
    try{
      const receipt=await call<GraphReceipt<Collaboration|GraphLayout>>(lane==='relation'?'saveCollaboration':'saveGraphLayout',params);
      if(mounted.current&&!settle(lane,receipt,id))void reconcile(lane);
    }catch(e){
      if(!mounted.current)return;
      if(rejected.has((e as Error&{code?:string}).code||'')){
        update(s=>({...s,...(lane==='relation'?{relationPending:null}:{layoutPending:null})}));
        if(lane==='layout'){setLayoutFailure(true);void readLayout();}
      }else if((e as Error&{code?:string}).code==='GRAPH_UNCONFIRMED'){update(s=>({...s,...(lane==='relation'?{relationPending:null}:{layoutPending:null})}));void readPending();}else void reconcile(lane);
      notify((e as Error).message);
    }
  }
  useEffect(()=>{if(!loaded||!layoutAvailable||!state.layoutDirty||state.layoutPending||layoutConflict||layoutFailure||!online)return;const timer=setTimeout(()=>void save('layout'),650);return()=>clearTimeout(timer);},[state.layout,loaded,layoutAvailable,state.layoutDirty,state.layoutPending,layoutConflict,layoutFailure,online]);
  return {state,loaded,layoutAvailable,layoutError,dirty,conflict,layoutConflict,
    edit:(fn:(r:Collaboration)=>Collaboration)=>{if(!current.current.relationPending&&online)update(s=>({...s,draft:fn(s.draft)}));},
    move:(fn:(l:GraphLayout)=>GraphLayout)=>{if(!current.current.layoutPending&&loaded){setLayoutFailure(false);update(s=>{const layout=fn(s.layout);return JSON.stringify(layout)===JSON.stringify(s.layout)?s:{...s,layout,layoutDirty:true};});}},
    saveRelation:()=>save('relation'),queryRelation:()=>reconcile('relation'),queryLayout:()=>reconcile('layout'),
    retryLayout:()=>save('layout'),
    discard:()=>{if(!current.current.relationPending)update(s=>{const latest=s.base.revision>remote.revision?s.base:remote;return {...s,base:latest,draft:latest};});},
    rebase:()=>{if(!current.current.relationPending)update(s=>({...s,base:remote,draft:{...s.draft,revision:remote.revision}}));},
    rebaseLayout:()=>{if(!current.current.layoutPending)update(s=>({...s,layout:{...s.layout,layoutRevision:serverLayout.layoutRevision}}));},
    reloadLayout:readLayout};
}
