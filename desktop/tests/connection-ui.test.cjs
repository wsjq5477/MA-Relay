const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
process.env.TSX_TSCONFIG_PATH = path.resolve(__dirname, '../tsconfig.json');
const { require: requireTsx } = require('tsx/cjs/api');
const { connectionError, relationCapabilityError, settleRejectedRelation } = requireTsx('../src/graph-state.ts', __filename);
const {canCallBridge,canExecuteNode,canReceiveDelegation,connectionCapability,connectionCapabilitySummary} = requireTsx('../src/connection-capabilities.ts', __filename);
const { createRequire } = require('node:module');
const desktopRequire = createRequire(path.resolve(__dirname, '../package.json'));
const React = desktopRequire('react');
const {renderToStaticMarkup} = desktopRequire('react-dom/server');
const {default: CollaborationChoice,PrimaryAgentButton} = requireTsx('../src/CollaborationChoice.tsx', __filename);
const MachineInventory = requireTsx('../src/MachineInventory.tsx', __filename).default;
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const noop=()=>{};

function node(adapter, extra = {}) {
  return {nodeId: adapter, adapter, name: 'Claude Code', machineId: 'machine', executable: '/fixture/'+adapter,
    connected: true, online: true, healthy: true, available: true, busy: false,
    executionSupported: true, activeTasks: 0, status: 'connected', ...extra};
}

test('a direct-only or unknown historical leader cannot create a new delegation authorization', () => {
  for (const adapter of ['hermes', 'pi', 'dsh', 'unknown']) {
    const leader = node(adapter, {teamCollaboration: true});
    const child = node('claude');
    assert.match(connectionError({leaderId: leader.nodeId, memberIds: [], revision: 1}, [leader, child], leader.nodeId, child.nodeId), /Bridge|调用|能力/);
  }
});

function capabilities(overrides={}) {
  return {execution:true,delegation:true,bridgeMcp:true,resume:true,cancellation:true,permissions:false,forms:false,verification:false,...overrides};
}

test('directional claims distinguish caller, recipient and direct execution while preserving reviewed old snapshots', () => {
  for(const adapter of ['claude','opencode','codex']) {
    const input=node(adapter);
    assert.equal(canCallBridge(input),true);
    assert.equal(canReceiveDelegation(input),true);
    assert.equal(connectionCapability(input,'permissions'),null,'an old snapshot does not establish a new control contract');
    const noMcp=node(adapter,{connectionCapabilities:capabilities({bridgeMcp:false})});
    assert.equal(canCallBridge(noMcp),false);
    assert.equal(canExecuteNode(noMcp),true);
    assert.equal(canReceiveDelegation(noMcp),true);
    const noDelegation=node(adapter,{connectionCapabilities:capabilities({delegation:false})});
    assert.equal(canExecuteNode(noDelegation),true);
    assert.equal(canReceiveDelegation(noDelegation),false);
    assert.equal(canCallBridge(noDelegation),true);
    for(const unavailable of [null,false]) {
      const input=node(adapter,{connectionCapabilities:capabilities({execution:unavailable,bridgeMcp:unavailable})});
      assert.equal(canExecuteNode(input),false);assert.equal(canCallBridge(input),false);
    }
    assert.equal(canCallBridge(node(adapter,{teamCollaboration:false})),false);
    assert.equal(canReceiveDelegation(node(adapter,{teamCollaboration:false})),true);
    assert.equal(canCallBridge(node(adapter,{connectionCapabilities:{execution:true}})),false,'missing field in the new contract is unknown');
  }
  for(const adapter of ['hermes','pi','dsh']) {
    const input=node(adapter,{connectionCapabilities:capabilities(),teamCollaboration:true});
    assert.equal(canCallBridge(input),false,'the reviewed direct adapters do not inject MCP');
    assert.equal(canReceiveDelegation(input),true);
    assert.match(connectionCapabilitySummary(input),/可被委派.*暂不能调用 Bridge MCP/);
  }
  for(const extra of [{},{connectionCapabilities:capabilities()},{capabilitySource:{kind:'unknown'},connectionCapabilities:capabilities()}]) {
    const unknown=node('unregistered',{...extra,name:'Claude Code',teamCollaboration:true});
    assert.equal(canExecuteNode(unknown),false);assert.equal(canCallBridge(unknown),false);assert.equal(canReceiveDelegation(unknown),false);
  }
  assert.equal(canExecuteNode(node('claude',{capabilitySource:{kind:'unknown'},connectionCapabilities:capabilities()})),false);
  assert.equal(canExecuteNode(node('claude',{capabilitySource:{kind:'static-adapter',adapterId:'codex'},connectionCapabilities:capabilities()})),false);
});

test('graph validation checks both ends and leaves historical relationships readable and removable', () => {
  const leader=node('codex'), child=node('pi'), original={leaderId:'codex',memberIds:['pi'],revision:3};
  const before=JSON.parse(JSON.stringify(original));
  assert.equal(relationCapabilityError(original,[leader,child]),'');
  assert.match(relationCapabilityError(original,[node('codex',{connectionCapabilities:capabilities({bridgeMcp:null})}),child]),/未知/);
  assert.match(relationCapabilityError(original,[leader,node('pi',{connectionCapabilities:capabilities({delegation:false})})]),/受委派/);
  assert.deepEqual(original,before);
  assert.equal(relationCapabilityError({leaderId:null,memberIds:[],revision:3},[]),'','clearing an unsupported historical leader remains possible');
});

test('caller controls explain direct-only historical leaders without checking or enabling collaboration', () => {
  for(const adapter of ['hermes','pi','dsh']) {
    const input=node(adapter), html=render(CollaborationChoice,{node:input,isLeader:true,checked:true,onChange:noop});
    assert.match(html,/<input\b[^>]*type="checkbox"[^>]*disabled/);
    assert.doesNotMatch(html,/<input\b[^>]*checked/);
    assert.match(html,/可被委派.*暂不能调用 Bridge MCP/);
    assert.match(html,/已有主节点记录保留/);
    const button=render(PrimaryAgentButton,{node:input,onSelect:noop});
    assert.match(button,/<button\b[^>]*disabled/);
    assert.match(button,/不能作为主 Agent/);
    const ordinary=render(CollaborationChoice,{node:input,isLeader:false,checked:false,onChange:noop});
    assert.doesNotMatch(ordinary,/<input/);assert.match(ordinary,/可被委派/);
  }
  for(const adapter of ['claude','opencode','codex']) {
    const html=render(CollaborationChoice,{node:node(adapter),isLeader:true,checked:true,onChange:noop});
    assert.match(html,/<input\b[^>]*checked/);assert.doesNotMatch(html,/<input\b[^>]*disabled/);
    assert.doesNotMatch(render(PrimaryAgentButton,{node:node(adapter),onSelect:noop}),/<button\b[^>]*disabled/);
  }
});

test('inventory can start a direct-only child while explicitly disabling unconfirmed or denied execution', () => {
  const machine={machineId:'machine',name:'machine',kind:'linux',platform:'linux',online:true};
  const inputs=[node('hermes',{name:'direct Hermes'}),node('pi',{name:'unconfirmed Pi',connectionCapabilities:capabilities({execution:null})}),node('unknown',{name:'Claude Code',connectionCapabilities:capabilities()})];
  const html=render(MachineInventory,{machines:[machine],nodes:inputs,relation:{leaderId:null,memberIds:['hermes'],revision:1},filter:'all',query:'',busy:false,metadataBusy:false,managementSupported:true,machineManagementSupported:true,daemonManagementSupported:true,blocked:()=>false,start:noop,attach:noop,nodeAction:noop,addAgent:noop,machineAction:noop});
  const articles=Array.from(html.matchAll(/<article\b[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g));
  const direct=articles.find(item=>item[1].startsWith('direct Hermes'))[2];
  assert.match(direct,/子 Agent/);assert.match(direct,/可被委派.*暂不能调用 Bridge MCP/);
  assert.match(direct,/<button\b(?![^>]*disabled)[^>]*>开始会话/);
  for(const name of ['unconfirmed Pi','Claude Code']) {
    const article=articles.find(item=>item[1].startsWith(name))[2];
    assert.match(article,/<button\b[^>]*disabled[^>]*>开始会话/);
    assert.match(article,/执行能力未知/);
  }
});

test('a lost original relation rejection settles only that pending ID after reopen and preserves the draft', () => {
  const original={base:{leaderId:'claude',memberIds:[],revision:1},draft:{leaderId:'hermes',memberIds:[],revision:1},relationPending:{operationId:'original-id',params:{leaderId:'hermes'}},layoutPending:{operationId:'layout-original'}};
  const restored=JSON.parse(JSON.stringify(original));
  const receipt={operationId:'original-id',state:'rejected',error:{code:'COLLABORATION_CAPABILITY',message:'not a caller'}};
  const settled=settleRejectedRelation(restored,receipt,'original-id');
  assert.equal(settled.relationPending,null);assert.equal(settled.base,restored.base);assert.equal(settled.draft,restored.draft);assert.equal(settled.layoutPending,restored.layoutPending);
  for(const reply of [{...receipt,operationId:'other'}, {...receipt,state:'not_found'}, {...receipt,state:'unknown'}, {...receipt,error:{code:'ADAPTER_UNSUPPORTED',message:'ambiguous'}}, {...receipt,error:undefined}])
    assert.equal(settleRejectedRelation(restored,reply,'original-id'),restored);
  assert.equal(settleRejectedRelation({...restored,relationPending:{operationId:'other-original'}},receipt,'original-id').relationPending.operationId,'other-original');
});

test('ordinary child nodes need execution/delegation capability without needing Bridge MCP injection', () => {
  const leader = node('claude');
  const relation = {leaderId: leader.nodeId, memberIds: [], revision: 1};
  for (const adapter of ['hermes', 'pi', 'dsh']) {
    const child = node(adapter, {teamCollaboration: false});
    assert.equal(connectionError(relation, [leader, child], leader.nodeId, child.nodeId), '');
  }
  const unknown = node('unregistered', {teamCollaboration: true});
  assert.match(connectionError(relation, [leader, unknown], leader.nodeId, unknown.nodeId), /能力|委派|执行/);
});
