async (page) => {
  let writes=0;
  const diagnostic={index:{revision:13,memberCount:5,enabled:true},collaboration:{revision:15,memberCount:6},receipts:{relationOperations:{confirmed:1,unresolved:0},nodeOperations:{confirmed:1,unresolved:0},machineOperations:{confirmed:0,unresolved:0}}};
  const proposal={sourceDigest:'a'.repeat(64),revisionFrom:13,revisionTo:15,envelopeFrom:3,envelopeTo:5,leaderChanged:false,chain:[{kind:'relationOperations',revision:14,memberCount:7},{kind:'nodeOperations',revision:15,memberCount:6}],members:[{label:'成员 1',change:'remove'},{label:'成员 2',change:'retain'},{label:'成员 3',change:'add'}]};
  await page.route('**/rpc',async route=>{
    const input=route.request().postDataJSON();
    if(input.method==='snapshot'&&writes<2)return route.fulfill({json:{ok:false,error:{code:'RELATION_STATE_CONFLICT',message:'旧协作视图与关系索引不一致'}}});
    if(input.method==='relationRecovery.inspect')return route.fulfill({json:{ok:true,result:{conflict:true,diagnostic,proposal}}});
    if(input.method==='relationRecovery.confirm'){writes++;if(writes===2)return route.fulfill({json:{ok:true,result:{backup:'synthetic-original.bak',backupDigest:'a'.repeat(64)}}});return route.fulfill({json:{ok:false,error:{code:'RELATION_RECOVERY_BLOCKED',message:'测试提交失败，原文件保持'}}});}
    return route.continue();
  });
  await page.goto('http://127.0.0.1:4198');
  await page.getByRole('button',{name:'检查关系冲突'}).click();
  await page.getByRole('heading',{name:'核对恢复提案'}).waitFor();
  const submit=page.getByRole('button',{name:'备份并恢复关系'});
  if(!await submit.isDisabled()||writes)throw Error('unconfirmed write');
  await page.getByRole('button',{name:'取消提案'}).click();
  if(writes)throw Error('cancel wrote');
  await page.getByRole('button',{name:'检查关系冲突'}).click();
  await page.getByRole('checkbox').check();
  await submit.click();
  await page.getByText('测试提交失败，原文件保持').waitFor();
  if(writes!==1)throw Error('wrong dispatch count');
  await page.setViewportSize({width:980,height:660});
  await page.screenshot({path:'artifacts/issue27/2026-10-28/recovery-980.png',fullPage:true});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('horizontal overflow');
  await page.setViewportSize({width:1440,height:960});
  await page.screenshot({path:'artifacts/issue27/2026-10-28/recovery-1440.png',fullPage:true});
  await submit.click();
  await page.getByText(/关系恢复已提交。原文件副本/).waitFor();
  return {unconfirmedWrites:0,cancelWrites:0,confirmedDispatches:writes,successNotice:true,horizontalOverflow:false};
}
