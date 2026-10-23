import {useEffect,useRef,useState} from 'react';
import {call} from './api';
import AgentIcon from './AgentIcon';
import {selectDshConnection,dshConnectionIdentity,dshSelectionMessage,type DshConnection,type DshStatus,type DshSelectionState} from './dsh-settings-state';
import type {AgentNode} from './types';

export default function DshSettings({node,disabled=false,onBusyChange}:{node:AgentNode;disabled?:boolean;onBusyChange?:(busy:boolean)=>void}){
 const {machineId,nodeId,adapter,executable}=node;
 const [url,setUrl]=useState(''),[token,setToken]=useState(''),[connection,setConnection]=useState<DshConnection|null>(null),[state,setState]=useState<DshSelectionState>('unconfigured'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[revision,setRevision]=useState(0);
 const source=JSON.stringify([machineId,nodeId,adapter,executable]),current=useRef(source);current.current=source;
 useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
 function apply(status:DshStatus,selected?:string|null){const value=selectDshConnection(status,node,selected??status.selectedConnectionId);setConnection(value.row);setState(value.state);setUrl(value.row?.origin?value.row.origin+'/':value.state==='unconfigured'?'http://127.0.0.1:3080/':'');setLoaded(true);}
 useEffect(()=>{let active=true;setConnection(null);setNotice('');setToken('');setUrl('');setLoaded(false);setBusy(false);
  void call<DshStatus>('dsh.status',{machineId,nodeId}).then(result=>{if(active)apply(result);}).catch(()=>{if(active)setNotice('连接状态读取失败，请保留原配置并刷新核对。');});
  return()=>{active=false;};
 },[source,revision]);
 const writable=loaded&&['unconfigured','loaded','reload_required'].includes(state);
 async function save(toggle=false){
  if(busy||disabled||!writable||toggle&&!connection)return;
  const ticket=source;setBusy(true);setNotice('');const address=toggle?connection!.origin:url;
  try{const origin=new URL(address).origin,result=await call<DshStatus>('dsh.configure',{machineId,nodeId,adapter,url:address,...(toggle?{enabled:!connection!.enabled}:{token})});
   if(current.current!==ticket)return;
   const matches=result.items.filter(row=>row.adapter===adapter&&row.origin===origin);if(matches.length!==1)throw Error('WRONG_TARGET');
   const selected=result.selectedConnectionId||dshConnectionIdentity(matches[0]!);if(selected!==dshConnectionIdentity(matches[0]!))throw Error('WRONG_TARGET');
   apply(result,selected);setNotice('连接已保存。'+(matches[0]!.executable===executable?'当前节点使用这条连接。':'请重新扫描本机器后在对应节点接入；旧连接不会被删除。'));
  }catch{if(current.current===ticket)setNotice('保存结果未能完整核对，请刷新连接状态；不会自动重试或切换其他连接。');}
  finally{if(current.current===ticket){setToken('');setBusy(false);try{setUrl(new URL(address).origin+'/');}catch{/* Retain invalid user input for correction. */}}}
 }
 return <section className="settings-card network-relations settings-dsh" aria-labelledby="settings-dsh">
  <div className="settings-card-heading"><AgentIcon adapter={adapter}/><div><h2 id="settings-dsh">DSH 服务连接</h2><p>连接已运行的 {adapter==='dsh-desktop'?'Desktop':'Web'}，沿用原生登录、模型和权限。</p></div></div>
  <p className="settings-footnote">填写当前机器可访问的服务根地址和连接 token。HTTP 使用该机器的本机地址，token 仅保存在目标机器私有配置中。Desktop 需要开启原生浏览器访问，原生权限和问题仍在 DSH 界面处理。</p>
  <label className="settings-row">服务地址<input aria-label="DSH 服务地址" value={url} disabled={busy||disabled||!writable} onChange={event=>setUrl(event.target.value)}/></label>
  <label className="settings-row">连接 token<input aria-label="DSH 连接 token" type="password" autoComplete="off" value={token} disabled={busy||disabled||!writable} onChange={event=>setToken(event.target.value)}/></label>
  <div className="ssh-actions"><button className="btn primary" disabled={busy||disabled||!writable||!url} onClick={()=>void save()}>保存 DSH 连接</button><button className="btn" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新连接状态</button></div>
  {!loaded&&!notice&&<p role="status">正在读取连接状态…</p>}
  {loaded&&<p role="status">{dshSelectionMessage[state]}</p>}
  {connection&&<div className="settings-row"><span>{connection.origin} · {connection.error?'配置损坏':connection.enabled?'已启用':'已停用'}</span><button className="btn" disabled={busy||disabled||!writable} onClick={()=>void save(true)}>{connection.enabled?'停用连接':'启用连接'}</button></div>}
  <p className="settings-footnote">停用保留历史和原请求。服务重启后若 token 变化，请更新原地址；更换服务地址会形成新连接。Desktop、Web 和 CLI 会话分别归属。</p>
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
