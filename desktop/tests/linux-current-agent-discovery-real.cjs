// Real installed CLI version + isolated production inventory. No model/profile writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-current-agent-real-'));
  const network=new AgentNetwork({directory,platform:'linux',hostname:'isolated-version-check',createHost:()=>new MachineHost({
    directory:path.join(directory,'host'),home:os.homedir(),environment:process.env,
    candidates:{codex:[],opencode:[],hermes:[],pi:[],dsh:[]},
    legacy:{async call(method){assert.equal(method,'snapshot');return {agents:{items:[]},tasks:[],conversations:[]};},close(){}},
  })});
  try{
    const nativeVersion=execFileSync('claude',['--version'],{encoding:'utf8',timeout:5000}).trim();
    const version=nativeVersion.match(/\d+\.\d+\.\d+/)[0];
    const machineId=network.catalog.localMachineId;
    network.network.nodes=[
      {nodeId:'original-claude',machineId,adapter:'claude',name:'Claude Code',executable:'/historical/2.1.296/claude',version:'2.1.296',connected:true},
      {nodeId:'historical-claude',machineId,adapter:'claude',name:'Claude Code',executable:'/historical/2.1.299/claude',version:'2.1.299',connected:false},
    ];
    network.network.collaboration={leaderId:'original-claude',memberIds:[],revision:3};
    const snapshot=await network.snapshot(),visible=snapshot.nodes.filter(n=>!n.supersededBy);
    assert.equal(visible.length,1);assert.equal(visible[0].version,version);assert.equal(visible[0].healthy,true);
    assert.equal(visible[0].nodeId,'original-claude');assert.equal(visible[0].connected,true);
    assert.equal(snapshot.collaboration.leaderId,'original-claude');assert.equal(snapshot.collaboration.revision,3);
    assert.equal(snapshot.nodes.length,2);assert.equal(snapshot.nodes.find(n=>n.nodeId==='historical-claude').supersededBy,'original-claude');
    const report={date:'2026-10-18',environment:'WSL Linux / Node '+process.versions.node,nativeVersion,discoveredVersion:visible[0].version,
      visibleClaudeNodes:visible.length,historicalRecordsRetained:true,originalNodeAndRoleRetained:true,
      scope:'real installed CLI --version and production MachineHost/AgentNetwork, isolated synthetic historical nodes',modelCalls:0,userProfileWrites:0,independentSshTested:false,windowsExeTested:false};
    fs.writeFileSync(path.resolve(__dirname,'../../artifacts/current-agent-discovery/2026-10-18/real-wsl.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }finally{network.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
