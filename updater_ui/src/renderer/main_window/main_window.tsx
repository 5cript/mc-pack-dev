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
        return this.state.loadedFiles / (this.state.totalFiles > 0 ? this.state.totalFiles : 1);
    }

    getFileProgress = () => {
        return this.state.downloadFileTotalBytes / (this.state.downloadFileCurrentBytes > 0 ? this.state.downloadFileCurrentBytes : 1);
    }

    fetchCurrentUpdate = () => {

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
            />
            <div style={{
                height: "20px",
                display: "flex",
                paddingTop: "10px"
            }}>
                
                <div>{this.state.currentFileName}</div>
                <div style={{
                    marginLeft: "auto"
                }}>{this.state.downloadFileCurrentBytes + "/" + this.state.downloadFileTotalBytes}</div>
            </div>
            <ProgressBar 
                completed={this.getTotalProgress()} 
                borderRadius={"0px"}
                bgColor={"magenta"}
                labelColor={"black"}
            />
            <button onClick={async () => {
                let client = new UpdateClient({address: "localhost", port: 25002});
                const diff = await client.getModsDifference();
                if (diff.message) {
                    console.error(diff.message);
                    return;
                }
                console.log(diff);
            }}>
                Update
            </button>
        </div>
    }
}

export default MainWindow;