type Mod = {
    name: string;
    id: number;
    sid: string;
    minecraftVersions: Array<string>;
    installedName: string;
    logoPng64: string;
    installedTimestamp: string;
    newestTimestamp: string;
    latestFile: any;
    error: boolean | undefined;
}

export {Mod};