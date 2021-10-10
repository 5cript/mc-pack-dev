//const cheerio = window.require('cheerio');
import {default as cheerio} from 'cheerio';

function isComment(index, node) {
    return node.type === 'comment'
}

class ForgeScrape
{
    mainPageBaseUrl: string = "https://files.minecraftforge.net/maven/net/minecraftforge/forge/index_"; // 1.16.3.html";
    downloadPageBaseUrl: string = "https://files.minecraftforge.net/maven/net/minecraftforge/forge/"; //1.15.2-31.2.45/forge-1.15.2-31.2.45-installer.jar
    latestVersion: string;

    constructor()
    {
        this.latestVersion = "";
    }

    loadCurrentForgeVersion = async (mcVersion: string) => 
    {
        const pageUrl = this.mainPageBaseUrl + mcVersion + ".html"; 
        await fetch(pageUrl).then(response => {
            return response.text().then(page => {
                const $ = cheerio.load(page);
                $.root().find('*').contents().filter(function() {return this.type === 'comment';}).remove();
                let spacyVersion = $('body > main > div.sidebar-sticky-wrapper-content > div.promos-wrapper > div.promos-content > div > div:nth-child(1) > div.title > small').html();
                this.latestVersion = spacyVersion.replace(/\s+/g, '');
            });
        })

        return this.latestVersion;
    }

    downloadForge = () => {
        return fetch(this.downloadPageBaseUrl + this.latestVersion + "/forge-" + this.latestVersion + "-installer.jar").then(response => {
            return response.arrayBuffer();
        });
    }
}

export default ForgeScrape;