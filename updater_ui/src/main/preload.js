const { contextBridge, ipcRenderer, app } = require('electron');
const fs = require('fs');
const fsPromise = require('fs/promises');
const pathTools = require('path');
const process = require('process');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    myPing() {
      ipcRenderer.send('ipc-example', 'ping');
    },
    on(channel, func) {
      const validChannels = ['ipc-example'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    once(channel, func) {
      const validChannels = ['ipc-example'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      }
    },
  },
});

const thisPath = '../dummy_dir';
const relativeClientPath = pathTools.join(thisPath, 'client_updater');
const updateConfigPath = pathTools.join(thisPath, 'updater.json');
/*
{
  "ignoreMods": ["Optifine"]
}
*/
contextBridge.exposeInMainWorld('localClient', 
{
  enumerateMods: async () => {
    const path = pathTools.join(process.cwd(), relativeClientPath, 'mods');
    return fsPromise.readdir(path).then(res => res);
  },
  filterModDeletion: (deleteList) => {
    return fsPromise.readFile(updateConfigPath, {encoding: 'utf-8'}).then(content => {
      content = JSON.parse(content);
      const filtered = deleteList.filter(delElement => {
        return content.ignoreMods.findIndex(element => element === delElement) === -1;
      });
      return filtered;
    });
  }
});