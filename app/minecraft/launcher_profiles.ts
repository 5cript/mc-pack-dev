import moment from 'moment';

const fs = window.require('fs');

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
        this.profiles["forge"].javaArgs = "-XX:+AggressiveOpts -Xms8G -XX:ParallelGCThreads=3 -XX:+UseConcMarkSweepGC -XX:+UnlockExperimentalVMOptions -XX:+UseParNewGC -XX:+ExplicitGCInvokesConcurrent -XX:MaxGCPauseMillis=10 -XX:GCPauseIntervalMillis=50 -XX:+UseFastAccessorMethods -XX:+OptimizeStringConcat -XX:NewSize=84m -XX:+UseAdaptiveGCBoundary -XX:NewRatio=3 -Dfml.readTimeout=90 -Ddeployment.trace=true -Ddeployment.log=true -Ddeployment.trace.level=all";
        this.profiles["forge"].name = name;
        this.profiles["forge"].lastUsed = moment().format();
    }

    getObject() {
        return {profiles: this.profiles};
    }

}

export default LauncherProfiles;