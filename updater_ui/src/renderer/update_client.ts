interface Endpoint {
    address: string;
    port: number;
}

interface FileWithHash {
    name: string;
    hash: string;
}

/*
interface FileOperationInstructions {
    toRemove: Array<string>;
    toDownload: Array<string>;
}
*/

type HashProgressCallback = (currentFile: string, currentHash: number, totalHash: number) => void;

class UpdateClient
{
    remoteEndpoint: Endpoint;
    hashProgress: number;

    constructor(remoteEndpoint: Endpoint)
    {
        this.remoteEndpoint = remoteEndpoint
        this.hashProgress = 0;
    }

    url = (path: string) =>
    {
        return "http://" + this.remoteEndpoint.address + ":" + this.remoteEndpoint.port + path;
    }

    getModsDifference = async (hashProgress: HashProgressCallback) =>
    {
        try 
        {
            let response = await fetch(this.url("/make_file_difference"), {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: await (async () => {
                    const modList = await this.enumerateLocalMods(hashProgress);
                    return JSON.stringify({mods: modList});
                })()
            });
            if (response.headers.get('content-type')?.includes("application/json")) {
                const instructions = await response.json();
                return {
                    toRemove: await window.localClient.filterModDeletion(instructions.remove),
                    toDownload: instructions.download
                }
            }
            else {
                return {message: response.text()}
            }            
        }
        catch(exc: any) {
            console.log(exc)
            return {
                message: exc.message                
            }
        }
    }

    downloadMods = async (
        list: Array<string>, 
        onProgress: (c: number, t: number) => void, 
        onTotalProgress: (filename: string, c: number, t: number) => void, 
        fileHandler: any) => 
    {
        onTotalProgress('Starting Download...', 0, list.length);
        let downloadOne = (current: number) => {
            const mod = list[current];
            fetch(this.url("/download_mod/" + mod)).then(async (response) => {
                const reader = response.body?.getReader();
                if (!reader) {
                    console.error("Expected a body to read");
                    return;
                }
                const contentLengthStr = response.headers.get('Content-Length');
                if (!contentLengthStr) {
                    console.error("Expected a Content-Length");
                    return;
                }
                const contentLength = +contentLengthStr;
                onProgress(0, contentLength);
                await fileHandler.clearFile(mod);
    
                onTotalProgress(mod, current, list.length);
                try {
                    let receivedLength = 0;
                    do {
                        const {done, value} = await reader.read();
                        if (done) {
                            break;
                        } else if (value) {
                            receivedLength += value.length; 
                            await fileHandler.appendToFile(mod, value);
                            onProgress(receivedLength, contentLength);
                        }
                    } while (true);
                } 
                catch (err: any)
                {
                    console.error('error when downloading ', mod, err);
                }
                if (current + 1 !== list.length)
                    downloadOne(current + 1);
                else
                    onTotalProgress('Done!', list.length, list.length);
            })
        };
        if (list.length > 0)
            downloadOne(0);
    }

    enumerateLocalMods = (hashProgress: HashProgressCallback) : Promise<Array<FileWithHash>> => 
    {
        this.hashProgress = 0
        return window.localClient.enumerateMods((current, total) => {
            hashProgress(current, ++this.hashProgress, total);
        });
    }
}

export default UpdateClient;