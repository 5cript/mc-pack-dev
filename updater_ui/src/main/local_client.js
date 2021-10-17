const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const fsPromise = require('fs/promises');
const pathTools = require('path');
const processNode = require('process');
const crypto = require('crypto');
const { spawn } = require('child_process');

const isDebug = true;

const thisDebug = '../dummy_dir';
const thisReleased = '.';
const relativeClientPath = async () => {
    return ipcRenderer.invoke('isPackaged').then(isPackaged => {
        if (!isPackaged)
            return pathTools.join(thisDebug, 'client');
        else
            return pathTools.join(thisReleased, 'client');
    })        
}
const updateConfigPath = async () => {
    /*{
        "ignoreMods": ["Optifine"]
    }*/
    return ipcRenderer.invoke('isPackaged').then(isPackaged => {
        if (!isPackaged)
            return pathTools.join(thisDebug, 'updater.json');
        else
            return pathTools.join(thisReleased, 'updater.json');
    });
}

class FileDownloadHandler
{
  clearFile = async (name) => {
    return relativeClientPath().then(clientPath => {
        const path = pathTools.join(processNode.cwd(), clientPath, 'mods', name)
        return fsPromise.access(path, fs.constants.F_OK).then(() => {
            fsPromise.truncate(path, 0);
        }).catch(()=>{});
    });    
  }

  appendToFile = async (name, data) => {
    return relativeClientPath().then(clientPath => {
        const path = pathTools.join(processNode.cwd(), clientPath, 'mods', name)
        return fsPromise.appendFile(path, Buffer.from(data.buffer));
    });
  }
}

class LocalClient
{
    enumerateMods = async (onHashProgress) => {
        return relativeClientPath().then(clientPath => {
            const path = pathTools.join(processNode.cwd(), clientPath, 'mods', name)
            return fsPromise.readdir(path).then(
                res => {
                    return Promise.all(res.map(
                        (mod) => {
                            return this.makeHash(mod).then(hash => {
                                onHashProgress(mod, res.length);
                                return {
                                    name: mod,
                                    hash: hash
                                }
                            });
                        }
                    ))
                }
            );
        });
    }

    makeHash = async (name) => {
        return relativeClientPath().then(clientPath => {
            const path = pathTools.join(processNode.cwd(), clientPath, 'mods', name);
            return fsPromise.readFile(path).then(content => {
                const hashSum = crypto.createHash('sha256');
                hashSum.update(content);
                const hexy = hashSum.digest('hex');
                return hexy;
            })
        });
    }

    getConfig = async () => {
        return updateConfigPath().then(configPath => {
            return fsPromise.readFile(configPath, {encoding: 'utf-8'}).then(content => {
                return JSON.parse(content);
            });
        });
    }

    filterModDeletion = (deleteList) => {
        return updateConfigPath().then(configPath => {
            return fsPromise.readFile(configPath, {encoding: 'utf-8'}).then(content => {
                content = JSON.parse(content);
                const filtered = deleteList.filter(delElement => {
                    return content.ignoreMods.findIndex(element => element === delElement) === -1;
                });
                return filtered;
            });
        });
    }

    makeModFileHandler = () => {
        return new FileDownloadHandler();
    }

    removeMod = async (name) => {
        return relativeClientPath().then(clientPath => {
            return fsPromise.unlink(pathTools.join(clientPath, 'mods', name));
        });
    }

    runClient = () => {
        return relativeClientPath().then(clientPath => {
            ipcRenderer.send('hide');
            const path = pathTools.join(processNode.cwd(), clientPath, 'Minecraft.exe');
            const mc = spawn(path, ['--workDir', pathTools.join(processNode.cwd(), clientPath)]);
            mc.on('close', (code) => {
                ipcRenderer.invoke('close');
            }); 
            mc.on('exit', (code) => {
                ipcRenderer.invoke('close');
            }); 
            mc.on('error', (code) => {
                ipcRenderer.invoke('close');
            }); 
        });    
    }
};

const exposeLocalClient = () => {
    contextBridge.exposeInMainWorld('localClient', new LocalClient);
}

module.exports = {exposeLocalClient};