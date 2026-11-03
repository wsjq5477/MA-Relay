const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {parse,stringify}=require('smol-toml');
const {prepareWindowsProfile,windowsNativeEnvironment}=require('./interconnect-windows-profile.cjs');
function fixture(t){
 assert.ok(!/^c:/i.test(os.tmpdir()));const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-native-profile-'));
 const source=path.join(dir,'source'),root=path.join(dir,'private');fs.mkdirSync(source);
 const config={model:'controlled-model',model_provider:'controlled',model_providers:{controlled:{name:'controlled',base_url:'https://example.invalid/v1',http_headers:{Authorization:'controlled-placeholder'}}},approval_policy:'never',sandbox_mode:'read-only',hooks:{enabled:true},plugins:{'controlled@test':{enabled:true}},marketplaces:{controlled:{source:'C:\\old-marketplace'}},mcp_servers:{other:{command:'C:\\old-command'}},projects:{'C:\\old-project':{trust_level:'trusted'}}};
 fs.writeFileSync(path.join(source,'config.toml'),stringify(config));fs.writeFileSync(path.join(source,'auth.json'),JSON.stringify({auth_mode:'api_key',OPENAI_API_KEY:'controlled-placeholder'}));
 const executable=path.join(source,'native.exe'),nodeExecutable=path.join(source,'node.exe');fs.writeFileSync(executable,'controlled executable bytes');fs.writeFileSync(nodeExecutable,'controlled node bytes');
 t.after(()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});});
 return {dir,source,root,config,options:{root,executable,sourceProfile:source,nodeExecutable}};
}
test('native acceptance profile preserves model/account and permissions while excluding original plugin/Hook/MCP paths',async t=>{
 const f=fixture(t),before=fs.readFileSync(path.join(f.source,'config.toml'),'utf8'),auth=fs.readFileSync(path.join(f.source,'auth.json'),'utf8');
 const result=await prepareWindowsProfile(f.options),copy=parse(fs.readFileSync(path.join(result.profile,'config.toml'),'utf8'));
 assert.equal(copy.model,f.config.model);assert.deepEqual(copy.model_providers,parse(before).model_providers);assert.equal(copy.approval_policy,f.config.approval_policy);assert.equal(copy.sandbox_mode,f.config.sandbox_mode);
 for(const key of ['hooks','plugins','marketplaces','mcp_servers','projects'])assert.equal(copy[key],undefined);
 assert.equal(fs.readFileSync(path.join(result.profile,'auth.json'),'utf8'),auth);assert.equal(fs.readFileSync(path.join(f.source,'auth.json'),'utf8'),auth);assert.equal(fs.readFileSync(path.join(f.source,'config.toml'),'utf8'),before);
 assert.equal(JSON.stringify(result).includes('controlled-placeholder'),false);assert.equal(result.sourceProfileUntouched,true);
 const env=windowsNativeEnvironment(result);for(const key of ['TEMP','TMP','CODEX_HOME','CODEX_SQLITE_HOME','USERPROFILE','APPDATA','LOCALAPPDATA','XDG_CACHE_HOME'])assert.ok(env[key].startsWith(f.root));
});
test('reopening keeps refreshed private native credentials and never overwrites them from the original profile',async t=>{
 const f=fixture(t),first=await prepareWindowsProfile(f.options);fs.writeFileSync(path.join(first.profile,'auth.json'),'native-refreshed-private-account');
 const reopened=await prepareWindowsProfile(f.options);assert.equal(reopened.reused,true);assert.equal(fs.readFileSync(path.join(first.profile,'auth.json'),'utf8'),'native-refreshed-private-account');assert.equal(reopened.codex,first.codex);
});
test('a changed prepared model binding fails without repairing or rebinding the original native execution',async t=>{
 const f=fixture(t),first=await prepareWindowsProfile(f.options),file=path.join(first.profile,'config.toml'),c=parse(fs.readFileSync(file,'utf8'));c.model='different-controlled-model';fs.writeFileSync(file,stringify(c));
 await assert.rejects(prepareWindowsProfile(f.options),{code:'NATIVE_PROFILE_CHANGED'});assert.equal(parse(fs.readFileSync(file,'utf8')).model,'different-controlled-model');
});
test('C-drive output roots and retained model C-path references are refused before native files are copied',async t=>{
 const f=fixture(t);await assert.rejects(prepareWindowsProfile({...f.options,root:'C:\\forbidden-native-test'}),{code:'NON_C_PROFILE_REQUIRED'});
 const c={...f.config,model_catalog_json:'C:\\original-model-catalog.json'};fs.writeFileSync(path.join(f.source,'config.toml'),stringify(c));
 await assert.rejects(prepareWindowsProfile(f.options),{code:'NATIVE_CONFIG_C_PATH_REQUIRES_REVIEW'});assert.equal(fs.existsSync(path.join(f.root,'native-parent-profile')),false);
});
test('a local inference proxy with unverified data storage is refused before any native model launch',async t=>{
 const f=fixture(t),c=structuredClone(f.config);c.model_providers.controlled.base_url='http://127.0.0.1:12345/v1';fs.writeFileSync(path.join(f.source,'config.toml'),stringify(c));
 await assert.rejects(prepareWindowsProfile(f.options),{code:'NATIVE_LOCAL_PROXY_STORAGE_UNVERIFIED'});assert.equal(fs.existsSync(path.join(f.root,'native-parent-profile')),false);
});
