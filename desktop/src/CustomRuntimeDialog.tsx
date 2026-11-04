import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { call } from "./api";
import type { Machine } from "./types";

export default function CustomRuntimeDialog({ machine, onClose, onCreated }: {
  machine: Machine;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [adapter, setAdapter] = useState("");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const [profileId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step === 1) {
      if (adapter) setStep(2);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await call("customRuntime.create", { machineId: machine.machineId, adapter, name, command, description, profileId });
      await onCreated();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-overlay">
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-runtime-title" onSubmit={submit}>
      <div className="modal-head">
        <h2 id="custom-runtime-title">新建自定义运行时</h2>
        <button type="button" className="icon-btn" aria-label="关闭" disabled={busy} onClick={onClose}><X size={18} /></button>
      </div>
      <div className="modal-body">
        <p>{machine.name} · 第 {step} / 2 步</p>
        {step === 1 ? <>
          <label>基础 Agent 类型
            <select value={adapter} onChange={event => setAdapter(event.target.value)} required autoFocus>
              <option value="">选择兼容的 Agent 类型</option>
              <option value="hermes">Hermes</option>
            </select>
          </label>
          <p>请选择启动命令实际兼容的协议类型。创建后协议类型固定。</p>
        </> : <>
          <p>基础 Agent 类型 · Hermes</p>
          <label>显示名称<input value={name} onChange={event => setName(event.target.value)} required maxLength={80} autoFocus /></label>
          <label>命令<input value={command} onChange={event => setCommand(event.target.value)} required maxLength={4096} placeholder="hermes-wrapper start" aria-describedby="custom-runtime-command-help" /></label>
          <p id="custom-runtime-command-help">输入程序名或绝对路径和固定参数。带空格的路径请加引号。凭据请留在原生配置中。</p>
          <label>描述（可选）<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} /></label>
          {error && <p role="alert">{error}</p>}
        </>}
      </div>
      <div className="modal-footer">
        {step === 2 && <button type="button" className="text-btn" disabled={busy} onClick={() => setStep(1)}>返回</button>}
        <button type="button" className="btn" disabled={busy} onClick={onClose}>取消</button>
        <button type="submit" className="btn primary" disabled={busy || (step === 1 ? !adapter : !name.trim() || !command.trim())}>
          {step === 1 ? "下一步" : busy ? "正在探测…" : "创建运行时"}
        </button>
      </div>
    </form>
  </div>;
}
