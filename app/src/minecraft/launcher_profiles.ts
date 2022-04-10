import moment from 'moment';

import {default as fs} from 'fs';

class LauncherProfiles
{
    profiles: object;

    constructor()
    {
        this.profiles = {};
    }

    loadProfiles = (file: string) =>
    {
        this.profiles = JSON.parse(fs.readFileSync(file)).profiles;
    }

    modifyForgeProfile(name: string)
    {
        this.profiles["forge"].javaArgs = "-XX:+AggressiveOpts -Xmx16G -XX:ParallelGCThreads=3 -XX:+UseConcMarkSweepGC -XX:+UnlockExperimentalVMOptions -XX:+UseParNewGC -XX:+ExplicitGCInvokesConcurrent -XX:MaxGCPauseMillis=10 -XX:GCPauseIntervalMillis=50 -XX:+UseFastAccessorMethods -XX:+OptimizeStringConcat -XX:NewSize=84m -XX:+UseAdaptiveGCBoundary -XX:NewRatio=3 -Dfml.readTimeout=90 -Ddeployment.trace=true -Ddeployment.log=true -Ddeployment.trace.level=all";
        this.profiles["forge"].name = name;
        this.profiles["forge"].lastUsed = moment().format();
    }

    modifyFabricProfile(name: string, version: string)
    {
        this.profiles["fabric-loader-" + version].javaArgs = "-Xmx8G";
        this.profiles["fabric-loader-" + version].name = name;
        this.profiles["fabric-loader-" + version].lastUsed = moment().format();
    }

    makeDefault()
    {
        return {
            "clientToken": "",
            "profiles": {},
            "settings" : {
              "crashAssistance" : true,
              "enableAdvanced" : false,
              "enableAnalytics" : false,
              "enableHistorical" : false,
              "enableReleases" : false,
              "enableSnapshots" : false,
              "keepLauncherOpen" : false,
              "profileSorting" : "ByLastPlayed",
              "showGameLog" : false,
              "showMenu" : false,
              "soundOn" : false
            }
        }
    }

    getObject() {
        return {profiles: this.profiles};
    }

}

export default LauncherProfiles;