// Once used in a durable delegation, this version's text must remain stable.
// This is task context, not an authorization mechanism or an MCP connection.
const version=1;
const prefix='[协作任务说明]\n这是主 Agent 经 AgentBridge 转交给你的单项任务。请完成下方需求，并在本会话报告结果、证据和未完成事项，由 Bridge 交回主 Agent。不要继续委派或修改连接关系；需要额外信息或授权时，在结果中说明并交回主 Agent。此说明不附带新的协作工具或权限，也不代替用户的原生权限确认。\n\n[委派需求]\n';
function renderDelegation(delegation){
  // Missing version means an original pre-context delegation. Never rewrite it.
  if(delegation.contextVersion===undefined)return delegation.message;
  if(delegation.contextVersion!==version)throw Object.assign(new Error('原委派的上下文版本暂不受支持，请保留原请求并查询原记录。'),{code:'DELEGATION_CONTEXT_UNSUPPORTED'});
  const message=prefix+delegation.message;
  if(Buffer.byteLength(message,'utf8')>65536)throw Object.assign(new Error('委派需求加协作说明超过64KiB，请缩短需求；内容未派发或截断。'),{code:'INVALID_INPUT'});
  return message;
}
module.exports={version,renderDelegation};
