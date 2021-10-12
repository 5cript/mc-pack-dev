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

    onTotalProgress = (file: string, current: number, total: number) => {
        console.log(file, current, total)
        this.setState({
            currentFileName: file,
            totalFiles: total,
            loadedFiles: current,
        })
    }

    fetchCurrentUpdate = async () => {
        let client = new UpdateClient({address: "localhost", port: 25002});
        const diff = await client.getModsDifference();
        if (diff.message) {
            console.error(diff.message);
            return;
        }
        console.log(diff);
        client.downloadMods(diff.toDownload, this.onFileProgress, this.onTotalProgress, window.localClient.makeModFileHandler());
        diff.toRemove.forEach(async (mod: string) => {await window.localClient.removeMod(mod)});
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
            <button onClick={async () => {
                this.fetchCurrentUpdate();
            }}>
                Update
            </button>
        </div>
    }
}

export default MainWindow;