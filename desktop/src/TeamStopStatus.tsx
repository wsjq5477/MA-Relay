import type {TeamContext} from './team-types';

export const cancellationLabel: Record<string, string> = {
  awaiting_original: '等待核对原执行，尚未发送取消',
  pending: '取消请求已记录，正在核对回应',
  unknown: '取消回应待核对，只查询原操作',
  confirmed: '取消操作已确认，仍以原执行终态为准',
  rejected: '取消被拒绝，请到原任务查看原因',
  unsupported: '当前入口无法自动取消，请到原任务停止',
};

export default function TeamStopStatus({context}: {context: TeamContext}) {
  const stop = context.stop;
  if (!context.stopSupported) return <p className="team-meta">当前后台尚不支持停止整项工作，请停止旧后台后重开新版程序。</p>;
  if (!stop) return null;
  return <section className="team-card" aria-label="工作停止进度">
    <h2>{context.run.state === 'stopping' ? '正在停止本项工作' : '本项工作已停止并归档'}</h2>
    <p role="status">新调度已停止，成员访问已撤销。{stop.unresolved ? `还有 ${stop.unresolved} 项原生执行待核对终态。` : '关联原生执行均已核对终态。'}</p>
    <p className="team-meta">已有消息、文档、任务和结果保留。取消回执不代表原执行已经结束，归档也不代表业务验收通过。</p>
    {stop.externalCount > 0 && <p role="status">本项工作含 {stop.externalCount} 位外部 MCP 成员；Bridge 已撤销本工作访问，它们自身的运行需在原入口停止。</p>}
    {context.run.state === 'stopping' && <p className="team-meta">恢复原机器连接后点击“刷新工作”，继续查询原执行和原取消操作。</p>}
  </section>;
}
