export interface ILocalCient {
    enumerateMods: () => Promise<any>,
    filterModDeletion: (deleteList: Array<string>) => Promise<any>
}

declare global {
    interface Window {
        localClient: ILocalCient
    }
}
export{};