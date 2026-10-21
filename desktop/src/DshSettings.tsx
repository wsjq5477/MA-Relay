import {useEffect, useState} from 'react';
import {call} from './api';
import AgentIcon from './AgentIcon';
import type {AgentNode} from './types';

interface Connection {adapter: string; origin: string; enabled: boolean; executable: string; error?: string}
export default function DshSettings({node, disabled = false, onBusyChange}: {
  node: AgentNode;
  disabled?: boolean;
  onBusyChange?: (busy:boolean) => void;
}) {
  const {machineId, adapter, executable} = node;
  const [url, setUrl] = useState('http://127.0.0.1:3080/');
  const [token, setToken] = useState('');
  const [connection, setConnection] = useState<Connection|null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    let current = true;
    setConnection(null); setNotice(''); setToken(''); setLoaded(false);
    setUrl('http://127.0.0.1:3080/');
    void call<{items: Connection[]}>('dsh.status', {machineId}).then(result => {
      if (!current) return;
      // This installation never inherits another service's configuration.
      const saved = result.items.find(row => row.adapter === adapter && row.executable === executable);
      setConnection(saved || null);
      if (saved?.origin) setUrl(saved.origin + '/');
      setLoaded(true);
    }).catch(error => {if (current) setNotice(error.message);});
    return () => {current = false;};
  }, [machineId, adapter, executable, revision]);
  async function save(toggle = false) {
    if (busy || disabled || !loaded || connection?.error || toggle && !connection) return;
    setBusy(true); setNotice('');
    try {
      const address = toggle ? connection!.origin : url;
      const result = await call<{items: Connection[]}>('dsh.configure', {
        machineId, adapter, url: address,
        ...(toggle ? {enabled: !connection!.enabled} : {token}),
      });
      const origin = new URL(address).origin;
      setConnection(result.items.find(row => row.adapter === adapter && row.origin === origin) || null);
      setUrl(origin + '/');
      setNotice('连接已保存。请关闭配置，重新扫描本机器并接入对应 DSH 节点。');
    } catch (error) {
      setNotice((error as Error).message + ' 请刷新连接状态核对保存结果。');
    } finally {setToken(''); setBusy(false);}
  }
  return <section className="settings-card network-relations settings-dsh" aria-labelledby="settings-dsh">
    <div className="settings-card-heading"><AgentIcon adapter={adapter}/><div><h2 id="settings-dsh">DSH 服务连接</h2><p>连接已运行的 {adapter === 'dsh-desktop' ? 'Desktop' : 'Web'}，沿用原生登录、模型和权限。</p></div></div>
    <p className="settings-footnote">填写当前机器可访问的服务根地址和连接 token。HTTP 使用该机器的本机地址，token 仅保存在目标机器私有配置中。Desktop 需要开启原生浏览器访问，原生权限和问题仍在 DSH 界面处理。</p>
    <label className="settings-row">服务地址<input aria-label="DSH 服务地址" value={url} disabled={busy || disabled || !loaded} onChange={event => setUrl(event.target.value)}/></label>
    <label className="settings-row">连接 token<input aria-label="DSH 连接 token" type="password" autoComplete="off" value={token} disabled={busy || disabled || !loaded} onChange={event => setToken(event.target.value)}/></label>
    <div className="ssh-actions">
      <button className="btn primary" disabled={busy || disabled || !loaded || !url || !!connection?.error} onClick={() => void save()}>保存 DSH 连接</button>
      <button className="btn" disabled={busy} onClick={() => setRevision(value => value + 1)}>刷新连接状态</button>
    </div>
    {!loaded && !notice && <p role="status">正在读取连接状态…</p>}
    {connection && <div className="settings-row"><span>{connection.origin} · {connection.error || (connection.enabled ? '已启用' : '已停用')}</span><button className="btn" disabled={busy || disabled || !!connection.error} onClick={() => void save(true)}>{connection.enabled ? '停用连接' : '启用连接'}</button></div>}
    <p className="settings-footnote">停用保留历史和原请求。服务重启后若 token 变化，请更新原地址；更换服务地址会形成新连接。Desktop、Web 和 CLI 会话分别归属。</p>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
