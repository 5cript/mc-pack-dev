interface Endpoint {
    address: string;
    port: number;
}

/*
interface FileOperationInstructions {
    toRemove: Array<string>;
    toDownload: Array<string>;
}
*/

class UpdateClient
{
    remoteEndpoint: Endpoint;

    constructor(remoteEndpoint: Endpoint)
    {
        this.remoteEndpoint = remoteEndpoint
    }

    url = (path: string) =>
    {
        return "http://" + this.remoteEndpoint.address + ":" + this.remoteEndpoint.port + path;
    }

    getModsDifference = async () =>
    {
        try 
        {
            let response = await fetch(this.url("/make_file_difference"), {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: await (async () => {
                    const modList = await this.enumerateLocalMods();
                    return JSON.stringify({mods: modList.map(mod => {
                        return {
                            name: mod,
                            hash: ''
                        }
                    })})
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
            return {
                message: exc.message                
            }
        }
    }

    enumerateLocalMods = (): Promise<Array<string>> => 
    {
        return window.localClient.enumerateMods();
    }
}

export default UpdateClient;