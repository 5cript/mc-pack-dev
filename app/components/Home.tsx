import React from 'react';
//import { Link } from 'react-router-dom';
//import routes from '../constants/routes.json';
import styles from './Home.css';
import Autosuggest from 'react-autosuggest';
import MessageBox from './MessageBox';
import _ from 'lodash';
import moment from 'moment';
import tar from 'tar';
import MenuItem from '@material-ui/core/MenuItem';
import InputLabel from '@material-ui/core/InputLabel';
import { Line } from 'rc-progress';

import ModTable from './ModTable';
import {Mod} from '../minecraft/mod';
import StyledButton, {SlimButton} from './button';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import ForgeScrape from '../minecraft/forge';
import FabricScrape from '../minecraft/fabric';
import { styled, ThemeProvider, createMuiTheme, withStyles } from '@material-ui/core/styles';
import LauncherProfiles from '../minecraft/launcher_profiles';
import ReactModal from 'react-modal-resizable-draggable';

// node packages
import electron from 'electron';
import curseforge from 'mc-curseforge-api';
import pathTools from 'path';
import {default as fs} from 'fs';
import {default as archiver} from 'archiver';
import {default as fsExtra} from 'fs-extra';
import {spawn} from 'child_process';
import { REPL_MODE_SLOPPY } from 'repl';

const fsPromise = fs.promises;
/*
const electron = window.require('electron');
const curseforge = window.require("mc-curseforge-api");
const pathTools = window.require('path');
const fs = window.require('fs');
const fsPromise = window.require('fs').promises;
const fsExtra = window.require('fs-extra');
const { spawn } = require('child_process');
*/

const StyledLabel = styled(InputLabel)({
	color: 'var(--foreground-color)',
	':focused': {
		color: 'var(--theme-color)'
	}
});

const StyledSelect = styled(Select)({
	color: 'var(--foreground-color)',
	'&:after': {
		broderBottom: '1px solid red'
	},
	'&:before': {
		borderBottom: '1px solid white'
	}
})

const StyledForm = styled(FormControl)({
	margin: '2px',
	marginLeft: '8px',
	minWidth: 240,
})

const theme = createMuiTheme({
	palette: {
		primary: {
			main: '#43b14c'
		},
		text: {
			primary: '#ddd'
		},
		background: {
			paper: '#303030',
			default: '#303030'
		}
	},
});

//https://mondanzo.github.io/mc-curseforge-api/module-CurseForgeAPI.html#~getMods

type HomeProps = {}
type HomeState = {
	modSearchSuggestions: Array<any>,
	lastQuery: Array<any>,
	modSearchValue: string,
	pack: {
		mods: Array<Mod>,
		minecraftVersion: string,
		fabric: boolean
	},
	packInfo: {
		directory: string,
		metaDir: string
	},
	mcVersions: Array<string>,
	messageBoxStyle: string,
	messageBoxText: string,
	messageBoxVisible: boolean,
	installProgress: number,
	installTotal: number,
	initialLoading: boolean,
	selectedServer: string
}
type MessageBoxActions = {
	yes: Function | undefined,
	no: Function | undefined,
	ok: Function | undefined
} | {}

type ServerSettings = {
	name: string,
	ipAddr: string,
	port: number
};

class Home extends React.Component<HomeProps>
{
	mods = [];	

	converterCanvas : HTMLCanvasElement | undefined;
	mounted: boolean = false;
	forgeVersion: string;
	state: HomeState = {
		modSearchSuggestions: [],
		lastQuery: [],
		modSearchValue: '',
		pack: {
			mods: [],
			minecraftVersion: '',
			fabric: false
		},
		packInfo: {
			directory: '',
			metaDir: ''
		},
		mcVersions: [],
		messageBoxStyle: 'Ok',
		messageBoxText: '',
		messageBoxVisible: false,
		installProgress: 0,
		installTotal: 0,
		initialLoading: true,
		selectedServer: ''
	};
	messageBoxActions: MessageBoxActions = {yes: ()=>{}, no: ()=>{}, ok: ()=>{}};
	throttledFetch: Function;
	servers: Array<ServerSettings>;

	constructor(props : HomeProps)
	{
		super(props);
		this.forgeVersion = "";
		this.servers = [];

		this.loadPersistence();
		(async () => {
			let mcVersions = await this.getMinecraftVersions();
			mcVersions = mcVersions.map((version: any) => version.versionString);
			if (this.mounted)
				this.setState({mcVersions: mcVersions})
			else
				this.state.mcVersions = mcVersions;
		})()

		this.throttledFetch = _.debounce((value) => {
			return this.onModSearchFetchRequest(value);
		}, 150);

		electron.ipcRenderer.on('upload-response', (event, {success}) => {
			this.showMessageBox('Upload ' + (success ? 'was successful' : 'failed'), 'Ok');
		})
	}

	simplifyVersion = (version: string) => 
	{
		let split = version.split('.');
		if (split.length === 3)
		{
			split.pop();
			return split.join('.');
		}
		return split.join('.');
	}

	isCorrectVersion = (file: any, mcVersions: Array<string>, fabric: boolean) => {
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
				if (this.simplifyVersion(mcVersions[v]) === this.simplifyVersion(version))
					return true;
			}
			return false;
		}) !== undefined;

		return correctVersion && (isFabric === fabric);
	}

	loadModFromRemote = (id: number, mcVersions: Array<string>, fabric: boolean) =>
	{
		//console.log(mcVersions);
		return Promise.all([curseforge.getMod(id), curseforge.getModFiles(id).then((modFiles: any) => {
			modFiles = modFiles.filter((file: any) => {
				return this.isCorrectVersion(file, mcVersions, fabric);				
			})
			modFiles.sort((lhs: {timestamp: string}, rhs: {timestamp: string}) => {
				return moment(rhs.timestamp).isAfter(lhs.timestamp) ? 1 : -1;
			})
			return modFiles;
		})]);
	}

	updateModList = async (mods: Array<Mod>, fabric: boolean) =>
	{
		const promises = mods.map((mod : Mod) => {
			const versions = mod.minecraftVersions.filter(elem => elem.toLowerCase() !== "fabric");

			return this.loadModFromRemote(mod.id, versions, fabric).then(([freshMod, modFiles]) => {
				modFiles = _.cloneDeep(modFiles);
				if (modFiles.length === 0) 
				{
					console.log(freshMod);
					if (freshMod.latestFiles !== undefined && freshMod.latestFiles.length > 0)
					{
						const filtered = freshMod.latestFiles.filter((file: any) => {
							console.log({file, versions, fabric, isCorrect: this.isCorrectVersion(file, versions, fabric)});
							return this.isCorrectVersion(file, versions, fabric);
						});
						if (filtered.length !== 0)
						{
							filtered.sort((lhs: {timestamp: string}, rhs: {timestamp: string}) => {
								return moment(rhs.timestamp).isAfter(lhs.timestamp) ? 1 : -1;
							})
							mod.newestTimestamp = filtered[0].timestamp;
							mod.latestFile = filtered[0];
							return mod;
						}
					}
					mod.newestTimestamp = '?';
					console.log(mod);
					mod.latestFile = {
						id: 0,
						minecraft_versions: ['?'],
						file_name: '?',
						file_size: 0,
						timestamp: '?',
						release_type: '?',
						download_url: '?',
						downloads: null,
						mod_dependencies: [],
						alternate: false,
						alternate_id: 0,
						available: false
					};
					mod.error = true;
					return mod;
				}
				mod.newestTimestamp = modFiles[0].timestamp;
				mod.latestFile = modFiles[0];
				return mod;
			});
		});
		return Promise.all(promises);
	}

	openPack = async (dir: string) => 
	{
		let packInfo = _.clone(this.state.packInfo);
		packInfo.directory = dir;
		packInfo.metaDir = pathTools.join(dir, 'mcpackdev');
		let pack = _.clone(this.state.pack);

		if (!fs.existsSync(packInfo.metaDir))
			fs.mkdirSync(packInfo.metaDir);

		if (fs.existsSync(pathTools.join(packInfo.metaDir, 'modpack.json')))
		{	
			try
			{
				const packParsed = JSON.parse(fs.readFileSync(pathTools.join(packInfo.metaDir, 'modpack.json')));
				pack = packParsed;
				pack.mods = await this.updateModList(packParsed.mods, packParsed.fabric);
				this.setState({
					initialLoading: false
				});
				console.log(pack.mods);
			}
			catch(e)
			{
				console.error(e);
			}
		}
		else
		{
			pack.mods = [];
		}

		if (this.mounted)
			this.setState({pack: pack, packInfo: packInfo}, () => {
				this.savePersistence();
			});
		else {
			this.state.pack = pack;
			this.state.packInfo = packInfo;
			this.savePersistence();
		}

		if (
			this.state.pack.minecraftVersion === "" || 
			this.state.pack.minecraftVersion === undefined ||
			this.state.pack.minecraftVersion === null)
		{
			this.showMessageBox('Select minecraft version please', 'Ok');
			return;
		}
	}

	trimmedPackData = () => 
	{
		let pack = _.cloneDeep(this.state.pack);
		pack.mods = pack.mods.map(mod => {
			delete mod.newestTimestamp;
			delete mod.latestFile;
			return mod;
		})
		return pack;
	}

	savePack = () =>
	{
		if (!fs.existsSync(this.state.packInfo.directory))
			return;
		
		if (!fs.existsSync(this.state.packInfo.metaDir))
			fs.mkdirSync(this.state.packInfo.metaDir);

		fs.writeFileSync(pathTools.join(this.state.packInfo.metaDir, 'modpack.json'), JSON.stringify(this.trimmedPackData(), null, 4));
	}

	componentDidMount = () =>
	{
		this.mounted = true;
	}

	loadPersistence = () =>
	{
		const dataDir = pathTools.dirname(electron.remote.app.getPath('userData'));
		const persistence = pathTools.join(dataDir, "McPackDev", "persistence.json");
		try
		{
			const contentStr = fs.readFileSync(persistence, {encoding: 'utf-8'});
			const content = JSON.parse(contentStr);
			this.servers = content.servers ? content.servers : [];
			if (this.mounted)
				this.setState({selectedServer: content.selectedServer})
			else
				this.state.selectedServer = content.selectedServer

			this.openPack(content.lastOpened);
		}
		catch(e)
		{
			console.log(e);
		}
	}

	savePersistence = () => 
	{
		const dataDir = pathTools.dirname(electron.remote.app.getPath('userData'));
		const packDevDir = pathTools.join(dataDir, "McPackDev");
		const persistence = pathTools.join(packDevDir, "persistence.json");

		if (!fs.existsSync(packDevDir))
			fs.mkdirSync(packDevDir);

		fs.writeFileSync(persistence, JSON.stringify({
			lastOpened: this.state.packInfo.directory,
			servers: this.servers,
			selectedServer: this.state.selectedServer
		}))
	}

	showMessageBox = (message : string, type : string, actions: MessageBoxActions = {}) => 
	{
		console.log(actions);
		this.messageBoxActions = actions;
		if (this.mounted)
			this.setState({
				messageBoxStyle: type,
				messageBoxText: message,
				messageBoxVisible: true
			})
		else {
			this.state.messageBoxStyle =  type;
			this.state.messageBoxText = message;
			this.state.messageBoxVisible = true;
		}
	}
	
	initializePack = () =>
	{
		if (this.initializeCommon() !== true)
			return;

		if (this.state.pack.fabric)
			this.initializeFabric();
		else
			this.initializeForge();
	}

	initializeCommon = () => 
	{
		const packDir = this.state.packInfo.directory;
		if (!fs.existsSync(packDir))
		{
			this.showMessageBox('folder does not exist', 'Ok', {});
			return false;
		}

		if (
			this.state.pack.minecraftVersion === "" || 
			this.state.pack.minecraftVersion === undefined ||
			this.state.pack.minecraftVersion === null)
		{
			this.showMessageBox('Select minecraft version please', 'Ok');
			return false;
		}
		return true;
	}

	initializeForge = () =>
	{
		const packDir = this.state.packInfo.directory;

		if (!fs.existsSync(pathTools.join(packDir, "client")))
			fs.mkdirSync(pathTools.join(packDir, "client"));

		let forgeVersion = '';
		let forgeInstaller = '';

		let jobs = [
			// Download Minecraft.exe
			() => {
				return fetch("https://launcher.mojang.com/download/Minecraft.exe").then(response => {
					return response.arrayBuffer().then(buffer => {
						fs.writeFileSync(pathTools.join(packDir, "client", "Minecraft.exe"), Buffer.from(buffer));
					})
				}).catch(err => {
					return this.showMessageBox(err.message, 'Ok', {});
				})
			},
			// Create run.bat
			() => {
				return fsPromise.writeFile(pathTools.join(packDir, "run.bat"), "set WORKDIR=%cd%\\client\nstart \"\" \"client/Minecraft.exe\" --workDir \"%WORKDIR%\"")
			},
			// Create launch_profiles.json
			() => 
			{
				let profiles = new LauncherProfiles();
				return fsPromise.writeFile(pathTools.join(packDir, "client", "launcher_profiles.json"), JSON.stringify(profiles.getObject(), null, 4));
			},
			// Get Forge version and install
			() => {
				let scraper = new ForgeScrape();
				return (async () => {
					forgeVersion = await scraper.loadCurrentForgeVersion(this.state.pack.minecraftVersion);
					return scraper.downloadForge().then(buffer => {
						forgeInstaller = pathTools.join(packDir, "client", "forge-" + forgeVersion + "-installer.jar");
						return fsPromise.writeFile(forgeInstaller, Buffer.from(buffer));
					});
				})();
			},
			// Run installer:
			() => {
				this.showMessageBox('Install Forge Please', 'Modal', {});
				return new Promise((res, rej) => {
					const process = spawn('java', ['-jar', forgeInstaller]);
					console.log('java -jar ' + forgeInstaller);
					process.on('close', (code: number) => {
						res(code);
					})
					process.on('error', (err: any) => {
						console.error(err);
						rej(err);
					})
					process.stdout.on('data', (data: string) => {
						console.log(`forge-installer: ${data}`);
					});

					process.stderr.on('data', (data: string) => {
						console.error(`forge-installer: ${data}`);
					});
				});
			},
			// Modify launcher_profiles
			() => {
				let profiles = new LauncherProfiles();
				profiles.loadProfiles(pathTools.join(packDir, "client", "launcher_profiles.json"));
				profiles.modifyForgeProfile(pathTools.basename(this.state.packInfo.directory));
				return fsPromise.writeFile(pathTools.join(packDir, "client", "launcher_profiles.json"), JSON.stringify(profiles.getObject(), null, 4));
			}
		];
		this.showMessageBox('Please Wait', 'Modal', {});
		(async () => {
			// must be sequential
			for (let job of jobs)
				await job();
			this.setState({
				messageBoxVisible: false
			})
		})()
	}

	initializeFabric = () => {
		const packDir = this.state.packInfo.directory;
		
		if (!fs.existsSync(pathTools.join(packDir, "client")))
			fs.mkdirSync(pathTools.join(packDir, "client"));
			
		if (!fs.existsSync(pathTools.join(packDir, "server")))
			fs.mkdirSync(pathTools.join(packDir, "server"));

		const makeInstaller = (whatFor: string) => {
			return new Promise((res, rej) => {
				if (!fs.existsSync(pathTools.join(packDir, whatFor, "mods")))
					fs.mkdirSync(pathTools.join(packDir, whatFor, "mods"));

				const fabricInstaller = pathTools.join(packDir, "fabric-installer.jar");
				const args = ['-jar', fabricInstaller, whatFor, "-mcversion", this.state.pack.minecraftVersion, "-dir", pathTools.join(packDir, whatFor)];
				if (whatFor === "server")
				{
					args.push('-downloadMinecraft');
				}
				const process = spawn('java', args);
				process.on('close', (code: number) => {
					res(code);
				})
				process.on('error', (err: any) => {
					console.error(err);
					rej(err);
				})
				process.stdout.on('data', (data: string) => {
					console.log(`forge-installer: ${data}`);
				});
				process.stderr.on('data', (data: string) => {
					console.error(`forge-installer: ${data}`);
				});
			});
		}

		let jobs = [
			// Download Minecraft.exe
			() => {
				return fetch("https://launcher.mojang.com/download/Minecraft.exe").then(response => {
					return response.arrayBuffer().then(buffer => {
						fs.writeFileSync(pathTools.join(packDir, "client", "Minecraft.exe"), Buffer.from(buffer));
					})
				}).catch(err => {
					return this.showMessageBox(err.message, 'Ok', {});
				})
			},
			// Get Fabric version and download latest
			() => {
				let scraper = new FabricScrape();
				return (async () => {
					return scraper.downloadFabricInstaller().then(buffer => {
						const fabricInstaller = pathTools.join(packDir, "fabric-installer.jar");
						return fsPromise.writeFile(fabricInstaller, Buffer.from(buffer));
					});
				})();
			},
			// Create launcher profiles
			async () => {
				let profiles = new LauncherProfiles();
				return fsPromise.writeFile(pathTools.join(packDir, "client", "launcher_profiles.json"), JSON.stringify(profiles.makeDefault(), null, 4));
			},
			// Install fabric client
			() => {
				return makeInstaller("client");
			},
			// Install server
			() => {
				return makeInstaller("server");
			},
			// Create run.bat
			() => {
				return fsPromise.writeFile(pathTools.join(packDir, "run.bat"), "set WORKDIR=%cd%\\client\nstart \"\" \"client/Minecraft.exe\" --workDir \"%WORKDIR%\"")
			},
			// Modify launcher_profiles
			() => {
				let profiles = new LauncherProfiles();
				profiles.loadProfiles(pathTools.join(packDir, "client", "launcher_profiles.json"));
				profiles.modifyFabricProfile(pathTools.basename(this.state.packInfo.directory), this.state.pack.minecraftVersion);
				return fsPromise.writeFile(pathTools.join(packDir, "client", "launcher_profiles.json"), JSON.stringify(profiles.getObject(), null, 4));
			}
		]
		this.showMessageBox('Please Wait', 'Modal', {});
		(async () => {
			// must be sequential
			for (let job of jobs)
				await job();
			this.setState({
				messageBoxVisible: false
			})
		})()
	}

	addModToPack = async (modFromApi: any, latest: any) => {
		console.log(modFromApi);

		if (this.state.pack.mods.find(mod => mod.id === modFromApi.id) !== undefined)
			return this.showMessageBox('Mod already in list', 'Ok', {});

		const pack = _.clone(this.state.pack);

		let imageData = "";
		if (this.converterCanvas)
		{
			this.converterCanvas.height = 32;
			this.converterCanvas.width = 32;
			let ctx : (CanvasRenderingContext2D | null) = this.converterCanvas.getContext('2d');
			if (ctx)
			{
				var img = new Image;
				if (modFromApi.logo)
					img.src = modFromApi.logo.thumbnailUrl;
				ctx.drawImage(img, 0, 0, this.converterCanvas.width, this.converterCanvas.height);
			}
			imageData = this.converterCanvas.toDataURL();
		}

		if (latest === undefined) {
			let [_1, modFiles] = await this.loadModFromRemote(modFromApi.id, [this.state.pack.minecraftVersion], this.state.pack.fabric);
			modFiles = _.cloneDeep(modFiles);
			if (modFiles.length === 0) {
				this.showMessageBox('No file found for given Minecraft version.', 'Ok');
				return;
			}
			latest = _.cloneDeep(modFiles[0])
		}
		const restructured : Mod = {
			name: modFromApi.name,
			id: modFromApi.id,
			sid: modFromApi.key,
			minecraftVersions: latest.minecraft_versions,
			installedName: '',
			installedTimestamp: '',
			newestTimestamp: latest.timestamp,
			logoPng64: imageData,
			latestFile:latest
		};
		pack.mods.push(restructured);
		this.setState({pack: pack}, () => {
			this.savePack();
		});
	}

	onModSearchFetchRequest = ({value} : {value: string}) => 
	{
		return curseforge.getMods({ 
			gameVersion: this.state.pack.minecraftVersion,
			searchFilter: value,
			pageSize: 10,
			sort: 5
		}).then((mods: any)  => {
			this.setState({
				modSearchSuggestions: mods,
				lastQuery: mods
			})
		})
	}

	onModSearchClearRequest = () =>
	{
		this.setState({
			modSearchSuggestions: []
		})
	}

	getModSuggestionValue = (mod: any) => mod.name;

	renderModSuggestion = (mod: any) => (
		<div className={styles.suggestionEntry}>
			<img className={styles.suggestionImage} src={mod.logo ? mod.logo.thumbnailUrl : ''}></img>
			<div className={styles.suggestionCaption} style={{
				color: (() => {
					//if (this.state.modSearchValue !== "")
					//	return 'rgb(169,255,0)';
					if (this.state.pack.mods.findIndex(m => {
						return m.id === mod.id;
					}) !== -1)
						return 'rgb(230,120,120)';
					return undefined;
				})()
			}}>{mod.name}</div>
		</div>
	)

	onModSearchInputChange = (_1 : Event, {newValue} : {newValue: string}) => {
		this.setState({
			modSearchValue: newValue
		})
	}

	renderModSuggestionContainer = ({ containerProps, children, query } : any) => 
	{
		containerProps.className = styles.suggestionContainer;
		return (
			<div {...containerProps}>
				{children}
			</div>
		);
	}

	getModList = () => 
	{
		console.log(this.state.pack);
		const res = this.state.pack.mods.sort((lhs: Mod, rhs: Mod) => {
			return lhs.name.localeCompare(rhs.name);
		});
		return res;
	}

	sortedToReal = (index: number) => 
	{
		const sorted = this.getModList();
		return this.state.pack.mods.findIndex((mod: Mod) => {
			return (mod.id === sorted[index].id);
		})
	}

	deleteModByIndex = (index: number) =>
	{
		// find in sorted:
		index = this.sortedToReal(index);

		let pack = _.clone(this.state.pack);
		const installed = pack.mods[index].installedName;
		const isInstalled = installed !== undefined && installed !== null && installed !== "";
		const remove = () => {
			if (isInstalled)
			{
				const result = pathTools.join(this.state.packInfo.directory, 'client', 'mods', pack.mods[index].installedName);
				try
				{
					if (fs.existsSync(result))
						fs.unlinkSync(result);
				}
				catch(err: Error)
				{
					console.log(err);
				}
			}
			pack.mods.splice(index, 1);
			this.setState({
				pack: pack
			}, () => {
				this.savePack();
			});
		}

		if (isInstalled)
		{
			this.showMessageBox('This will uninstall the mod, continue?', 'YesNo', {
				yes: () => {
					remove();
				}
			})
		}
		else
		{
			remove();
		}
	}

	setConverterCanvas = (canvas : HTMLCanvasElement) => 
	{
		this.converterCanvas = canvas;
	}

	installSingle = async (downloadUrl: string, fileName: string) => 
	{
		const result = pathTools.join(this.state.packInfo.directory, 'client', 'mods', fileName);
		console.log(result);
		return fetch(downloadUrl).then(response => {
			return response.arrayBuffer().then(buffer => {
				return fsPromise.writeFile(result, Buffer.from(buffer))
			})
		})
	}

	reinstallMods = () => 
	{
		let pack = _.cloneDeep(this.state.pack);
		const installJobs = pack.mods.map((mod: Mod, i: number) => {
			// check not required, install all!
			//if (moment(value.newestTimestamp).isAfter(value.installedTimestamp))

			console.log(mod.latestFile);
			const lastSlash = mod.latestFile.download_url.lastIndexOf('/');
			const fileName = mod.latestFile.download_url.substring(lastSlash + 1, mod.latestFile.download_url.length);
			pack.mods[i].installedName = fileName;
			pack.mods[i].installedTimestamp = mod.latestFile.timestamp;
			return async () => {return this.installSingle(mod.latestFile.download_url, fileName)};
		});

		const modsFolder = pathTools.join(this.state.packInfo.directory, 'client', 'mods');
		try 
		{
			const doInstall = () => 
			{
				fs.mkdirSync(modsFolder);
				if (!fs.existsSync(modsFolder))
				{
					this.showMessageBox('Could not create mods folder', 'Ok');
					return;
				}

				(async () => {
					// must be sequential
					this.setState({
						installProgress: -1,
						progressBoxVisible: true
					}, async () => {
						for (let job of installJobs)
						{
							this.setState({
								installProgress: this.state.installProgress + 1
							}, async () => {
								await job();
							})
						}
						this.setState({
							progressBoxVisible: false,
							pack: pack
						}, () => {
							this.savePack();
							this.showMessageBox('Done',  'Ok');
						})
					})
				})();
			}

			if (fs.existsSync(modsFolder))
				fsPromise.rmdir(modsFolder, { recursive: true }).then(() => {
					doInstall();
				}).catch((err: any) => {
					this.showMessageBox(err,  'Ok');
				});
			else
				doInstall();
		}
		catch(err: Error)
		{
			this.showMessageBox('Could not create mods folder: ' + err.message, 'Ok');
			return;
		}
	}

	getMinecraftVersions = async () => 
	{
		return fetch("https://addons-ecs.forgesvc.net/api/v2/minecraft/version", {}).then(response => {
			return response.json().then(json => {
				return json;
			})
		})
	}

	installForge = () => 
	{
		let scraper = new ForgeScrape();
		scraper.loadCurrentForgeVersion(this.state.pack.minecraftVersion);
	}

	/**
	 * Only deploy files relevant for an update.
	 */
	miniDeploy = () => 
	{
		this.showMessageBox('Please wait for copy', 'Modal');

		const updateDestination = pathTools.join(this.state.packInfo.directory, 'updates');
		if (!fs.existsSync(updateDestination))
			fs.mkdirSync(updateDestination);

		const currentUpdateDest = pathTools.join(updateDestination, moment().format("D_MMM_YY HH_mm_ss"));
		if (!fs.existsSync(currentUpdateDest))
			fs.mkdirSync(currentUpdateDest);
			
		const copyOver = (...args: Array<string>) => {this.copyOver(currentUpdateDest, ...args)};
		const createDirInDest = (...args: Array<string>) => {this.createDirInDest(currentUpdateDest, ...args)};

		createDirInDest("client");
		copyOver("client", "config");
		copyOver("client", "mods");
		copyOver("client", "scripts");

		this.setState({
			messageBoxVisible: false
		}, () => {
			this.showMessageBox('Done',  'Ok');
		})
	}

	updateMods = () => 
	{
		let pack = _.cloneDeep(this.state.pack);

		// create install and delete jobs:
		const jobs = pack.mods.map((mod: Mod, i) => {
			const isOutdated = (mod.installedTimestamp === "" || mod.installedTimestamp === null || moment(mod.newestTimestamp).isAfter(mod.installedTimestamp));

			if (isOutdated)
			{
				const lastSlash = mod.latestFile.download_url.lastIndexOf('/');
				const fileName = mod.latestFile.download_url.substring(lastSlash + 1, mod.latestFile.download_url.length);
				const oldName = _.clone(pack.mods[i].installedName);
				pack.mods[i].installedName = fileName;
				pack.mods[i].installedTimestamp = mod.latestFile.timestamp;
				return async () => {
					if (oldName.length > 0)
						fs.unlinkSync(pathTools.join(this.state.packInfo.directory, "client", "mods", oldName));
					return this.installSingle(mod.latestFile.download_url, fileName);
				};
			}

			// just a noop for up to date mods
			return async () => {}
		});

		(async () => {
			// must be sequential
			this.setState({
				installProgress: -1,
				progressBoxVisible: true
			}, async () => {
				for (let job of jobs)
				{
					this.setState({
						installProgress: this.state.installProgress + 1
					}, async () => {
						await job();
					})
				}
				this.setState({
					progressBoxVisible: false,
					pack: pack
				}, () => {
					this.savePack();
					this.miniDeploy();
				})
			})
		})();
	}

	copyOver = (dest: string, ...relativeNames: Array<string>) => 
	{
		const from = pathTools.join(this.state.packInfo.directory, ...relativeNames);
		const to = pathTools.join(dest, ...relativeNames);

		if (!fs.existsSync(from))
		{
			console.log(from + ' does not exist');
			return;
		}

		if (fs.lstatSync(from).isDirectory())
			fs.mkdirSync(to);
		fsExtra.copySync(from, to);
	};

	createDirInDest = (dest: string, ...relativeNames: Array<string>) => 
	{
		const arr = [...relativeNames];
		let path = dest;
		for (let i = 0; i != arr.length; ++i)
		{
			path = pathTools.join(path, arr[i]);
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
		}
	}

	getCurrentServer = () => 
	{
		return this.servers.find(server => {
			return server.name === this.state.selectedServer;
		})
	}

	deployPack = () => 
	{
		this.showMessageBox('Please wait for copy', 'Modal');

		const deployDestination = pathTools.join(this.state.packInfo.directory, 'deployments');
		if (!fs.existsSync(deployDestination))
			fs.mkdirSync(deployDestination);

		const dateTime = moment().format("D_MMM_YY HH_mm_ss");
		const currentDeploymentDest = pathTools.join(deployDestination, dateTime);
		if (!fs.existsSync(currentDeploymentDest))
			fs.mkdirSync(currentDeploymentDest);

		const copyOver = (...args: Array<string>) => {this.copyOver(currentDeploymentDest, ...args)};
		const createDirInDest = (...args: Array<string>) => {this.createDirInDest(currentDeploymentDest, ...args)};
		const server = this.getCurrentServer();

		const createUpdater = (path: string) => 
		{
			createDirInDest("client", "mods");
			fsExtra.copySync(path, currentDeploymentDest);
			fs.writeFileSync(pathTools.join(currentDeploymentDest, 'updater.json'), (() => {
				return JSON.stringify({
					ignoreMods: [],
					updateServerIp: server?.ipAddr,
					updateServerPort: server?.port
				})
			})());
		}

		createDirInDest("client");
		const updaterDevPath = pathTools.join(process.cwd(), 'updater_ui', 'release', 'build', 'win-unpacked')
		if (server && fs.existsSync(pathTools.join(process.cwd(), 'updater'))) {
			createUpdater(pathTools.join(process.cwd(), 'updater'));
		} else if (server && fs.existsSync(updaterDevPath)) {
			createUpdater(updaterDevPath);
		}
		else {
			copyOver("run.bat");
			copyOver("client", "mods");
		}
		copyOver("mcpackdev");
		copyOver("client", "config");
		copyOver("client", "libraries");
		copyOver("client", "scripts");
		copyOver("client", "versions");
		copyOver("client", "shaderpacks");
		copyOver("client", "resourcepacks");
		copyOver("client", "Minecraft.exe");

		// copies relevant part of launcher profiles
		let profs = new LauncherProfiles();
		profs.loadProfiles(pathTools.join(this.state.packInfo.directory, "client", "launcher_profiles.json"));
		fs.writeFileSync(
			pathTools.join(currentDeploymentDest, "client", "launcher_profiles.json"), 
			JSON.stringify(profs.getObject(), null, 4)
		);

		// make zip
		const archiveStream = fs.createWriteStream(pathTools.join(this.state.packInfo.directory, "deployments", dateTime + ".zip"));
		const archive = archiver('zip', {zlib: {level: 9}});

		archiveStream.on('close', () => {
			console.log(archive.pointer() + ' total bytes');
			this.setState({
				messageBoxVisible: false
			})

			fs.rmdirSync(currentDeploymentDest, { recursive: true });
		});

		archive.pipe(archiveStream);
		archive.directory(currentDeploymentDest, false);
		archive.finalize();
	}

	onMessageBoxButton = (btn: string, inputText: string) =>
	{
		const action = this.messageBoxActions[btn.toLowerCase()];
		if (action !== undefined)
			action(inputText);
		this.messageBoxActions = {};
	}

	suggestInput = (props: any) => {
		return <input {...props} onKeyUp={(e: KeyboardEvent) => {
			if (e.keyCode === 13)
				this.onAddModClick();
		}}></input>
	}

	onAddModClick = () => {
		this.addModToPack(this.state.lastQuery.find(suggestion => {
			return suggestion.name === this.state.modSearchValue;
		}))
		this.setState({
			modSearchValue: '',
			lastQuery: []
		})
	}

	uploadPack = () => {
		this.showMessageBox('Waiting...', 'Ok');
		const server = this.getCurrentServer();
		if (!server) {
			console.log('no server selected');
			return;
		}

		const files = fs.readdirSync(pathTools.join(this.state.packInfo.directory, 'client', 'mods')).map(file => {
			//return pathTools.join(this.state.packInfo.directory, 'client', 'mods', file);
			return file;
		});
		const tarTemp = pathTools.join(this.state.packInfo.directory, 'mods.tar');
		console.log('Packing files: ', files)
		tar.create(
			{
				file: tarTemp,
				cwd: pathTools.join(this.state.packInfo.directory, 'client', 'mods')
			},
			files
		).then(_ => {
			electron.ipcRenderer.send('upload', {
				addr: server.ipAddr,
				port: server.port,
				file: tarTemp
			});
		})
	}

	onInstallClick = (index: number) => 
	{
		let pack = _.cloneDeep(this.state.pack);

		index = this.sortedToReal(index);
		const mod = this.state.pack.mods[index];
		console.log(mod);

		const lastSlash = mod.latestFile.download_url.lastIndexOf('/');
		const fileName = mod.latestFile.download_url.substring(lastSlash + 1, mod.latestFile.download_url.length);

		// mack modpack definition backup
		const safeDate = (new Date()).toISOString().replaceAll(':','_');		
		const backupDefinition = pathTools.join(this.state.packInfo.metaDir, 'modpack_' + safeDate + '.json');
		console.log(backupDefinition);
		fs.writeFileSync(backupDefinition, JSON.stringify(this.trimmedPackData(), null, 4));
		
		const oldName = _.clone(pack.mods[index].installedName);
		pack.mods[index].installedName = fileName;
		pack.mods[index].installedTimestamp = mod.latestFile.timestamp;
		const toDelete = pathTools.join(this.state.packInfo.directory, "client", "mods", oldName);
		if (oldName.length > 0 && fs.existsSync(toDelete))
			fs.unlinkSync(toDelete);
		this.installSingle(mod.latestFile.download_url, fileName);
		
		(async () => {
			this.setState({
				pack: pack
			}, () => {
				this.savePack();
				this.miniDeploy();
			})
		})();
	}

	manualInstall = () => 
	{
		this.showMessageBox('Mod ID: ', 'Input', {
			ok: (id) => {
				curseforge.getMod(id).then((mod: any) => {
					console.log(mod);
					let str = '';
					mod.latestFiles.map((file: any, index: number) => {
						str += index + ": ";
						str += file.minecraft_versions.reduce((lhs: string, rhs: string) => {
							return lhs + ':' + rhs;
						});
						str += ' - ';
						str += file.timestamp;
						str += ' - ';
						str += file.download_url.substring(file.download_url.lastIndexOf('/') + 1);
						str += '\n';
					})
					this.showMessageBox('Pick One (invalid input is ignored):\n' + str, 'Input', {
						ok: (num: number) => {
							if (mod.latestFiles[num]) {
								const selected = mod.latestFiles[num];
								console.log(mod);
								this.addModToPack(mod, selected);
							}
						}
					})
				});
				console.log(id)
			},
			cancel: () => {}
		})
	}

	render()
	{
		return (
			<div className={styles.container} data-tid="container">
				<ReactModal initWidth={500} initHeight={200} 
					onFocus={() => {}}
					className={styles.messageBoxModal}
					onRequestClose={()=>{}} 
					isOpen={this.state.initialLoading}
					disableResize={true}
					disableMove={true}
					top={200}
					left={300}
					disableVerticalMove={true}
					disableHorizontalMove={true}
				>
					<div style={{
						paddingTop: "30px",
						paddingLeft: "8px",
						fontSize: "18px"
					}}>Loading</div>
				</ReactModal>

				<MessageBox
					visible={this.state.messageBoxVisible}
					message={this.state.messageBoxText}
					onButtonPress={(btn: string, inputText: string) => {
						this.setState({messageBoxVisible: false});
						this.onMessageBoxButton(btn, inputText);
					}}
					boxStyle={this.state.messageBoxStyle}
				>
				</MessageBox>

				<MessageBox
					visible={this.state.progressBoxVisible}
					message={'Downloading...'}
					onButtonPress={() => {}}
					boxStyle={'Modal'}
					disableResize={false}
				>
					<Line
						percent={(() => {
							let progress = this.state.installProgress;
							let total = this.state.installTotal;
							if (total <= 0)
								total = 1;

							if (progress < 0)
								progress = 0;

							return '' + (100*(progress / total));
						})()}
						strokeWidth="4"
						strokeColor="D3D3D3"
					></Line>
				</MessageBox>

				<div className={styles.packArea}>
					<div>Opened Pack: </div>
					<div className={styles.openedPack}>{this.state.packInfo.directory}</div>
					<SlimButton 
						disabled={this.state.initialLoading} 
						onClick={() => {
							electron.remote.dialog.showOpenDialog({properties: ['openDirectory']}).then((dir) => {
								this.openPack(dir.filePaths[0]);
							})
						}}
					>Open</SlimButton>
				</div>
				<div className={styles.packOptionsArea}>
					<ThemeProvider theme={theme}>
						<StyledForm>
							<StyledLabel id="minecraft_version_label">Minecraft Version</StyledLabel>
							<StyledSelect
								id="minecraft_version_select"
								labelId="minecraft_version_label"
								/*classes={{
									icon: this.props.classes.whiteColor
								}}
								*/
								disabled={this.state.initialLoading}
								value={this.state.pack.minecraftVersion}
								onChange={(event) => {
									let pack = _.clone(this.state.pack);
									pack.minecraftVersion = event.target.value;
									this.setState({
										pack: pack
									}, () => {
										this.savePack();
									});									
								}}
							>
								{this.state.mcVersions.map((version, i) => {
									return (
										<MenuItem key={i} value={version}>{version}</MenuItem>
									)
								})}
							</StyledSelect>
						</StyledForm>
						<StyledForm>
							<StyledLabel 
								id="forge_or_fabric_label"
							>Modloader</StyledLabel>
							<StyledSelect
								id="forge_or_fabric_select"
								labelId="forge_or_fabric_label"
								value={this.state.pack.fabric ? "Fabric" : "Forge"}
								disabled={this.state.initialLoading}
								onChange={(event) => {
									let pack = _.clone(this.state.pack);
									pack.fabric = event.target?.value === "Fabric";
									console.log(pack.fabric);
									this.setState({
										pack: pack
									}, () => {
										this.savePack();
									});
								}}
							>	
							{["Fabric", "Forge"].map((version, i) => {
								return (
									<MenuItem key={i} value={version}>{version}</MenuItem>
								)
							})}						
							</StyledSelect>
						</StyledForm>
						<StyledForm>
							<StyledLabel id="server_label">Server</StyledLabel>
							<StyledSelect
								id="server_select"
								labelId="server_label"
								disabled={this.state.initialLoading}
								value={this.state.selectedServer}
								onChange={(event) => {
									this.setState({
										selectedServer: event.target.value
									}, () => {
										this.savePersistence();
									})								
								}}
							>
								{this.servers.map((val, i) => {
									return (
										<MenuItem key={i} value={val.name}>{val.name}</MenuItem>
									)
								})}
							</StyledSelect>
						</StyledForm>
					</ThemeProvider>
				</div>
				<div className={styles.modTableArea}>
					<div className={styles.modToolbar}>
						<div className={styles.modAddRegion}>
							<div
								className={styles.suggestLabel}
							>
								{'Search for mod to add:'}
							</div>
							<div className={styles.suggestButtonWrap}>
								<Autosuggest
									className={styles.autosuggest}
									suggestions={this.state.modSearchSuggestions}
									onSuggestionsFetchRequested={this.throttledFetch}
									onSuggestionsClearRequested={this.onModSearchClearRequest}
									getSuggestionValue={this.getModSuggestionValue}
									renderSuggestion={this.renderModSuggestion}
									renderSuggestionsContainer={this.renderModSuggestionContainer}
									renderInputComponent={this.suggestInput}
									inputProps={{
										placeholder: 'Enter a mod name',
										value: this.state.modSearchValue,
										onChange: this.onModSearchInputChange,
										className: styles.suggestBox
									}}
								/>
								<button
									onClick={() => {
										this.onAddModClick();
									}}
								>{'Add'}</button>
							</div>
						</div>
						<div className={styles.modpackButtons}>
							<StyledButton
								onClick={this.initializePack}
								disabled={this.state.initialLoading}
							>
								Initialize Pack
							</StyledButton>
							<StyledButton
								onClick={this.reinstallMods}
								disabled={this.state.initialLoading}
							>
								(Re)Install Mods
							</StyledButton>
							<StyledButton
								onClick={this.manualInstall}
								disabled={this.state.initialLoading}
							>
								Manual Install
							</StyledButton>
							<StyledButton
								onClick={this.updateMods}
								disabled={this.state.initialLoading}
							>
								Update
							</StyledButton>
							<StyledButton
								onClick={this.deployPack}
								disabled={this.state.initialLoading}
							>
								Deploy
							</StyledButton>
							<StyledButton
								onClick={this.uploadPack}
								disabled={this.state.initialLoading}
							>
								Upload
							</StyledButton>
						</div>
					</div>
					<div className={styles.tableRegion}>
						<ModTable 
							className={styles.modTable}
							columns={[
								{
									Header: '',
									accessor: 'logoPng64',
									width: 38,
									id: 'icon'
								},
								{
									Header: 'Name',
									accessor: (mod: Mod) => {
										return {
											name: mod.name,
											error: mod.error
										};
									},
									id: 'name',
									width: 200
								},
								{
									Header: 'Installed',
									accessor: (mod: Mod) => {
										return {
											installed: mod.installedTimestamp,
											newest: mod.newestTimestamp
										};
									},
									id: 'installed_time',
									width: 200
								},
								{
									Header: 'Newest',
									accessor: (mod: Mod) => {
										return {
											installed: mod.installedTimestamp,
											newest: mod.newestTimestamp
										};
									},
									id: 'newest_time',
									width: 200
								},
								{
									Header: 'Installed File',
									accessor: (mod: Mod) => {
										let installed = mod.installedName;
										if (installed === undefined || installed === "" || installed === null)
											return "not installed";
										return installed;
									},
									id: 'installed_file',
									width: 400
								},
								{
									Header: 'Version',
									accessor: (mod: Mod) => {
										return JSON.stringify(mod.latestFile.minecraft_versions);
									},
									id: 'version'
								}
							]}
							onChange={() => {}}
							onDelete={this.deleteModByIndex}
							addLine={() => {}}
							data={this.getModList()}
							onInstallClick={(index) => {this.onInstallClick(index)}}
						>
						</ModTable>
					</div>
				</div>
				<canvas ref={this.setConverterCanvas} style={{display: 'none'}}></canvas>
			</div>
		);
	}
};

export default Home;
