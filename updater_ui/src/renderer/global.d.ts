export interface ILocalCient {
    enumerateMods: () => Promise<any>,
    filterModDeletion: (deleteList: Array<string>) => Promise<any>,
    makeModFileHandler: () => any,
    removeMod: (name: string) => void
}

declare global {
    interface Window {
        localClient: ILocalCient
    }
}
export{};