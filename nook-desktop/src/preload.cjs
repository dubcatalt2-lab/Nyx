const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('nook', {
  invoke: async (name, payload) => { const result = await ipcRenderer.invoke('nook:invoke', name, payload); if (!result.ok) throw Error(result.error); return result.data; },
  subscribe: listener => { const handler = (_event, value) => listener(value); ipcRenderer.on('nook:event', handler); return () => ipcRenderer.removeListener('nook:event', handler); }
});
