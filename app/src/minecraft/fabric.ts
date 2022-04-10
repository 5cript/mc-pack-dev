//const cheerio = window.require('cheerio');
import {default as cheerio} from 'cheerio';

class FabricScrape
{
    mainPageBaseUrl: string = "https://maven.fabricmc.net/net/fabricmc/fabric-installer/";
    downloadPageBaseUrl: string = "https://maven.fabricmc.net/net/fabricmc/fabric-installer/"; 
    //https://maven.fabricmc.net/net/fabricmc/fabric-installer/0.8.0/fabric-installer-0.8.0.jar
    latestVersion: string;

    constructor()
    {
        this.latestVersion = "";
    }

    loadCurrentFabricInstallerVersion = async () => 
    {
        const pageUrl = this.mainPageBaseUrl; 
        await fetch(pageUrl).then(response => {
            return response.text().then(page => {
                const $ = cheerio.load(page);
                // Remove all comments.
                //$.root().find('*').contents().filter(function() {return this.type === 'comment';}).remove();
                let allLinks = $('a').toArray();
                let filteredLinks = allLinks.map((linkNode)=> {
                    const maybeDate = linkNode.next?.data?.trimStart().trimEnd().slice(0, -1).trimEnd();
                    return {
                        href: linkNode.attribs.href,
                        date: maybeDate ? Date.parse(maybeDate) : 0
                    };
                });
                filteredLinks = filteredLinks.filter(link => {
                    const rgx = /(\d+(?:\.\d+)*)\//gm;
                    return link.date !== 0 && link.href.match(rgx) ;
                });
                filteredLinks = filteredLinks.sort((lhs, rhs) => {
                    return rhs.date - lhs.date;
                })
                this.latestVersion = filteredLinks[0].href.slice(0, -1);
            });
        })

        return this.latestVersion;
    }

    downloadFabricInstaller = async () => {
        await this.loadCurrentFabricInstallerVersion();
        return fetch(this.downloadPageBaseUrl + this.latestVersion + "/fabric-installer-" + this.latestVersion + ".jar").then(response => {
            return response.arrayBuffer();
        })
    }
}

export default FabricScrape;