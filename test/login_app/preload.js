const { contextBridge, ipcRenderer } = require('electron');

let susrConfigAppid = null;
ipcRenderer.on('susr-config', (event, data) => {
    susrConfigAppid = (data && data.appid != null) ? String(data.appid) : null;
});

contextBridge.exposeInMainWorld('api', {
    getAppId: () => susrConfigAppid,
    onSusrConfig: (callback) => {
        if (typeof callback === 'function') {
            ipcRenderer.on('susr-config', (event, data) => callback(data));
        }
    },
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
    },
    openExternalUrl: async (url) => {
        return await ipcRenderer.invoke('open-external-url', url);
    },
    getNotice: async () => {
        return await ipcRenderer.invoke('get-notice');
    },
    getPurchaseLink: async () => {
        return await ipcRenderer.invoke('get-purchase-link');
    },
    getHelpLink: async () => {
        return await ipcRenderer.invoke('get-help-link');
    }
});


