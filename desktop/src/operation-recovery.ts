export interface ManagementRecord {
  operationId: string;
  lane: 'node' | 'machine' | 'relation' | 'layout';
  machineId?: string;
  nodeId?: string;
  action?: string;
  time?: string;
  reason?: string;
}

export const managementQuery = (lane: ManagementRecord['lane']) => ({
  node: 'nodeOperation', machine: 'machine.operation',
  relation: 'collaborationOperation', layout: 'graphLayoutOperation',
})[lane];

export function managementLabel(record: ManagementRecord) {
  const action = ({attach:'接入',disconnect:'断开',remove:'移除',restore:'恢复',reconnect:'重连',updateSsh:'编辑连接',maintainDaemon:'后台维护'} as Record<string,string>)[record.action || ''] || '管理';
  return record.lane === 'relation' ? '保存协作授权' : record.lane === 'layout' ? '保存关系图布局' : (record.lane === 'node' ? 'Agent ' : '机器') + action;
}

// Select display fields explicitly: machine-operation params may contain
// connection configuration, which does not belong in the recovery view.
export function managementRecords(rows: {operationId:string;lane:ManagementRecord['lane'];method?:string;params?:{machineId?:string;nodeId?:string;action?:string};time?:string;error?:{message?:string}}[]): ManagementRecord[] {
  return rows.map(row => ({operationId:row.operationId,lane:row.lane,machineId:row.params?.machineId,nodeId:row.params?.nodeId,
    action:row.params?.action || (row.lane === 'machine' ? row.method?.slice(8) : undefined),time:row.time,reason:row.error?.message}));
}
