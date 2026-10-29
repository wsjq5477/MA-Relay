const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
process.env.TSX_TSCONFIG_PATH = path.resolve(__dirname, '../tsconfig.json');
const { require: requireTsx } = require('tsx/cjs/api');
const { connectionError, relationCapabilityError, settleRejectedRelation } = requireTsx('../src/graph-state.ts', __filename);
const {
  bridgeCallerReason, canCallBridge, canConfigureMcp, canExecuteNode, canHostManagedTask,
  canReceiveDelegation, connectionCapability, connectionCapabilitySummary, mcpClientUnknownReason,
} = requireTsx('../src/connection-capabilities.ts', __filename);
const { createRequire } = require('node:module');
const desktopRequire = createRequire(path.resolve(__dirname, '../package.json'));
const React = desktopRequire('react');
const {renderToStaticMarkup} = desktopRequire('react-dom/server');
const {default: CollaborationChoice,PrimaryAgentButton} = requireTsx('../src/CollaborationChoice.tsx', __filename);
const MachineInventory = requireTsx('../src/MachineInventory.tsx', __filename).default;
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const noop=()=>{};
const {adapters,connectionCapabilities:backendCapabilities}=require('../electron/builtin-adapters.cjs');

function node(adapter, extra = {}) {
  return {nodeId: adapter, adapter, name: 'Claude Code', machineId: 'machine', executable: '/fixture/'+adapter,
    connected: true, online: true, healthy: true, available: true, busy: false,
    executionSupported: true, activeTasks: 0, status: 'connected', ...extra};
}

test('an unknown MCP caller cannot create a new delegation authorization without declaring a product limitation', () => {
  for (const adapter of ['hermes', 'pi', 'dsh', 'unknown']) {
    const leader = node(adapter, {teamCollaboration: true});
    const child = node('claude');
    const reason = connectionError({leaderId: leader.nodeId, memberIds: [], revision: 1}, [leader, child], leader.nodeId, child.nodeId);
    assert.match(reason, /Bridge|调用|能力/, adapter);
    assert.doesNotMatch(reason, /不支持|未适配/, adapter + ' must stay unknown, not a declared product limitation');
  }
  // Independent MCP callers are admitted once the backend projects the capability.
  const dshLeader = node('dsh', {connectionCapabilities: capabilities()});
  assert.equal(connectionError({leaderId: dshLeader.nodeId, memberIds: [], revision: 1}, [dshLeader, node('claude')], dshLeader.nodeId, 'claude'), '');
});

function capabilities(overrides={}) {
  return {
    execution:true, delegation:true, bridgeMcp:true,
    mcpClient:true, nativeMcpConfig:true, hostManagedTask:true,
    resume:true, cancellation:true, permissions:false, forms:false, verification:false,
    ...overrides,
  };
}

test('every executable registered adapter can attach and start through the renderer with production capability metadata', () => {
  const machine={machineId:'machine',name:'machine',kind:'windows',platform:'win32',online:true};
  for(const descriptor of adapters.list()) {
    if(descriptor.capabilities.execution!==true)continue;
    const input=node(descriptor.id,{name:descriptor.name,teamCollaboration:descriptor.capabilities.teamCollaboration});
    Object.assign(input,backendCapabilities(input));
    const projected=input.connectionCapabilities;
    const expectedCaller=typeof projected.bridgeMcp==='boolean'?projected.bridgeMcp
      :typeof projected.mcpClient==='boolean'?projected.mcpClient:null;
    assert.equal(canExecuteNode(input),true,descriptor.id+' must not be hidden by a stale UI registry');
    assert.equal(canReceiveDelegation(input),descriptor.capabilities.delegation===true,descriptor.id);
    assert.equal(canCallBridge(input),expectedCaller===true,descriptor.id+' must follow the backend projection');
    for(const connected of [false,true]) {
      const target={...input,connected,status:connected?'connected':'discovered'};
      const html=render(MachineInventory,{machines:[machine],nodes:[target],relation:{leaderId:null,memberIds:[],revision:0},filter:'all',query:'',busy:false,metadataBusy:false,managementSupported:true,machineManagementSupported:true,daemonManagementSupported:true,blocked:()=>false,start:noop,attach:noop,nodeAction:noop,addAgent:noop,machineAction:noop});
      assert.doesNotMatch(html,/尚未支持执行|执行能力未知/,descriptor.id);
      assert.match(html,connected?/<button\b(?![^>]*disabled)[^>]*>开始会话/:/<button\b(?![^>]*disabled)[^>]*>[\s\S]*?接入/,descriptor.id);
    }
    for(const value of [false,null]) {
      const narrowed={...input,connectionCapabilities:{...input.connectionCapabilities,execution:value}};
      assert.equal(canExecuteNode(narrowed),false,descriptor.id+' cannot widen an explicit capability restriction');
    }
    assert.equal(canExecuteNode({...input,capabilitySource:{kind:'static-adapter',adapterId:'other'}}),false);
  }
});

test('MCP calling is no longer narrowed by managed-task support or the old three-product list', () => {
  for(const adapter of ['claude','codex','opencode','opendesk','opendesk-desktop','dsh','dsh-desktop','dsh-web']) {
    const managed=['claude','codex','opencode'].includes(adapter);
    const input=node(adapter,{
      teamCollaboration:false,
      connectionCapabilities:capabilities({mcpClient:true,bridgeMcp:true,nativeMcpConfig:true,hostManagedTask:managed}),
    });
    assert.equal(canCallBridge(input),true,adapter+' must not be narrowed by teamCollaboration');
    assert.equal(connectionCapability(input,'bridgeMcp'),true,adapter);
    assert.equal(canConfigureMcp(input),true,adapter);
    assert.equal(canHostManagedTask(input),managed,adapter);
  }
  // The legacy node-level flag means managed-task hosting only.
  assert.equal(canCallBridge(node('claude',{teamCollaboration:false,connectionCapabilities:capabilities()})),true);
  assert.equal(canCallBridge(node('opendesk',{teamCollaboration:false,connectionCapabilities:capabilities({hostManagedTask:false})})),true);
  // An explicit backend false is still honored.
  assert.equal(canCallBridge(node('dsh',{connectionCapabilities:capabilities({bridgeMcp:false,mcpClient:false})})),false);
  assert.match(bridgeCallerReason(node('dsh',{connectionCapabilities:capabilities({bridgeMcp:false,mcpClient:false})})),/该产品未确认提供 MCP 客户端/);
});

test('products with an unknown MCP client stay unknown instead of being declared unsupported', () => {
  for(const adapter of ['hermes','pi']) {
    const input=node(adapter,{connectionCapabilities:capabilities({bridgeMcp:null,mcpClient:null,nativeMcpConfig:false,hostManagedTask:false})});
    assert.equal(connectionCapability(input,'mcpClient'),null,adapter);
    assert.equal(canExecuteNode(input),true,adapter+' execution stays independent from MCP');
    assert.equal(canReceiveDelegation(input),true,adapter);
    assert.equal(canCallBridge(input),false,adapter);
    assert.equal(canConfigureMcp(input),false,adapter);
    assert.equal(canHostManagedTask(input),false,adapter);
    assert.match(bridgeCallerReason(input),/MCP 调用能力未确认/,adapter);
    assert.doesNotMatch(bridgeCallerReason(input),/不支持|未适配|协作|托管/,adapter+' must not invent a limitation or fold managed-task support');
    assert.match(mcpClientUnknownReason(input),/MCP 调用能力未确认/,adapter);
    assert.match(connectionCapabilitySummary(input),/可被委派.*MCP 调用能力未确认/,adapter);
  }
});

test('an old snapshot without a directional contract stays unknown instead of guessing', () => {
  for(const adapter of ['claude','opencode','codex','opendesk','opendesk-desktop','dsh','dsh-desktop','dsh-web']) {
    const input=node(adapter);
    assert.equal(connectionCapability(input,'execution'),true,adapter);
    assert.equal(connectionCapability(input,'delegation'),true,adapter);
    assert.equal(connectionCapability(input,'bridgeMcp'),null,adapter);
    assert.equal(connectionCapability(input,'mcpClient'),null,adapter);
    assert.equal(connectionCapability(input,'nativeMcpConfig'),null,adapter);
    assert.equal(connectionCapability(input,'hostManagedTask'),null,adapter);
    assert.equal(canCallBridge(input),false,adapter);
    assert.match(bridgeCallerReason(input),/MCP 调用能力未确认/,adapter);
    assert.equal(canConfigureMcp(input),false,adapter);
  }
  assert.equal(canCallBridge(node('claude',{connectionCapabilities:{execution:true}})),false,'missing field in the new contract is unknown');
  assert.equal(canConfigureMcp(node('claude',{connectionCapabilities:{execution:true}})),false,'missing native config field is unknown');
  // The legacy alias is projected from mcpClient when bridgeMcp is absent.
  assert.equal(connectionCapability(node('claude',{connectionCapabilities:{execution:true,mcpClient:true}}),'bridgeMcp'),true);
  assert.equal(canCallBridge(node('claude',{connectionCapabilities:{execution:true,mcpClient:true}})),true);
  assert.equal(connectionCapability(node('claude',{connectionCapabilities:{execution:true,mcpClient:false}}),'bridgeMcp'),false);
  for(const extra of [{},{connectionCapabilities:capabilities()},{capabilitySource:{kind:'unknown'},connectionCapabilities:capabilities()}]) {
    const unknown=node('unregistered',{...extra,name:'Claude Code',teamCollaboration:true});
    assert.equal(canExecuteNode(unknown),false);assert.equal(canCallBridge(unknown),false);assert.equal(canReceiveDelegation(unknown),false);
    assert.equal(canConfigureMcp(unknown),false);assert.equal(canHostManagedTask(unknown),false);
  }
  assert.equal(canExecuteNode(node('claude',{capabilitySource:{kind:'unknown'},connectionCapabilities:capabilities()})),false);
  assert.equal(canConfigureMcp(node('claude',{capabilitySource:{kind:'unknown'},connectionCapabilities:capabilities()})),false);
  assert.equal(canExecuteNode(node('claude',{capabilitySource:{kind:'static-adapter',adapterId:'codex'},connectionCapabilities:capabilities()})),false);
});

test('explicit execution refusal zeroes execution, delegation, MCP and the new dimensions', () => {
  for(const unavailable of [false,null]) {
    const input=node('claude',{executionSupported:false,connectionCapabilities:capabilities({execution:unavailable,bridgeMcp:unavailable,mcpClient:unavailable})});
    assert.equal(canExecuteNode(input),false);assert.equal(canCallBridge(input),false);
    assert.equal(canConfigureMcp(input),false);assert.equal(canHostManagedTask(input),false);
  }
});

test('graph validation checks both ends and leaves historical relationships readable and removable', () => {
  const leader=node('codex',{connectionCapabilities:capabilities()}), child=node('pi',{connectionCapabilities:capabilities({bridgeMcp:null,mcpClient:null})}), original={leaderId:'codex',memberIds:['pi'],revision:3};
  const before=JSON.parse(JSON.stringify(original));
  assert.equal(relationCapabilityError(original,[leader,child]),'');
  assert.match(relationCapabilityError(original,[node('codex',{connectionCapabilities:capabilities({bridgeMcp:null,mcpClient:null})}),child]),/未知|未确认/);
  assert.match(relationCapabilityError(original,[leader,node('pi',{connectionCapabilities:capabilities({delegation:false})})]),/受委派/);
  assert.deepEqual(original,before);
  assert.equal(relationCapabilityError({leaderId:null,memberIds:[],revision:3},[]),'','clearing an unsupported historical leader remains possible');
});

test('caller controls explain unknown MCP clients without requiring the old three products', () => {
  for(const adapter of ['hermes','pi']) {
    const input=node(adapter,{connectionCapabilities:capabilities({bridgeMcp:null,mcpClient:null,nativeMcpConfig:false,hostManagedTask:false})});
    const html=render(CollaborationChoice,{node:input,isLeader:true,checked:true,onChange:noop});
    assert.match(html,/<input\b[^>]*type="checkbox"[^>]*disabled/);
    assert.doesNotMatch(html,/<input\b[^>]*checked/);
    assert.match(html,/可被委派.*MCP 调用能力未确认/);
    assert.match(html,/已有主节点记录保留/);
    const button=render(PrimaryAgentButton,{node:input,onSelect:noop});
    assert.match(button,/<button\b[^>]*disabled/);
    assert.match(button,/MCP 调用能力未确认/);
    assert.doesNotMatch(button,/不支持|未适配/);
    const ordinary=render(CollaborationChoice,{node:input,isLeader:false,checked:false,onChange:noop});
    assert.doesNotMatch(ordinary,/<input/);assert.match(ordinary,/可被委派/);
  }
  for(const adapter of ['claude','opencode','codex','opendesk','opendesk-desktop','dsh','dsh-desktop','dsh-web']) {
    const managed=['claude','opencode','codex'].includes(adapter), input=node(adapter,{connectionCapabilities:capabilities({hostManagedTask:managed})});
    const html=render(CollaborationChoice,{node:input,isLeader:true,checked:true,onChange:noop});
    assert.match(html,/<input\b[^>]*checked/);assert.doesNotMatch(html,/<input\b[^>]*disabled/);
    assert.doesNotMatch(render(PrimaryAgentButton,{node:input,onSelect:noop}),/<button\b[^>]*disabled/);
    if(managed)assert.doesNotMatch(html,/托管任务绑定/,adapter);
    else assert.match(html,/托管任务绑定未适配/,adapter+' is an independent MCP caller without managed-task injection');
  }
});

test('inventory can start a direct-only child while explicitly disabling unconfirmed or denied execution', () => {
  const machine={machineId:'machine',name:'machine',kind:'linux',platform:'linux',online:true};
  const inputs=[node('hermes',{name:'direct Hermes',connectionCapabilities:capabilities({bridgeMcp:null,mcpClient:null,nativeMcpConfig:false})}),node('pi',{name:'unconfirmed Pi',connectionCapabilities:capabilities({execution:null})}),node('unknown',{name:'Claude Code',connectionCapabilities:capabilities()})];
  const html=render(MachineInventory,{machines:[machine],nodes:inputs,relation:{leaderId:null,memberIds:['hermes'],revision:1},filter:'all',query:'',busy:false,metadataBusy:false,managementSupported:true,machineManagementSupported:true,daemonManagementSupported:true,blocked:()=>false,start:noop,attach:noop,nodeAction:noop,addAgent:noop,machineAction:noop});
  const articles=Array.from(html.matchAll(/<article\b[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g));
  const direct=articles.find(item=>item[1].startsWith('direct Hermes'))[2];
  assert.match(direct,/子 Agent/);assert.match(direct,/可被委派.*MCP 调用能力未确认/);
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
  const leader = node('claude', {connectionCapabilities:capabilities()});
  const relation = {leaderId: leader.nodeId, memberIds: [], revision: 1};
  for (const adapter of ['hermes', 'pi', 'dsh']) {
    const child = node(adapter, {teamCollaboration: false, connectionCapabilities:capabilities({bridgeMcp:null,mcpClient:null,nativeMcpConfig:false,hostManagedTask:false})});
    assert.equal(connectionError(relation, [leader, child], leader.nodeId, child.nodeId), '');
  }
  const unknown = node('unregistered', {teamCollaboration: true});
  assert.match(connectionError(relation, [leader, unknown], leader.nodeId, unknown.nodeId), /能力|委派|执行/);
});

test('issue25: relation capability checks admit only new roles and never re-admit retained offline members on revocation',()=>{
 const leader=node('claude',{connectionCapabilities:capabilities()}),member=node('codex',{connectionCapabilities:capabilities()}),added=node('opencode',{connectionCapabilities:capabilities()});
 const base={leaderId:leader.nodeId,memberIds:[member.nodeId],revision:1};
 const unavailable=[{...leader,connected:false},{...member,connected:false,executionSupported:false},added];
 assert.equal(relationCapabilityError({...base,memberIds:[]},unavailable,base),'');
 assert.equal(relationCapabilityError({...base,memberIds:[member.nodeId,added.nodeId]},unavailable,base),'');
 assert.equal(relationCapabilityError({...base,leaderId:added.nodeId},unavailable,base),'');
 assert(relationCapabilityError({...base,leaderId:member.nodeId,memberIds:[]},unavailable,base));
 assert(relationCapabilityError({...base,memberIds:['unknown']},unavailable,base));
 assert.match(relationCapabilityError({...base,memberIds:[leader.nodeId]},[leader,member],base),/不能连接自己/);
});

test('SSH node status renders the current inspection or version refusal instead of generic offline',()=>{
  const {sshNodeState}=requireTsx('../src/ssh-node-state.ts',__filename);
  const machine={machineId:'machine',name:'Synthetic SSH',kind:'ssh',platform:'linux',online:false,stage:'inspecting'};
  const input=node('claude',{online:false,available:false,status:'offline',connectionState:'inspecting',lastError:{message:'obsolete offline reason'}});
  const props={machines:[machine],nodes:[input],relation:{leaderId:null,memberIds:[],revision:0},filter:'all',query:'',busy:false,metadataBusy:false,managementSupported:true,machineManagementSupported:true,daemonManagementSupported:true,blocked:()=>false,start:noop,attach:noop,nodeAction:noop,addAgent:noop,machineAction:noop};
  assert.equal(sshNodeState(input),'正在检查远端环境');const html=render(MachineInventory,props);assert.match(html,/正在检查远端环境/);assert.doesNotMatch(html,/obsolete offline reason/);
  const refused={...input,connectionState:'disconnected',errorCode:'SSH_DAEMON_UPGRADE_REQUIRED',error:'远端后台版本不受当前客户端支持'};
  assert.match(render(MachineInventory,{...props,nodes:[refused]}),/远端后台版本不受当前客户端支持/);
  assert.equal(sshNodeState(node('claude')),undefined);
});
