const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('recordingOverlay', {
  onState(callback) {
    ipcRenderer.on('overlay:state', (_event, state) => callback(state));
  },
});
