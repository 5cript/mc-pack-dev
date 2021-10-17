import React from 'react';
import ProgressBar from "@ramonak/react-progress-bar"
import UpdateClient from 'renderer/update_client';

class MainWindow extends React.Component
{
    state = {
        totalFiles: 0,
        loadedFiles: 0,
        downloadFileTotalBytes: 0,
        downloadFileCurrentBytes: 0,
        hashProgress: 0,
        hashTotal: 0,
        hashCurrentFile: 'No File',
        currentFileName: 'No File'
    }

    getTotalProgress = () => {
        return Math.round(100 * (this.state.loadedFiles / (this.state.totalFiles > 0 ? this.state.totalFiles : 1)));
    }

    getFileProgress = () => {
        return Math.round(100 * (this.state.downloadFileCurrentBytes / (this.state.downloadFileTotalBytes > 0 ? this.state.downloadFileTotalBytes : 1)));
    }

    onFileProgress = (current: number, total: number) => {
        this.setState({
            downloadFileCurrentBytes: current,
            downloadFileTotalBytes: total
        })
    }

    getHashProgress = () => {
        return Math.round(100 * (this.state.hashProgress / (this.state.hashTotal > 0 ? this.state.hashTotal : 1)));
    }

    onTotalProgress = (file: string, current: number, total: number) => {
        console.log(file, current, total)
        let done = current === total;
        this.setState({
            currentFileName: done ? 'Complete' : file,
            totalFiles: total,
            loadedFiles: current,
        })
        if (done)
            this.onDone();
    }

    onDone = () => {
        window.localClient.runClient();
    }

    fetchCurrentUpdate = async () => {
        window.localClient.getConfig().then(async (config: any) => {
            let client = new UpdateClient({address: config.updateServerIp ? config.updateServerIp : "localhost", port: config.updateServerPort ? config.updateServerPort : 25002});
            const diff = await client.getModsDifference((currentFile: string, current: number, total: number) => {
                this.setState({
                    hashProgress: current,
                    hashTotal: total,
                    hashCurrentFile: currentFile,
                })
            });
            if (diff.message) {
                console.error(diff.message);
                return;
            }
            console.log(diff);
            await Promise.all(diff.toRemove.map(async (mod: string) => {return window.localClient.removeMod(mod)}));
            await client.downloadMods(diff.toDownload, this.onFileProgress, this.onTotalProgress, window.localClient.makeModFileHandler());
        })
    }

    getFileProgressText = () => {
        const biggestUnit = (value: number) => {
            const units = ["B", "KiB", "MiB", "GiB"]
            let i = 0;
            for (; i != 4 && value / 1024 > 1; ++i)
            {
                value /= 1024;
            }
            return {value: Math.round(value), unit: units[i], joined: Math.round(value) + " " + units[i]};
        }
        return biggestUnit(this.state.downloadFileCurrentBytes).value + "/" + biggestUnit(this.state.downloadFileTotalBytes).joined;
    }

    componentDidMount = () => {
        this.fetchCurrentUpdate();
    }

    render = () => 
    {
        return <div style={{
            position: "relative",
            top: "5px",
            left: "5px",
            width: "calc(100% - 15px)"
        }}>
            <div style={{
                width: "100%",
                paddingBottom: "2px",
                display: "flex"
            }}>
                <div>Hash Progress</div>
                <div style={{
                    marginLeft: "auto"
                }}>{this.state.hashCurrentFile}</div>
            </div>
            <ProgressBar 
                completed={this.getHashProgress()} 
                borderRadius={"0px"}
                bgColor={"yellow"}
                labelColor={"black"}
                transitionDuration={"100ms"}
            />
            <div style={{
                height: "10px",
                display: "flex"
            }}/>

            <div style={{
                width: "100%",
                paddingBottom: "2px",
                display: "flex"
            }}>
                <div>Update Progress</div>
                <div style={{
                    marginLeft: "auto"
                }}>{this.state.loadedFiles + "/" + this.state.totalFiles}</div>
            </div>
            <ProgressBar 
                completed={this.getTotalProgress()} 
                borderRadius={"0px"}
                bgColor={"lime"}
                labelColor={"black"}
                transitionDuration={"100ms"}
            />
            <div style={{
                height: "20px",
                display: "flex",
                paddingTop: "10px"
            }}>
                
            <div>{this.state.currentFileName}</div>
                <div style={{
                    marginLeft: "auto"
                }}>{this.getFileProgressText()}</div>
            </div>
            <ProgressBar 
                completed={this.getFileProgress()} 
                borderRadius={"0px"}
                bgColor={"magenta"}
                labelColor={"black"}
                transitionDuration={"0s"}
            />
        </div>
    }
}

export default MainWindow;