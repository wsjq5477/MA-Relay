// Page side effects are injected; all decisions to allow them come from the
// persistent journal. This class never retries a browser mutation.
export class BrowserExecutor {
  constructor({journal,pages,onEvents=async()=>{}}){this.journal=journal;this.pages=pages;this.onEvents=onEvents;}
  receipt(p){return {requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId};}
  async command(method,p) {
    if(method==='task.cancel')return this.journal.cancel(p);
    if(method==='session.close')return this.journal.closeSession(p);
    if(['session.create','session.resume'].includes(method)) {
      const claim=await this.journal.beginOperation(method,p);
      if(!claim.execute){if(claim.operation.state!=='confirmed')throw Error('BROWSER_OPERATION_UNKNOWN');return claim.operation.result;}
      const session=method==='session.create'?null:await this.journal.session(p.bridgeSessionId);
      const binding=await this.pages[method==='session.create'?'create':'resume'](p,session);
      return this.journal.finishOperation(p,binding);
    }
    if(method==='message.prepare') {
      const session=await this.journal.session(p.bridgeSessionId);
      await this.pages.inspect(p,session);
      await this.journal.prepare(p);return this.receipt(p);
    }
    if(method==='message.send') {
      const claim=await this.journal.claimSend(p);
      if(!claim.execute)return {...this.receipt(p),state:claim.request.phase};
      try {
        const session=await this.journal.session(p.bridgeSessionId);
        await this.pages.inspect(p,session);
        await this.journal.authorizeContent(p);
        await this.pages.submit(p,session,async(kind,data)=>{
          const e=await this.journal.append(p,kind,data);await this.onEvents();return e;
        });
      } catch(error) {
        const current=await this.journal.request(p.requestId);
        const code=error?.code||error?.message;
        if(!['completed','failed','cancelled','unknown'].includes(current.phase))await this.journal.append(p,'unknown',{text:typeof code==='string'&&/^BROWSER_[A-Z_]{1,80}$/.test(code)?code:'BROWSER_PAGE_ACTION_UNKNOWN'});
        await this.onEvents();
      }
      return this.receipt(p);
    }
    if(method==='request.get')return this.journal.originalRequest(p);
    if(method==='operation.get')return this.journal.operation(p);
    if(method==='output.subscribe'){
      const request=await this.journal.originalRequest(p);
      if(p.observeTerminal!==undefined&&p.observeTerminal!=='integrity-failure-v1')throw Error('BROWSER_COMMAND_UNSUPPORTED');
      if(p.observeTerminal==='integrity-failure-v1'&&request.phase==='unknown'&&request.submitted){const proof=await this.pages.observeIntegrityFailure(p,request);if(proof?.observed===true)await this.journal.settleIntegrityFailure(p,proof);}
      await this.onEvents();return {...this.receipt(p),...(p.observeTerminal?{integrityObservationSupported:true}:{})};
    }
    if(method==='health.check')return this.pages.health(p);
    throw Error('BROWSER_COMMAND_UNSUPPORTED');
  }
}
