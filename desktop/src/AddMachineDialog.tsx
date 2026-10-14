import {useEffect, useRef, useState} from 'react';
import {Check, KeyRound, LockKeyhole, LoaderCircle, Server, ShieldCheck, X} from 'lucide-react';
import {call} from './api';
import type {Machine, Snapshot, SshAuthKind, SshConnectionState, SshProbe, SshTestResult, SshTrustChallenge} from './types';

export const sshStageLabel = (state?: SshConnectionState) => ({
  draft: '待连接', validating_host: '正在校验服务器身份', awaiting_host_trust: '等待确认主机指纹',
  authenticating: '正在登录', inspecting: '正在检查远端环境', ready: '检查完成，待连接', installing: '正在安装远端后台',
  starting: '正在启动远端后台', handshaking: '正在核对机器身份', online: '在线',
  disconnected: '连接已中断', reconnecting: '正在重新连接', needs_credentials: '等待输入凭据',
  blocked: '连接受阻', disconnected_manual: '已断开', removed:'已移除',maintaining:'正在维护后台',
} as Record<SshConnectionState, string>)[state || 'disconnected'];
export const sshTransferSize = (bytes: number) => bytes < 1048576 ? `${Math.round(bytes / 1024)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;

interface Props {machine?: Machine; editing?:boolean; updateConnection?:(config:Record<string,unknown>)=>Promise<boolean>; managementPending?:boolean; platform?: string; onClose: () => void; onConnected: () => void;}
type Phase = 'form' | 'trust' | 'preview' | 'connecting';

export default function AddMachineDialog({machine, editing, updateConnection, managementPending, platform, onClose, onConnected}: Props) {
  const [name, setName] = useState(machine?.name || '');
  const [host, setHost] = useState(machine?.host || '');
  const [port, setPort] = useState(String(machine?.port || 22));
  const [username, setUsername] = useState(machine?.username || '');
  const [authKind, setAuthKind] = useState<SshAuthKind>(machine?.authKind || 'password');
  const [keyPath, setKeyPath] = useState(machine?.keyPath || '');
  const [save, setSave] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryUpload, setRetryUpload] = useState(false);
  const [stage, setStage] = useState<SshConnectionState>('draft');
  const [installProgress, setInstallProgress] = useState<Machine['installProgress']>();
  const [challenge, setChallenge] = useState<SshTrustChallenge>();
  const [probe, setProbe] = useState<SshProbe>();
  const [connectionKey, setConnectionKey] = useState(machine?.connectionId);
  const connectionId = useRef(machine?.connectionId);
  const draftSignature = useRef('');
  const operationId = useRef<string | undefined>(undefined);
  const secret = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const alive = useRef(true);
  const completed = useRef(false);
  const saveSupported = machine?.credentialSaveSupported ?? platform === 'win32';

  function clearSecret() {if (secret.current) secret.current.value = '';}
  async function closeDialog() {
    if (busy) return;
    clearSecret();
    if (machine || !connectionId.current || phase === 'connecting') {onClose(); return;}
    setBusy(true);
    try {await call('machine.disconnect', {connectionId: connectionId.current});}
    catch {/* Temporary credentials also expire in the coordinator. */}
    finally {onClose();}
  }
  function finish() {
    if (!alive.current || completed.current) return;
    completed.current = true;
    clearSecret();
    onConnected();
  }
  useEffect(() => {
    alive.current = true;
    return () => {alive.current = false; clearSecret();};
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {event.preventDefault(); void closeDialog();}
      if (event.key !== 'Tab') return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex="0"]') || [])];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last && first) {event.preventDefault(); first.focus();}
    };
    document.addEventListener('keydown', keydown);
    return () => {document.removeEventListener('keydown', keydown);};
  }, [busy, onClose, phase]);

  useEffect(() => {
    if (!busy || !connectionId.current) return;
    let stopped = false, updating = false;
    const update = async () => {
      if (updating) return;
      updating = true;
      try {
        const snapshot = await call<Snapshot>('snapshot');
        const current = snapshot.machines?.find(row => row.connectionId === connectionId.current);
        if (stopped || !current) return;
        setStage(current.connectionState || current.stage || (current.online ? 'online' : 'disconnected'));
        setInstallProgress(current.installProgress);
        if (phase === 'connecting' && current.online) finish();
      } catch {/* The initiating request presents connection failures. */}
      finally {updating = false;}
    };
    const timer = setInterval(() => void update(), 1000);
    return () => {stopped = true; clearInterval(timer);};
  }, [busy, phase, connectionKey]);

  async function test(id: string) {
    const result = await call<SshTestResult>('machine.testSsh', {connectionId: id});
    if (!alive.current) return;
    const state = result.status || result.stage || 'inspecting';
    setStage(state);
    if (result.trustChallenge) {setChallenge(result.trustChallenge); setPhase('trust');}
    else if (result.probe) {clearSecret(); setProbe(result.probe); setPhase('preview');}
    else if (state === 'needs_credentials') {setPhase('form'); setError('请输入登录凭据后重新测试连接。');}
    else throw new Error('服务器环境检查尚未完成，请重新测试连接。');
  }
  async function testConnection() {
    if (busy) return;
    setBusy(true); setError(''); setStage('validating_host');
    try {
      const config = {name: name.trim() || undefined, host: host.trim(), port: Number(port), username: username.trim(), authKind, keyPath: authKind === 'key' ? keyPath.trim() : undefined};
      const signature = JSON.stringify(config);
      if (!connectionId.current || (!machine && draftSignature.current !== signature)) {
        const draft = await call<{connectionId: string;removed?:boolean}>('machine.createSshDraft', config);
        if(draft.removed)throw new Error('该地址的原机器已移除，请在设置的已移除机器中恢复，保留原身份与历史。');
        connectionId.current = draft.connectionId;
        setConnectionKey(draft.connectionId);
        draftSignature.current = signature;
        operationId.current = undefined;
      }
      if(editing&&updateConnection&&draftSignature.current!==signature){
        if(!await updateConnection(config))return;
        draftSignature.current=signature;
      }
      const id = connectionId.current;
      if (authKind !== 'agent') {
        const value = secret.current?.value || '';
        if(value||authKind==='key'&&!machine?.credentialAvailable)await call('credential.provide', {connectionId: id, secret: value, save: saveSupported && save});
        clearSecret();
      }
      await test(id);
    } catch (failure) {if (alive.current) {setError((failure as Error).message); setPhase('form');}}
    finally {if (alive.current) setBusy(false);}
  }
  async function trustHost() {
    if (busy || !challenge || !connectionId.current) return;
    setBusy(true); setError('');
    try {
      await call('machine.trustHost', {connectionId: connectionId.current, challengeId: challenge.challengeId, fingerprint: challenge.fingerprint});
      setStage('authenticating');
      await test(connectionId.current);
    } catch (failure) {if (alive.current) {setError((failure as Error).message); setPhase('form');}}
    finally {if (alive.current) setBusy(false);}
  }
  async function connect() {
    if (busy || !connectionId.current) return;
    setBusy(true); setError(''); setPhase('connecting'); setStage(probe?.installNeeded ? 'installing' : 'starting');
    operationId.current ||= crypto.randomUUID();
    try {
      const result = await call<{online?: boolean; status?: SshConnectionState; connectionState?: SshConnectionState}>('machine.connectSsh', {connectionId: connectionId.current, operationId: operationId.current, installIfNeeded: true});
      if (!alive.current) return;
      if (result.online || result.status === 'online' || result.connectionState === 'online') finish();
      else {
        const snapshot = await call<Snapshot>('snapshot');
        const current = snapshot.machines?.find(row => row.connectionId === connectionId.current);
        if (current?.online) finish();
        else throw new Error(current?.error || '连接状态尚未确认。请返回机器列表查看原连接状态；不会重复提交任务。');
      }
    } catch (failure) {if (alive.current) {
      const error = failure as Error & {code?: string};
      setError(error.message);
      if (error.code === 'SSH_UPLOAD_FAILED' || error.code === 'SSH_INSTALL_CONFIRMATION_REQUIRED') {
        setProbe(undefined); setRetryUpload(true); setPhase('form');
      }
    }}
    finally {if (alive.current) setBusy(false);}
  }

  return <div className="modal-overlay"><section ref={dialog} className="modal ssh-dialog" role="dialog" aria-modal="true" aria-labelledby="ssh-dialog-title">
    <div className="modal-head"><div><h2 id="ssh-dialog-title">{editing ? '编辑 Linux 连接' : machine ? '重新连接 Linux 机器' : '添加 Linux 机器'}</h2><p>使用服务器已有的 SSH 登录方式。</p></div><button className="icon-btn" aria-label="关闭机器接入" disabled={busy} onClick={() => void closeDialog()}><X size={18}/></button></div>
    <div className="modal-body">
      {editing&&<p>保存修改会断开当前连接；随后重新校验服务器身份并连接。已接入机器保留原 SSH 用户与历史；另一用户请新增机器。</p>}
      {managementPending&&<p role="status">连接操作回应尚未确认，请返回机器列表查询原操作。</p>}
      {error && <div className="ssh-error" role="alert">{error}</div>}
      {phase === 'form' && <form onSubmit={event => {event.preventDefault(); void testConnection();}}>
        {(!machine||editing) && <label className="network-field">显示名称（可选）<input aria-label="机器显示名称" value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder="例如：开发服务器" maxLength={100}/></label>}
        <div className="ssh-address-fields"><label className="network-field">服务器地址<input aria-label="服务器地址" autoFocus value={host} disabled={busy || !!managementPending || !!machine&&!editing} onChange={event => setHost(event.target.value)} placeholder="IP 或域名" required autoComplete="off"/></label><label className="network-field">端口<input aria-label="SSH 端口" type="number" min={1} max={65535} value={port} disabled={busy || !!managementPending || !!machine&&!editing} onChange={event => setPort(event.target.value)} required/></label></div>
        <label className="network-field">用户名<input aria-label="SSH 用户名" value={username} disabled={busy || !!managementPending || !!machine} onChange={event => setUsername(event.target.value)} placeholder="远端 Linux 用户名" required autoComplete="off"/></label>
        <fieldset className="ssh-auth"><legend>登录方式</legend><div className="ssh-auth-options">{([{id:'password', label:'密码', icon:LockKeyhole}, {id:'key', label:'私钥文件', icon:KeyRound}, {id:'agent', label:'ssh-agent', icon:ShieldCheck}] as const).map(option => <label className={authKind === option.id ? 'selected' : ''} key={option.id}><input type="radio" name="ssh-auth-kind" value={option.id} checked={authKind === option.id} disabled={busy || !!managementPending || !!machine&&!editing} onChange={() => {clearSecret(); setAuthKind(option.id); setSave(false);}}/><option.icon size={16}/><span>{option.label}</span></label>)}</div></fieldset>
        {authKind === 'key' && <label className="network-field">本机私钥文件<input aria-label="本机私钥路径" value={keyPath} disabled={busy || !!managementPending || !!machine&&!editing} onChange={event => setKeyPath(event.target.value)} placeholder={platform === 'win32' ? 'C:\\Users\\你的用户名\\.ssh\\id_ed25519' : '/home/你的用户名/.ssh/id_ed25519'} required/><small>填写当前电脑的路径，由后台读取。私钥文件保留在本机。</small></label>}
        {authKind !== 'agent' && <label className="network-field">{authKind === 'password' ? '登录密码' : '私钥解密口令（可选）'}<input ref={secret} aria-label={authKind === 'password' ? 'SSH 登录密码' : '私钥解密口令'} type="password" disabled={busy} required={authKind === 'password'&&!machine?.credentialAvailable} autoComplete="off"/></label>}
        {authKind !== 'agent' && saveSupported && <label className="network-checks"><input type="checkbox" checked={save} disabled={busy} onChange={event => setSave(event.target.checked)}/>在这台 Windows 电脑安全保存{authKind === 'password' ? '密码' : '口令'}</label>}
        {authKind === 'agent' && <p className="ssh-note">使用本机 SSH agent 中已加载的密钥。请先启动 agent 并添加密钥。</p>}
        <div className="ssh-actions"><span>{busy ? <><LoaderCircle size={15} className="ssh-spinner"/>{sshStageLabel(stage)}</> : retryUpload ? '重新检测后查看安装摘要，并再次确认安装。' : '连接后自动发现机器上的 Agent。'}</span><button className="btn primary" disabled={busy||!!managementPending&&!!editing} type="submit">{busy ? '正在测试' : editing?'保存并测试连接':retryUpload?'重新检测安装':'测试连接'}</button></div>
      </form>}
      {phase === 'trust' && challenge && <div className="ssh-host-trust"><ShieldCheck size={32}/><h3>确认服务器身份</h3><p>首次连接这台服务器，请核对主机密钥指纹。</p><dl><dt>服务器</dt><dd>{challenge.host}:{challenge.port}</dd><dt>密钥类型</dt><dd>{challenge.keyType}</dd><dt>SHA-256 指纹</dt><dd className="ssh-fingerprint">{challenge.fingerprint}</dd></dl><p className="ssh-note">可向服务器管理员核实此指纹。信任后才会登录并检查环境。</p><div className="ssh-actions"><button className="btn" disabled={busy} onClick={() => void closeDialog()}>取消连接</button><button className="btn primary" disabled={busy} onClick={() => void trustHost()}>{busy ? '正在检查' : '信任此主机并继续'}</button></div></div>}
      {phase === 'preview' && probe && <div className="ssh-install-preview"><div className="ssh-preview-heading"><Check size={22}/><div><h3>SSH 登录成功</h3><p>{username}@{host}:{port}</p></div></div><dl><dt>远端系统</dt><dd>{probe.platform} · {probe.arch}</dd><dt>用户目录</dt><dd>{probe.home}</dd><dt>Node.js</dt><dd>{probe.runtimeNeeded ? '随后台部署专用运行时' : probe.nodeVersion || '已就绪'}</dd><dt>远端后台</dt><dd>{probe.installNeeded ? '需要安装 AgentBridge daemon' : '已安装兼容版本'}{probe.daemonVersion ? ' · '+probe.daemonVersion : ''}</dd>{probe.packageBytes !== undefined && probe.installNeeded && <><dt>上传大小</dt><dd>{sshTransferSize(probe.packageBytes)}</dd></>}<dt>安装位置</dt><dd>{probe.installPath}</dd></dl>{probe.summary && <p className="ssh-note">{probe.summary}</p>}<p className="ssh-note">{probe.installNeeded ? '将在当前 Linux 用户目录安装并启动后台。后台独立运行，关闭窗口后任务继续执行。' : '连接已安装的后台，发现该用户可用的 Agent。'} 原生 Agent 沿用已有登录和配置。</p><div className="ssh-actions"><button className="btn" onClick={() => void closeDialog()}>取消</button><button className="btn primary" disabled={busy||managementPending} onClick={() => void connect()}><Server size={15}/>{probe.installNeeded ? '安装并连接' : '连接机器'}</button></div></div>}
      {phase === 'connecting' && <div className="ssh-connecting">{busy ? <LoaderCircle size={32} className="ssh-spinner"/> : <Server size={32}/>}<h3>{busy ? installProgress?.phase === 'verifying' ? '正在核对安装包完整性' : sshStageLabel(stage) : '请查看原连接状态'}</h3>{busy && installProgress && <div className="ssh-upload"><div className="ssh-progress" role="progressbar" aria-label="上传远端后台" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(installProgress.completedBytes / Math.max(1, installProgress.totalBytes) * 100))}><i style={{width:Math.min(100, installProgress.completedBytes / Math.max(1, installProgress.totalBytes) * 100)+'%'}}/></div><p>{sshTransferSize(installProgress.completedBytes)} / {sshTransferSize(installProgress.totalBytes)}</p></div>}<p>安装、启动和发现工具的进度会同步到机器列表。</p>{!busy && <button className="btn" onClick={onClose}>返回机器列表</button>}</div>}
    </div>
  </section></div>;
}
