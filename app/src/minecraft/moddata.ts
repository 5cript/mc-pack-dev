type ModData = {
    name: string;
    id: number;
    sid: string;
    gameVersion: Array<string>;
    installedName: string;
    logoPng64: string;
    installedTimestamp: string;
    newestTimestamp: string;
    latestFile: any;
    error: boolean | undefined;
    manualInstall: ModData | undefined;
}

export default ModData;