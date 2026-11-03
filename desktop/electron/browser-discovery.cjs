'use strict';
async function discoverBrowsers(channel) {
  if(!channel)return [];
  return Promise.all(channel.pairing.list().filter(p=>p.state==='committed').map(async pair=>{
    const adapter='chatgpt-web',endpoint=channel.forInstance(pair.browserInstanceId);
    let enabled=false,errorCode;
    if(endpoint.online)try{enabled=(await endpoint.request('health.check',{adapterId:adapter,browserInstanceId:pair.browserInstanceId})).enabled===true;}catch{errorCode='BROWSER_HEALTH_UNKNOWN';}
    else errorCode='BROWSER_OFFLINE';
    if(endpoint.online&&!enabled&&!errorCode)errorCode='BROWSER_SITE_PERMISSION_REQUIRED';
    return {adapter,name:'ChatGPT Web',browserInstanceId:pair.browserInstanceId,discoveryKind:'browser-extension',version:'0.1.0',healthy:endpoint.online&&enabled,executionSupported:true,loginChecked:false,...(errorCode?{errorCode,error:'Browser connection or site permission is unavailable.'}:{})};
  }));
}
module.exports={discoverBrowsers};
