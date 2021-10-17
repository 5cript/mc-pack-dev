export interface ILocalCient {
    enumerateMods: (func: (current: string, total: number) => void) => Promise<any>,
    filterModDeletion: (deleteList: Array<string>) => Promise<any>,
    makeModFileHandler: () => any,
    removeMod: (name: string) => void,
    makeHash: (name: string) => Promise<string>,
    runClient: () => void,
    getConfig: () => any
}

declare global {
    interface Window {
        localClient: ILocalCient
    }
}
export{};