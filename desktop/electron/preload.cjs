const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("agentbridge", {
  call: (method, params = {}) =>
    ipcRenderer.invoke("bridge:call", { method, params }),
  preferences: () => ipcRenderer.invoke("bridge:preferences"),
  savePreferences: (options) =>
    ipcRenderer.invoke("bridge:save-preferences", options),
  runtimes: () => ipcRenderer.invoke("bridge:runtimes"),
  pickFolder: (machineId) => ipcRenderer.invoke("bridge:folder", machineId),
  window: (action) => ipcRenderer.invoke("bridge:window", action),
  pending: () => ipcRenderer.invoke("bridge:pending"),
  recoverPending: () => ipcRenderer.invoke("bridge:recover-pending"),
});
