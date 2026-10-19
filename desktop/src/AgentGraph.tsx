import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {ReactFlow,Background,BaseEdge,Handle,Position,MarkerType,getSmoothStepPath,useStoreApi,useUpdateNodeInternals,type EdgeProps,type Node,type NodeProps,type ReactFlowInstance,type Connection,type NodeChange,type Viewport} from '@xyflow/react';
import {Crown,Monitor,Terminal,Plus,Minus,Maximize,LayoutGrid,RefreshCw} from 'lucide-react';
import {routeAroundNodes,type Obstacle} from './graph-routing';
import {sshStageLabel} from './AddMachineDialog';
import AgentIcon from './AgentIcon';
import {PrimaryAgentButton} from './CollaborationChoice';
import {bridgeCallerReason,canCallBridge,canExecuteNode,canReceiveDelegation,connectionCapabilitySummary} from './connection-capabilities';
import {connectionError,relationCapabilityError,useGraphDraft} from './graph-state';
import type {NodeAction} from './node-management';
import type {AgentNode,Collaboration,Machine} from './types';
import '@xyflow/react/dist/style.css';
import './graph.css';
export const graphNodeStatus=(n:AgentNode)=>!n.online?'机器离线':n.status==='tool_error'?'工具检查异常':!n.executionSupported?'尚未支持执行':!n.connected?'已发现，待接入':n.unconfirmed||n.uncertain?'执行待核对':n.waiting?'等待你处理':n.busy?'正在工作':n.lastError?'最近执行失败':'已接入';
type Point={x:number;y:number};
type Data={
  machine?:Machine;node?:AgentNode;hostName?:string;count?:number;role?:string;
  machineName?:string;
  keyboardTarget?:boolean;
  relationLocked?:boolean;managementLocked?:boolean;addAgent?:(m:Machine)=>void;nodeAction?:(n:AgentNode,a:NodeAction)=>void;
  locked:boolean;start?:(n:AgentNode)=>void;setMain?:(id:string)=>void;attach?:(id:string)=>void;
  keyboard?:(id:string,type:'source'|'target',key:string)=>void;
  move?:(id:string,group:boolean,delta:Point)=>void;warning?:(s:string)=>void;
};
type FlowNode=Node<Data,'machine'|'agent'>;
const width=360,nodeWidth=280,nodeHeight=132;
function arrow(key:string,shift:boolean){const step=shift?40:10;return key==='ArrowLeft'?{x:-step,y:0}:key==='ArrowRight'?{x:step,y:0}:key==='ArrowUp'?{x:0,y:-step}:key==='ArrowDown'?{x:0,y:step}:null;}
const MachineNode=memo(({data,id}:NodeProps<FlowNode>)=>{
  const m=data.machine!;
  return <section className="graph-machine" aria-label={m.name}>
    <div className="graph-group-handle" tabIndex={0} role="button" aria-label={'移动机器组 '+m.name} onKeyDown={e=>{const delta=arrow(e.key,e.shiftKey);if(delta){e.preventDefault();e.stopPropagation();data.move?.(m.machineId,true,delta);}}}>
      <div className="graph-machine-title">{m.kind==='windows'?<Monitor size={17}/>:<Terminal size={17}/>}<strong>{m.name}</strong><span>{data.count} 节点</span></div>
      <p>{m.kind==='wsl'?'WSL · '+m.distribution+' · 宿主 '+data.hostName:m.kind==='ssh'?'SSH · '+m.username+'@'+m.host+':'+(m.port||22):m.platform}</p>
      <span className={'graph-machine-status '+(m.online?'online':'offline')}>{m.online?'在线':m.kind==='ssh'?sshStageLabel(m.connectionState||m.stage):'离线'}</span>
      {m.error&&<p className="machine-error" role="status">{m.error}</p>}
      {!data.count&&<p>未发现受支持的 Agent。请连接或重新扫描。</p>}
    </div>
    <button className="graph-add-agent text-btn nodrag nopan" aria-label={"添加 Agent · "+m.name} onClick={()=>data.addAgent?.(m)}><Plus size={13}/>添加 Agent</button>
    <span className="graph-group-id" hidden>{id}</span>
  </section>;
});
const ToolNode=memo(({data,id}:NodeProps<FlowNode>)=>{
  const n=data.node!,main=data.role==='主 Agent',caller=canCallBridge(n),receiver=canReceiveDelegation(n),updateNodeInternals=useUpdateNodeInternals();
  // Role changes alter usable handles; remeasure retained hidden anchors after paint.
  useEffect(()=>{const frame=requestAnimationFrame(()=>updateNodeInternals(id));return()=>cancelAnimationFrame(frame);},[id,main,caller,receiver,updateNodeInternals]);
  return <article className={'graph-tool '+(main?'is-leader ':'')+(!n.online?'is-offline ':'')+(data.keyboardTarget?'keyboard-target':'')} aria-label={n.name+' · '+data.role+' · '+graphNodeStatus(n)}
    onKeyDown={e=>{const delta=arrow(e.key,e.shiftKey);if(delta){e.preventDefault();e.stopPropagation();data.move?.(n.nodeId,false,delta);}}}>
    <Handle type="target" id="input" position={Position.Left} tabIndex={main||!receiver?-1:0} aria-hidden={main||!receiver} isConnectable={!main&&receiver&&!data.relationLocked} role="button" aria-label={'连接到 '+data.machineName+' / '+n.name} className={'nodrag nopan graph-port '+(main||!receiver?'unused':'')}
      onKeyDown={e=>{e.stopPropagation();if(['Enter',' ','Escape','ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();data.keyboard?.(n.nodeId,'target',e.key);}}}/>
    <div className="graph-tool-title"><AgentIcon adapter={n.adapter} size={22}/><strong>{n.name}</strong><span className="graph-tool-role">{main&&<Crown className="graph-leader-icon" size={13}/>} {data.role||'节点'}</span></div>
    <small title={connectionCapabilitySummary(n)}>{n.version||'版本未知'} · {graphNodeStatus(n)}</small>
    <div className="graph-tool-actions nodrag nopan">
      {!n.connected?<button className="text-btn" disabled={data.managementLocked||!n.online||!canExecuteNode(n)||n.busy} onClick={()=>data.attach?.(n.nodeId)}>接入</button>
        :<><PrimaryAgentButton node={n} current={main} className="text-btn" disabled={data.relationLocked} onSelect={()=>data.setMain?.(n.nodeId)}/><button className="text-btn" disabled={!n.available||!canExecuteNode(n)||data.locked} onClick={()=>data.start?.(n)}>开始会话</button></>}
      {n.connected&&<button className="text-btn" disabled={data.managementLocked||!n.online||n.busy} onClick={()=>data.nodeAction?.(n,'disconnect')}>断开</button>}
      <button className="text-btn" disabled={data.managementLocked||!n.online||n.busy} onClick={()=>data.nodeAction?.(n,'remove')}>移除</button>
    </div>
    <Handle type="source" id="output" position={Position.Right} tabIndex={main&&caller?0:-1} aria-hidden={!main||!caller} isConnectable={main&&caller&&!data.relationLocked} role="button" aria-label={'从 '+n.name+' 允许委派'} className={'nodrag nopan graph-port '+(!main||!caller?'unused':'')}
      onPointerDown={()=>{if(!main)data.warning?.('只有主 Agent 的输出端点可以创建授权。');}}
      onKeyDown={e=>{e.stopPropagation();if(['Enter',' ','Escape','ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();data.keyboard?.(n.nodeId,'source',e.key);}}}/>
  </article>;
});
const nodeTypes={machine:MachineNode,agent:ToolNode};
const RoutedEdge=memo((props:EdgeProps)=>{
  const cards=(props.data?.obstacles||[]) as Obstacle[];
  const points=useMemo(()=>routeAroundNodes({x:props.sourceX,y:props.sourceY},{x:props.targetX,y:props.targetY},cards),[props.sourceX,props.sourceY,props.targetX,props.targetY,cards]);
  const fallback=getSmoothStepPath(props);
  let path=fallback[0],labelX=fallback[1],labelY=fallback[2];
  if(points){
    path=points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
    let longest=0;
    for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!,length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);if(length>longest){longest=length;labelX=(a.x+b.x)/2;labelY=(a.y+b.y)/2;}}
  }
  return <BaseEdge id={props.id} path={path} labelX={labelX} labelY={labelY} label={props.label} markerEnd={props.markerEnd} style={{...props.style,strokeLinejoin:'round'}} interactionWidth={24}/>;
});
const edgeTypes={routed:RoutedEdge};
function ConnectionCancellation(){
  const store=useStoreApi();
  useEffect(()=>{const cancel=()=>store.getState().cancelConnection(),key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel();};window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);};},[store]);
  return null;
}
interface Props{
  directory:string;machines:Machine[];nodes:AgentNode[];relation:Collaboration;
  hidden:boolean;filter:string;online:boolean;busy:boolean;metadataBusy?:boolean;
  notify:(s:string)=>void;start:(n:AgentNode)=>void;attach:(id:string)=>void;
  machineAction:(m:Machine,action:'scan'|'reconnect'|'disconnect'|'details'|'edit'|'remove'|'daemon')=>void;
  daemonManagementSupported?:boolean;machineManagementSupported?:boolean;managementSupported:boolean;addAgent:(m:Machine)=>void;nodeAction:(n:AgentNode,a:NodeAction)=>void;
  blocked:(machineId?:string,nodeId?:string)=>boolean;
  onExecutionLockChange?:(locked:boolean)=>void;
}
export default function AgentGraph(props:Props){
  const {machines,nodes,relation,notify}=props;
  const editor=useGraphDraft(props.directory,relation,notify,props.online),{state}=editor;
  const [flow,setFlow]=useState<ReactFlowInstance<FlowNode>|null>(null),[selection,setSelection]=useState<string|null>(null),[edge,setEdge]=useState<string|null>(null),[keySource,setKeySource]=useState<string|null>(null),[keyTarget,setKeyTarget]=useState<string|null>(null);
  const cancelled=useRef(false);
  const pan=useRef<{x:number;y:number;pointerId:number;viewport:Viewport;canvas:HTMLElement;latest:Viewport;frame:number}|null>(null);
  const keyLink=useRef<{source:string|null;target:string|null}>({source:null,target:null});
  function keys(source:string|null,target:string|null){keyLink.current={source,target};setKeySource(source);setKeyTarget(target);}
  const focusedFilter=useRef<string|null>(null);
  const defaults=useRef<{groups:Record<string,Point>;nodes:Record<string,Point>}>({groups:{},nodes:{}});
  const executionLocked=!!state.relationPending||!props.online||props.busy;
  useEffect(()=>{props.onExecutionLockChange?.(executionLocked);},[executionLocked,props.onExecutionLockChange]);
  const locked=executionLocked||!!props.metadataBusy||!editor.layoutAvailable;
  const layoutLocked=!!state.layoutPending||!editor.loaded;
  const finishPan=useRef(()=>{});
  finishPan.current=()=>{const current=pan.current;if(!current)return;cancelAnimationFrame(current.frame);pan.current=null;if(current.canvas.hasPointerCapture(current.pointerId))current.canvas.releasePointerCapture(current.pointerId);current.canvas.classList.remove('is-panning');void flow?.setViewport(current.latest);if(!layoutLocked)editor.move(l=>({...l,viewport:current.latest}));};
  useEffect(()=>{
    const move=(e:PointerEvent)=>{const current=pan.current;if(!current)return;e.preventDefault();current.latest={...current.viewport,x:current.viewport.x+e.clientX-current.x,y:current.viewport.y+e.clientY-current.y};cancelAnimationFrame(current.frame);current.frame=requestAnimationFrame(()=>{void flow?.setViewport(current.latest);});};
    const end=()=>finishPan.current();
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);window.addEventListener('blur',end);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);window.removeEventListener('blur',end);const current=pan.current;if(current){cancelAnimationFrame(current.frame);current.canvas.classList.remove('is-panning');pan.current=null;}};
  },[flow]);
  useEffect(()=>{if(props.hidden||layoutLocked)finishPan.current();},[props.hidden,layoutLocked]);
  const machineById=(id:string)=>machines.find(m=>m.machineId===id);
  function main(id:string){
    const node=nodes.find(n=>n.nodeId===id);if(!node?.connected||locked)return;
    if(!canCallBridge(node)){notify(bridgeCallerReason(node));return;}
    if(id===state.draft.leaderId)return;
    const removed=state.draft.memberIds.length;
    editor.edit(r=>({...r,leaderId:id,memberIds:[]}));
    if(removed)notify('主 Agent 已更改，旧的 '+removed+' 条授权将在保存后移除，请重新连线。');
  }
  function connect(source:string|null,target:string|null){
    if(locked)return;
    const reason=connectionError(state.draft,nodes,source,target);
    if(reason){notify(reason);return;}
    editor.edit(r=>({...r,memberIds:[...r.memberIds,target!]}));notify('已增加授权草稿，保存后生效。');
  }
  function keyboard(id:string,type:'source'|'target',key:string){
    const source=keyLink.current.source,target=keyLink.current.target;
    if(key==='Escape'){keys(null,null);notify('已取消连线。');return;}
    if(locked)return;
    if(key==='Enter'||key===' '){
      if(type==='source'){
        if(source===id&&target){connect(source,target);keys(null,null);return;}
        if(id!==state.draft.leaderId){notify('请先设为主 Agent。');return;}
        if(!canCallBridge(nodes.find(n=>n.nodeId===id))){notify(bridgeCallerReason(nodes.find(n=>n.nodeId===id)));return;}
        const first=nodes.find(n=>n.nodeId!==id&&n.connected&&canReceiveDelegation(n)&&!state.draft.memberIds.includes(n.nodeId));
        keys(id,first?.nodeId||null);notify(first?'键盘连线：'+machineById(first.machineId)?.name+' / '+first.name+'；方向键切换，回车连接。':'没有可连接的子节点。');
      }else if(source){connect(source,id);keys(null,null);}
      return;
    }
    if(!source)return;
    const targets=nodes.filter(n=>n.nodeId!==source&&n.connected&&canReceiveDelegation(n)&&!state.draft.memberIds.includes(n.nodeId));
    if(!targets.length)return;
    const i=targets.findIndex(n=>n.nodeId===target),next=targets[(i+(key==='ArrowLeft'||key==='ArrowUp'?-1:1)+targets.length)%targets.length]!;
    keys(source,next.nodeId);notify('键盘连线目标：'+machineById(next.machineId)?.name+' / '+next.name);
  }
  const keyboardAction=useRef(keyboard);keyboardAction.current=keyboard;
  useEffect(()=>{
    if(props.hidden)keys(null,null);
    const navigate=(e:KeyboardEvent)=>{
      const source=keyLink.current.source;
      if(!source||props.hidden||!['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      const focus=document.activeElement as HTMLElement|null;
      if(!focus?.closest('.graph-canvas')){keys(null,null);return;}
      e.preventDefault();e.stopPropagation();
      const target=focus.classList.contains('target')?focus.dataset.nodeid:undefined;
      keyboardAction.current(target||source,target?'target':'source',e.key);
    };
    window.addEventListener('keydown',navigate,true);return()=>window.removeEventListener('keydown',navigate,true);
  },[props.hidden]);
  useEffect(()=>{
    const cancel=()=>{cancelled.current=true;keys(null,null);};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel();};
    window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);};
  },[]);
  const leaderMachine=nodes.find(n=>n.nodeId===state.draft.leaderId)?.machineId;
  const machineRank=(m:Machine)=>m.machineId===leaderMachine?-1:m.kind==='windows'?0:m.kind==='wsl'?1:2;
  const sortedMachines=[...machines].sort((a,b)=>machineRank(a)-machineRank(b));
  const arrangedGroups:Record<string,Point>={};let y=0;
  for(let i=0;i<sortedMachines.length;i+=2){
    const row=sortedMachines.slice(i,i+2);
    row.forEach((m,j)=>{arrangedGroups[m.machineId]={x:j*440,y};});
    y+=Math.max(...row.map(m=>150+Math.max(1,nodes.filter(n=>n.machineId===m.machineId).length)*155))+65;
  }
  const arrangedNodes:Record<string,Point>={};
  for(const m of machines)nodes.filter(n=>n.machineId===m.machineId).sort((a,b)=>a.nodeId===state.draft.leaderId?-1:b.nodeId===state.draft.leaderId?1:a.name.localeCompare(b.name)).forEach((n,i)=>{arrangedNodes[n.nodeId]={x:40,y:130+i*155};});
  for(const [id,position] of Object.entries(arrangedGroups))defaults.current.groups[id]||=position;
  for(const [id,position] of Object.entries(arrangedNodes))defaults.current.nodes[id]||=position;
  const defaultGroups=defaults.current.groups,defaultNodes=defaults.current.nodes;
  const identityKey=machines.map(m=>m.machineId).join('|')+':'+nodes.map(n=>n.nodeId).join('|');
  useEffect(()=>{
    if(!editor.loaded||layoutLocked)return;
    if(machines.some(m=>!m.machineId.startsWith('draft-')&&!state.layout.groups[m.machineId])||nodes.some(n=>!state.layout.nodes[n.nodeId]))
      editor.move(l=>({...l,groups:{...Object.fromEntries(machines.filter(m=>!m.machineId.startsWith('draft-')).map(m=>[m.machineId,defaultGroups[m.machineId]!])),...l.groups},nodes:{...Object.fromEntries(nodes.map(n=>[n.nodeId,defaultNodes[n.nodeId]!])),...l.nodes}}));
  },[editor.loaded,identityKey,layoutLocked]);
  function move(id:string,group:boolean,delta:Point){
    const key=group?'groups':'nodes',point=state.layout[key][id]||(group?defaultGroups[id]:defaultNodes[id]);
    if(!point)return;
    const groupHeight=150+Math.max(1,nodes.filter(n=>n.machineId===nodes.find(n=>n.nodeId===id)?.machineId).length)*155;
    editor.move(l=>({...l,[key]:{...l[key],[id]:{x:group?point.x+delta.x:Math.max(12,Math.min(width-nodeWidth-12,point.x+delta.x)),y:group?point.y+delta.y:Math.max(120,Math.min(groupHeight-nodeHeight-12,point.y+delta.y))}}}));
  }
  const nodeActions=useRef({main,keyboard,move,start:props.start,attach:props.attach,addAgent:props.addAgent,nodeAction:props.nodeAction,warning:notify});
  nodeActions.current={main,keyboard,move,start:props.start,attach:props.attach,addAgent:props.addAgent,nodeAction:props.nodeAction,warning:notify};
  // Coordinate updates must not replace every card's data and rerender all
  // machines/tools. Stable callbacks dispatch through the latest editor state.
  const machineData=useMemo(()=>new Map(machines.map(m=>[m.machineId,{machine:m,hostName:machineById(m.parentMachineId||'')?.name,count:nodes.filter(n=>n.machineId===m.machineId).length,addAgent:(m:Machine)=>nodeActions.current.addAgent(m),locked:layoutLocked,move:(...args:Parameters<typeof move>)=>nodeActions.current.move(...args)}])),[machines,nodes,layoutLocked]);
  const toolData=useMemo(()=>new Map(nodes.map(n=>[n.nodeId,{node:n,machineName:machineById(n.machineId)?.name,keyboardTarget:keyTarget===n.nodeId,role:n.nodeId===state.draft.leaderId?'主 Agent':state.draft.memberIds.includes(n.nodeId)?'子 Agent':'节点',locked:executionLocked||props.blocked(n.machineId,n.nodeId),managementLocked:executionLocked||!!props.metadataBusy||!props.managementSupported||props.blocked(n.machineId),nodeAction:(n:AgentNode,a:NodeAction)=>nodeActions.current.nodeAction(n,a),relationLocked:locked, start:(node:AgentNode)=>nodeActions.current.start(node),attach:(id:string)=>nodeActions.current.attach(id),setMain:(id:string)=>nodeActions.current.main(id),keyboard:(...args:Parameters<typeof keyboard>)=>nodeActions.current.keyboard(...args),move:(...args:Parameters<typeof move>)=>nodeActions.current.move(...args),warning:(message:string)=>nodeActions.current.warning(message)}])),[machines,nodes,state.draft,locked,executionLocked,keyTarget,props.blocked,props.managementSupported,props.metadataBusy]);
  const flowNodes=useMemo<FlowNode[]>(()=>[
    ...sortedMachines.map(m=>({id:'machine:'+m.machineId,type:'machine' as const,position:state.layout.groups[m.machineId]||defaultGroups[m.machineId]!,dragHandle:'.graph-machine',draggable:!layoutLocked,selectable:false,width,height:150+Math.max(1,nodes.filter(n=>n.machineId===m.machineId).length)*155,data:machineData.get(m.machineId)!})),
    ...nodes.filter(n=>machineById(n.machineId)).map(n=>({id:n.nodeId,type:'agent' as const,parentId:'machine:'+n.machineId,extent:'parent' as const,position:state.layout.nodes[n.nodeId]||defaultNodes[n.nodeId]!,draggable:!layoutLocked,selected:selection===n.nodeId,ariaLabel:machineById(n.machineId)?.name+' / '+n.name,width:nodeWidth,height:nodeHeight,data:toolData.get(n.nodeId)!}))
  ],[machines,nodes,state.layout,layoutLocked,selection,machineData,toolData]);
  const confirmed=state.base.revision>relation.revision?state.base:relation;
  const obstacleKey=flowNodes.filter(n=>n.type==='agent').map(n=>{const parent=flowNodes.find(p=>p.id===n.parentId)!;return [n.id,parent.position.x+n.position.x,parent.position.y+n.position.y].join(':');}).join('|');
  const obstacles=useMemo<Obstacle[]>(()=>flowNodes.filter(n=>n.type==='agent').map(n=>{const parent=flowNodes.find(p=>p.id===n.parentId)!;return {x:parent.position.x+n.position.x,y:parent.position.y+n.position.y,width:nodeWidth,height:nodeHeight};}),[obstacleKey]);
  const savedEdges=confirmed.leaderId?confirmed.memberIds.map(id=>({source:confirmed.leaderId!,target:id})):[],draftEdges=state.draft.leaderId?state.draft.memberIds.map(id=>({source:state.draft.leaderId!,target:id})):[];
  const edges=[...savedEdges,...draftEdges.filter(e=>!savedEdges.some(s=>s.source===e.source&&s.target===e.target))].filter(e=>nodes.some(n=>n.nodeId===e.source)&&nodes.some(n=>n.nodeId===e.target)).map(e=>{
    const added=!savedEdges.some(s=>s.source===e.source&&s.target===e.target),removed=!draftEdges.some(s=>s.source===e.source&&s.target===e.target);
    const id=e.source+'->'+e.target,offline=!nodes.find(n=>n.nodeId===e.target)?.online;
    return {id,...e,type:'routed',zIndex:2,sourceHandle:'output',targetHandle:'input',selected:edge===id,focusable:true,ariaLabel:'允许委派 '+nodes.find(n=>n.nodeId===e.source)?.name+' 到 '+nodes.find(n=>n.nodeId===e.target)?.name+(added?' 待保存':removed?' 待移除':''),label:added?'待保存':removed?'待移除':offline?'授权已保存 · 离线':'授权已保存',markerEnd:{type:MarkerType.ArrowClosed},style:{stroke:removed?'var(--red)':offline?'var(--muted)':'var(--orange)',strokeDasharray:added||removed?'6 4':undefined},data:{removed,obstacles}};
  });
  function positionChanges(changes:NodeChange<FlowNode>[]){
    const positions=changes.filter(c=>c.type==='position'&&c.position);
    if(!positions.length||layoutLocked)return;
    editor.move(l=>{
      const groups={...l.groups},points={...l.nodes};
      for(const c of positions){if(c.type!=='position'||!c.position)continue;if(c.id.startsWith('machine:')){const id=c.id.slice(8);if(!id.startsWith('draft-'))groups[id]=c.position;}else {const height=150+Math.max(1,nodes.filter(n=>n.machineId===nodes.find(n=>n.nodeId===c.id)?.machineId).length)*155;points[c.id]={x:Math.max(12,Math.min(width-nodeWidth-12,c.position.x)),y:Math.max(120,Math.min(height-nodeHeight-12,c.position.y))};}}
      return {...l,groups,nodes:points};
    });
  }
  function viewport(v:Viewport){if(!layoutLocked&&!pan.current)editor.move(l=>({...l,viewport:v}));}
  useEffect(()=>{if(!flow||!editor.loaded||props.hidden||focusedFilter.current===props.filter)return;const first=focusedFilter.current===null;focusedFilter.current=props.filter;if(first&&(state.layout.layoutRevision>0||state.layoutDirty||state.layoutPending))return;const timer=setTimeout(()=>{if(props.filter==='all')void flow.fitView({padding:.12,maxZoom:1});else void flow.fitView({nodes:flowNodes.filter(n=>n.id==='machine:'+props.filter||n.parentId==='machine:'+props.filter),padding:.16,maxZoom:1});},50);return()=>clearTimeout(timer);},[flow,editor.loaded,props.filter,props.hidden]);
  useEffect(()=>{if(flow&&editor.loaded&&!state.layoutDirty&&!state.layoutPending&&JSON.stringify(flow.getViewport())!==JSON.stringify(state.layout.viewport))void flow.setViewport(state.layout.viewport);},[flow,editor.loaded,state.layout.layoutRevision,state.layoutPending,props.hidden]);
  const selectedNode=nodes.find(n=>n.nodeId===selection),selectedMachine=selectedNode?machineById(selectedNode.machineId):null,selectedEdge=edges.find(e=>e.id===edge);
  const capabilityError=relationCapabilityError(state.draft,nodes);
  function removeEdge(){if(!selectedEdge||locked)return;editor.edit(r=>({...r,memberIds:r.memberIds.filter(id=>id!==selectedEdge.target)}));setEdge(null);notify('已移除授权草稿，保存后生效。');}
  return <section className={'agent-graph-panel '+(props.hidden?'graph-hidden':'')} aria-label="机器分组节点图" data-key-source={keySource||''} data-key-target={keyTarget||''} data-draft-members={state.draft.memberIds.join(',')}>
    <div className="graph-toolbar">
      <div><strong>{state.draft.leaderId?nodes.find(n=>n.nodeId===state.draft.leaderId)?.name+' 为主 Agent':'点击节点设为主 Agent'}</strong><span>{confirmed.memberIds.length} 条已保存授权 · {editor.dirty?'草稿待保存':'与后台一致'}</span></div>
      <button className="btn primary" disabled={locked||!editor.dirty||editor.conflict||!!capabilityError} onClick={()=>{if(!relationCapabilityError(state.draft,nodes))void editor.saveRelation();}}>{state.relationPending?'正在核对原保存':'保存授权'}</button>
      <button className="btn" disabled={locked||!editor.dirty} onClick={editor.discard}>放弃草稿</button>
      <button className="btn" disabled={locked||!state.draft.leaderId} onClick={()=>editor.edit(r=>({...r,leaderId:null,memberIds:[]}))}>清除主节点</button>
    </div>
    {capabilityError&&<div className="graph-warning" role="status">{capabilityError} 已有关系及原任务记录保留；请调整授权草稿后保存。</div>}
    {editor.conflict&&<div className="graph-warning" role="alert">另一窗口已更新授权。当前保存：{nodes.find(n=>n.nodeId===relation.leaderId)?.name||'无主节点'}，{relation.memberIds.length} 条授权。草稿仍保留。<button className="text-btn" onClick={editor.rebase}>保留草稿，以最新版本重新校验</button><button className="text-btn" onClick={editor.discard}>载入后台关系</button></div>}
    {state.relationPending&&<div className="graph-warning">授权保存回应尚未确认。草稿保留，仅查询原操作。<button className="text-btn" onClick={()=>void editor.queryRelation()}>查询原授权保存</button></div>}
    {editor.layoutError&&<div className="graph-warning" role="alert">后台暂不支持或无法读取图布局：{editor.layoutError}。{state.layoutPending?'原布局保存尚未确认，拖动保持锁定，仅查询原操作。':'画布、节点和机器仍可拖动，布局仅保存在本机。'}授权编辑需恢复支持图接口的后台；可在“设置 → 后台运行”停止旧后台后重新打开程序。<button className="text-btn" onClick={()=>void editor.reloadLayout()}>重新读取后台布局</button></div>}
    <div className="graph-view-tools">
      <button className="btn small" disabled={layoutLocked} onClick={()=>{editor.move(l=>({...l,groups:Object.fromEntries(Object.entries(arrangedGroups).filter(([id])=>!id.startsWith('draft-'))),nodes:arrangedNodes}));void flow?.fitView({padding:.12,maxZoom:1});}}><LayoutGrid size={14}/>自动整理</button>
      <button className="btn small" onClick={()=>void flow?.fitView({padding:.12,maxZoom:1})}><Maximize size={14}/>适配全图</button>
      <button className="btn small" disabled={!state.draft.leaderId} onClick={()=>void flow?.fitView({nodes:flowNodes.filter(n=>n.id===state.draft.leaderId),maxZoom:1})}>定位主节点</button>
      <button className="icon-btn" aria-label="放大节点图" onClick={()=>void flow?.zoomIn()}><Plus size={15}/></button><button className="icon-btn" aria-label="缩小节点图" onClick={()=>void flow?.zoomOut()}><Minus size={15}/></button>
      <button className="text-btn" onClick={()=>{const v=flow?.getViewport();if(v)void flow?.setViewport({...v,zoom:1});}}>100%</button>
      <span>{state.layoutPending?'布局回应待核对':!editor.layoutAvailable||!props.online?'布局仅保存在本机':state.layoutDirty?'布局尚未保存':'布局已保存'}</span>
      {state.layoutPending&&<button className="text-btn" onClick={()=>void editor.queryLayout()}>查询原布局保存</button>}
      {state.layoutDirty&&!state.layoutPending&&editor.layoutAvailable&&<button className="text-btn" onClick={()=>void editor.retryLayout()}>重试保存布局</button>}
      {editor.layoutConflict&&<><span role="alert">布局修订冲突，当前画面保留。</span><button className="text-btn" onClick={editor.rebaseLayout}>保留当前布局，以最新版本保存</button></>}
    </div>
    <div className="graph-canvas" onPointerDownCapture={e=>{if(e.button!==1)return;e.preventDefault();e.stopPropagation();if(layoutLocked||!flow)return;keys(null,null);const v=flow.getViewport();pan.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId,viewport:v,latest:v,canvas:e.currentTarget,frame:0};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('is-panning');}} onMouseDownCapture={e=>{if(e.button===1){e.preventDefault();e.stopPropagation();}}} onAuxClick={e=>{if(e.button===1)e.preventDefault();}} onKeyDown={e=>{if((e.key==='Delete'||e.key==='Backspace')&&edge&&!(e.target instanceof HTMLInputElement)){e.preventDefault();removeEdge();}}}>
      <ReactFlow<FlowNode> nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={setFlow} onNodesChange={positionChanges}
        onNodeClick={(_,n)=>{if(n.type==='agent'){setSelection(n.id);setEdge(null);}}}
        onEdgeClick={(_,e)=>{setEdge(e.id);setSelection(null);}}
        onConnect={(c:Connection)=>connect(c.source,c.target)} onConnectStart={()=>{cancelled.current=false;}}
        onConnectEnd={(_,s)=>{if(!s.isValid&&!cancelled.current&&s.toNode)notify(connectionError(state.draft,nodes,s.fromNode?.id||null,s.toNode.id)||'请从主输出端点连接到子输入端点。');}}
        isValidConnection={c=>!locked&&!cancelled.current&&!connectionError(state.draft,nodes,c.source,c.target)&&c.sourceHandle==='output'&&c.targetHandle==='input'}
        onMoveEnd={(_,v)=>viewport(v)} minZoom={.25} maxZoom={2} deleteKeyCode={null} nodesConnectable={!locked}
        panOnDrag={!layoutLocked} zoomOnScroll={!layoutLocked} zoomOnPinch={!layoutLocked} zoomOnDoubleClick={false} defaultViewport={state.layout.viewport}
        ariaLabelConfig={{'node.a11yDescription.default':'用方向键移动节点；端点回车开始连线，方向键选择目标，回车连接，Esc 取消。','edge.a11yDescription.default':'按 Delete 删除授权草稿，保存后生效。'}}>
        <Background gap={22} size={1}/>
        <ConnectionCancellation/>
      </ReactFlow>
    </div>
    <p className="graph-instructions" role="status">{keySource?'键盘连线中；当前目标 '+(nodes.find(n=>n.nodeId===keyTarget)?.name||'无')+'。回车连接，Esc 取消。':'左键拖动 Agent 卡片或机器组标题；中键拖动全图，滚轮缩放。自动整理会将主 Agent 所在机器放到左侧。端点连线后须保存授权。'}</p>
    {selectedEdge&&<div className="graph-details"><strong>允许委派：{nodes.find(n=>n.nodeId===selectedEdge.source)?.name} → {nodes.find(n=>n.nodeId===selectedEdge.target)?.name}</strong><button className="btn" disabled={locked||selectedEdge.data.removed} onClick={removeEdge}>删除这条授权</button></div>}
    {selectedNode&&<div className="graph-details"><div><strong>{selectedMachine?.name} / {selectedNode.name}</strong><p>{graphNodeStatus(selectedNode)} · {selectedNode.version}</p><p>{connectionCapabilitySummary(selectedNode)}</p>{(selectedNode.error||selectedNode.lastError)&&<p role="status">{selectedNode.error||selectedNode.lastError?.message}</p>}<details><summary>安装位置</summary><code>{selectedNode.executable}</code></details></div><PrimaryAgentButton node={selectedNode} disabled={locked} onSelect={()=>main(selectedNode.nodeId)}/><button className="btn primary" disabled={!selectedNode.available||!canExecuteNode(selectedNode)||executionLocked||props.blocked(selectedNode.machineId,selectedNode.nodeId)} onClick={()=>props.start(selectedNode)}>开始会话</button></div>}
    {<div className="graph-machine-controls">{machines.map(m=><div key={m.machineId}><strong>{m.name}</strong><span>{m.online?'在线':m.kind==='ssh'?sshStageLabel(m.connectionState):'离线'}</span><button className="text-btn" disabled={props.busy||props.metadataBusy||!m.online} onClick={()=>props.machineAction(m,'scan')}><RefreshCw size={13}/>重新扫描</button>{m.kind==='ssh'&&<><button className="text-btn" disabled={props.busy||props.metadataBusy||m.online&&!!m.busy} onClick={()=>props.machineAction(m,m.online?'disconnect':'reconnect')}>{m.online?'断开':m.connectionState==='needs_credentials'?'输入凭据':'重新连接'}</button><button className="text-btn" disabled={props.busy} onClick={()=>props.machineAction(m,'details')}>连接详情</button><button className="text-btn" disabled={props.busy||props.metadataBusy||!props.machineManagementSupported||!m.online||m.busy||props.blocked(m.machineId)||nodes.some(n=>n.machineId===m.machineId&&n.busy)} onClick={()=>props.machineAction(m,'edit')}>编辑连接</button><button className="text-btn" disabled={props.busy||props.metadataBusy||!props.machineManagementSupported||!m.online||m.busy||props.blocked(m.machineId)||nodes.some(n=>n.machineId===m.machineId&&n.busy)} onClick={()=>props.machineAction(m,'remove')}>移除机器</button><button className="text-btn" disabled={props.busy||props.metadataBusy||!props.daemonManagementSupported||!m.online||m.busy} onClick={()=>props.machineAction(m,'daemon')}>后台维护</button></>}</div>)}</div>}
  </section>;
}
