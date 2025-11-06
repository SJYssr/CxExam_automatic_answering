const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    setConfig: async (partial) => {
        return await ipcRenderer.invoke('set-config', partial);
    },
    startLoginFlow: async () => {
        return await ipcRenderer.invoke('start-login-flow');
    },
    chooseExe: async () => {
        return await ipcRenderer.invoke('choose-exe');
    },
    getConfigs: async () => {
        return await ipcRenderer.invoke('get-configs');
    },
    setConfigs: async (payload) => {
        return await ipcRenderer.invoke('set-configs', payload);
    },
    startApp: async (exePath) => {
        return await ipcRenderer.invoke('start-app', { exePath });
    }
});


