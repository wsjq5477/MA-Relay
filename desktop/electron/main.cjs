const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const {resolve}=require('node:path');
const {CoordinatorClient}=require('./coordinator-client.cjs');
const {folderPath}=require('./machine-router.cjs');
if(process.env.AGENTBRIDGE_DESKTOP_PROFILE) app.setPath('userData',resolve(process.env.AGENTBRIDGE_DESKTOP_PROFILE));
let win,host;
function connection() {
  return host || (host=new CoordinatorClient({directory:app.getPath('userData'),version:app.getVersion(),
    bridgeDirectory:app.isPackaged?resolve(process.resourcesPath,'bridge'):resolve(__dirname,'../..'),
    packageDirectory:app.isPackaged?resolve(process.resourcesPath,'linux-package'):resolve(__dirname,'../.linux-package')}));
}
function checkSender(event) {
  if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)
    throw new Error('拒绝其他页面的桌面请求');
}
function request(event,method,params) {checkSender(event);return connection().request(method,params);}
ipcMain.handle('bridge:call',async(event,input)=>{
  try {return await request(event,'call',input);}
  catch(error) {return {ok:false,error:{code:error.code||'DESKTOP_ERROR',message:error.message||'后台请求未完成。'}};}
});
ipcMain.handle('bridge:preferences',(event)=>request(event,'preferences'));
ipcMain.handle('bridge:save-preferences',(event,value)=>request(event,'savePreferences',value));
ipcMain.handle('bridge:runtimes',(event)=>request(event,'runtimes'));
ipcMain.handle('bridge:pending',(event)=>request(event,'pending'));
ipcMain.handle('bridge:recover-pending',(event)=>request(event,'recoverPending'));
ipcMain.handle('bridge:folder',async(event,machineId)=>{
  checkSender(event);
  const machines=await connection().request('machines');
  const machine=machines.find(m=>m.machineId===machineId)||machines[0];
  if(machine.kind==='ssh') return null;
  const result=await dialog.showOpenDialog(win,{title:'选择 Agent 工作项目',properties:['openDirectory']});
  return result.canceled?null:folderPath(result.filePaths[0],machine);
});
ipcMain.handle('bridge:window',async(event,action)=>{
  checkSender(event);
  if(action==='minimize') win.minimize();
  else if(action==='maximize') {if(win.isMaximized()) win.unmaximize();else win.maximize();}
  else if(action==='close') win.close();
  else if(action==='quit-background') {
    await connection().request('shutdown');
    app.quit();
  }
});
function createWindow() {
  app.setAppUserModelId("dev.agentbridge.desktop");
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 660,
    frame: false,
    backgroundColor: "#f5f5f7",
    title: "AgentBridge",
    icon: resolve(__dirname, "../assets/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.loadFile(resolve(__dirname, "../dist/index.html"));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(createWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => host?.close());
}
