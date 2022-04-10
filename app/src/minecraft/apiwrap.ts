import curseforge from 'mc-curseforge-api';
import ModData from './moddata';
import moment from 'moment';

const simplifyVersion = (version: string) => 
{
    let split = version.split('.');
    if (split.length === 3)
    {
        split.pop();
        return split.join('.');
    }
    return split.join('.');
}

const isCorrectVersion = (file: any, mcVersions: Array<string>, fabric: boolean, permissive: boolean) => {
    const isFabric = file.minecraft_versions.find((version : string) => {
        if (version.toLowerCase() === "fabric")
            return true;
        return false;
    }) !== undefined;

    const correctVersion = file.minecraft_versions.find((version : string) => {
        for (let v in mcVersions)
        {
            if (!mcVersions[v].includes('.'))
                continue;
            if (mcVersions[v] === version)
                return true;
        }
        for (let v in mcVersions)
        {
            if (!mcVersions[v].includes('.'))
                continue;
            if (permissive && simplifyVersion(mcVersions[v]) === simplifyVersion(version))
                return true;
            else if (mcVersions[v] === version)
                return true;
        }
        return false;
    }) !== undefined;

    return correctVersion && (isFabric === fabric);
}

class CurseMod
{
    modData: any;
    files: Array<any>;
    isFabricMod: boolean;

    constructor(modData: any, files: Array<any>, isFabricMod: boolean) {
        this.modData = modData;
        this.files = files;
        this.isFabricMod = isFabricMod;
    }

    getCompatibleFiles = (withVersions: Array<string>, permissive: boolean) => {
        const filtered = this.files.filter((element: any) => {
            return isCorrectVersion(element, withVersions, this.isFabricMod,  permissive);
        });
        return filtered.sort((lhs: {timestamp: string}, rhs: {timestamp: string}) => {
            return moment(rhs.timestamp).isAfter(lhs.timestamp) ? 1 : -1;
        });
    }

    data = () => {
        return this.modData;
    }

    latestFiles = () => {
        return [...this.modData.latestFiles];
    }
};

class CurseApi
{
    isFabric: boolean;

    constructor(isFabric: boolean) {
        this.isFabric = isFabric;
    }

    getMod = (id: number): Promise<CurseMod> =>  {
        return Promise.all([curseforge.getMod(id), curseforge.getModFiles(id)]).then(([modData, files]) => {
            return new CurseMod(modData, files, this.isFabric);
        });
    }
}

export {CurseApi, CurseMod};