import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { call } from "./api";
import type { Machine } from "./types";

interface Pair { pairingId:string; browserInstanceId:string; origin:string; state:"pending"|"committed"|"revoked"; online:boolean }
interface BrowserStatus { ready:boolean; pairs:Pair[]; error?:{code:string;message:string} }
interface Intent { operationId:string; extensionId:string; pairingId?:string }
interface Bundle { pairingId:string; browserInstanceId:string; expiresAt:number; state:string; [key:string]:unknown }
const pairingLabel=(p:Pair)=>p.state==="revoked"?"已撤销":p.state==="pending"?"等待扩展完成配对":p.online?"已连接":"未连接，原配对保留";

function PairingMachine({machine,directory}:{machine:Machine;directory:string}) {
  const storageKey="agentbridge.browser-pair.v1:"+directory+":"+machine.machineId;
  const [loaded]=useState(()=>{
    try {
      const raw=localStorage.getItem(storageKey);if(!raw)return {};
      const value:Intent=JSON.parse(raw);
      if(!value||typeof value.operationId!=="string"||!value.operationId||value.operationId.length>128||!(/^[a-p]{32}$/).test(value.extensionId)||value.pairingId!==undefined&&typeof value.pairingId!=="string")throw Error();
      return {intent:value};
    }catch{return {error:"本机配对意图无法读取。请保留原记录排查，暂不创建新的配对。"};}
  });
  const [intent,setIntent]=useState<Intent|undefined>(loaded.intent);
  const [extensionId,setExtensionId]=useState(loaded.intent?.extensionId||"");
  const [status,setStatus]=useState<BrowserStatus>();
  const [bundle,setBundle]=useState<Bundle>();
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
  const actionLock=useRef(false);
  const [revoking,setRevoking]=useState<string>();
  useEffect(()=>{let active=true;void call<BrowserStatus>("browser.status",{machineId:machine.machineId}).then(result=>{if(active)setStatus(result);},e=>{if(active)setError(e.message);});return()=>{active=false;};},[machine.machineId]);
  useEffect(()=>{if(!bundle)return;const timer=setTimeout(()=>{setBundle(undefined);setNote("配对包已过期，原配对记录保留。请重新检查原状态。");},Math.max(0,bundle.expiresAt-Date.now()));return()=>clearTimeout(timer);},[bundle]);
  async function refresh(){setStatus(await call<BrowserStatus>("browser.status",{machineId:machine.machineId}));}
  async function act(action:()=>Promise<void>){if(actionLock.current)return;actionLock.current=true;setBusy(true);setError("");setNote("");try{await action();}catch(e){setError(e instanceof Error?e.message:"操作未确认，请查询原配对。");}finally{actionLock.current=false;setBusy(false);}}
  function save(value:Intent){localStorage.setItem(storageKey,JSON.stringify(value));setIntent(value);}
  const previous=status?.pairs.find(p=>p.pairingId===intent?.pairingId);
  const canCreate=!loaded.error&&(!intent||previous?.state==="committed"||previous?.state==="revoked");
  async function pair(queryOnly=false){
    let original=intent;
    if(!queryOnly){original={extensionId:extensionId.trim(),operationId:crypto.randomUUID()};save(original);setBundle(undefined);}
    if(!original)throw Error("缺少原配对意图，请重新检查。");
    const result=await call<Bundle>("browser.pair",{machineId:machine.machineId,operationId:original.operationId,extensionId:original.extensionId,queryOnly});
    // The bootstrap stays in memory only, never in localStorage or a URL.
    save({...original,pairingId:result.pairingId});
    setBundle(result.expiresAt>Date.now()&&result.state==="pending"?result:undefined);
    setNote(result.state==="committed"?"扩展已完成原配对，请扫描并接入 ChatGPT Web 节点。":result.state==="revoked"?"原配对已撤销。":result.expiresAt<=Date.now()?"原配对包已过期，保留原身份；可撤销该配对后再创建。":"配对包已生成，两分钟内复制到扩展设置页。");
    await refresh();
  }
  const prefix="browser-"+machine.machineId.replace(/[^\w-]/g,"_");
  return <div className="browser-settings-fields" aria-busy={busy}>
    <p className="settings-footnote">浏览器须与“{machine.name}”的后台在同一设备。</p>
    <div className="browser-settings-action"><span>{status?.error?"网页通道不可用":status?.ready?"本机网页通道已就绪":status?"尚未启用网页连接":"正在检查原连接…"}</span><button className="btn" disabled={busy} onClick={()=>void act(refresh)}>重新检查</button></div>
    {(error||loaded.error||status?.error)&&<p role="alert" className="browser-settings-error">{loaded.error||error||(status?.error?.code+"：原端点或配对状态不可用，请保留原文件排查。")}</p>}
    {note&&<p role="status">{note}</p>}
    <form onSubmit={e=>{e.preventDefault();if(canCreate)void act(()=>pair());}}>
      <label htmlFor={prefix+"-id"}>浏览器扩展 ID</label>
      <input id={prefix+"-id"} value={extensionId} onChange={e=>setExtensionId(e.target.value)} disabled={busy||!canCreate} autoComplete="off" spellCheck={false} pattern="[a-p]{32}" required aria-describedby={prefix+"-help"}/>
      <p id={prefix+"-help"} className="settings-footnote">从扩展“浏览器接入”设置页复制完整的 32 位 ID。</p>
      <div className="browser-settings-actions">
        <button type="submit" className="btn btn-primary" disabled={busy||!machine.online||!canCreate||!(/^[a-p]{32}$/).test(extensionId.trim())}>{intent&&canCreate?"配对另一个浏览器":"生成配对包"}</button>
        {intent&&<button type="button" className="btn" disabled={busy||!!loaded.error} onClick={()=>void act(()=>pair(true))}>查询原配对</button>}
        {bundle&&<button type="button" className="btn" disabled={busy} onClick={()=>void act(async()=>{await navigator.clipboard.writeText(JSON.stringify(bundle));setNote("配对包已复制，请粘贴到原扩展设置页。");})}>复制配对包</button>}
      </div>
    </form>
    {intent&&!canCreate&&!loaded.error&&<p className="settings-footnote">保留原配对意图；回应未确认时只查询原操作，未找到也不自动新建。</p>}
    {status&&<div className="browser-settings-pairs">
      {!status.pairs.length?<p className="settings-footnote">这台机器尚无浏览器配对。</p>:status.pairs.map(p=><div key={p.pairingId} className="browser-settings-pair"><div><strong>{pairingLabel(p)}</strong><code>{p.browserInstanceId}</code><span className="settings-footnote">{p.origin.slice("chrome-extension://".length)}</span>{revoking===p.pairingId&&<><p>撤销后将拒绝此浏览器连接，原任务继续保留。</p><div className="browser-settings-actions"><button className="btn" disabled={busy} onClick={()=>void act(async()=>{await call("browser.revoke",{machineId:machine.machineId,pairingId:p.pairingId});setRevoking(undefined);setBundle(undefined);await refresh();setNote("已撤销原配对；网页任务不会因此变为已取消。");})}>确认撤销 {p.browserInstanceId.slice(0,8)}</button><button className="btn" disabled={busy} onClick={()=>setRevoking(undefined)}>返回</button></div></>}</div>{p.state!=="revoked"&&revoking!==p.pairingId&&<button className="btn" disabled={busy} onClick={()=>setRevoking(p.pairingId)}>撤销配对</button>}</div>)}
    </div>}
  </div>;
}

export function BrowserSettings({machines,directory}:{machines:Machine[];directory:string}){
  const available=machines.filter(m=>!m.removed&&m.kind!=="wsl"&&!m.machineId.startsWith("draft-"));
  const [selected,setSelected]=useState(available[0]?.machineId||"");
  const machine=available.find(m=>m.machineId===selected)||available[0];
  return <section className="settings-card network-relations" aria-labelledby="settings-browser">
    <div className="settings-card-heading"><Globe size={19} aria-hidden="true"/><div><h2 id="settings-browser">浏览器接入</h2></div></div>
    <div className="browser-settings-fields">
      <label htmlFor="browser-machine">浏览器所在机器</label>
      <select id="browser-machine" value={machine?.machineId||""} onChange={e=>setSelected(e.target.value)} disabled={!available.length}>{available.map(m=><option key={m.machineId} value={m.machineId}>{m.name}{m.online?"":" · 未连接"}</option>)}</select>
      {machine?<PairingMachine key={directory+":"+machine.machineId} machine={machine} directory={directory}/>:<p className="settings-footnote">没有可管理的机器，请先连接来源机器。WSL 暂未提供网页配对宿主。</p>}
    </div>
  </section>;
}
