const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('approval', {decide: value => ipcRenderer.send('nook:decision', value === true), receive: listener => ipcRenderer.once('nook:approval', (_event, data) => listener(data))});
