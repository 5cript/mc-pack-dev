import React from 'react';
//import { Link } from 'react-router-dom';
//import routes from '../constants/routes.json';
import styles from './Home.css';
import Autosuggest from 'react-autosuggest';
import MessageBox from './MessageBox';
import _ from 'lodash';
import moment from 'moment';
import MenuItem from '@material-ui/core/MenuItem';
import InputLabel from '@material-ui/core/InputLabel';
import { Line } from 'rc-progress';

import ModTable from './ModTable';
import {Mod} from '../minecraft/mod';
import StyledButton, {SlimButton} from './button';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import ForgeScrape from '../minecraft/forge';
const { spawn } = require('child_process');
import { styled, ThemeProvider, createMuiTheme, withStyles } from '@material-ui/core/styles';
import LauncherProfiles from '../minecraft/launcher_profiles';

const electron = window.require('electron');
const curseforge = window.require("mc-curseforge-api");
const pathTools = window.require('path');
const fs = window.require('fs');
const fsPromise = window.require('fs').promises;

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
		minecraftVersion: string
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
	installTotal: number
}
type MessageBoxActions = {
	yes: Function | undefined,
	no: Function | undefined,
	ok: Function | undefined
} | {}

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
			minecraftVersion: ''
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
		installTotal: 0
	};
	messageBoxActions: MessageBoxActions = {yes: ()=>{}, no: ()=>{}, ok: ()=>{}};

	constructor(props : HomeProps)
	{
		super(props);
		this.forgeVersion = "";

		this.loadPersistence();
		(async () => {
			let mcVersions = await this.getMinecraftVersions();
			mcVersions = mcVersions.map((version: any) => version.versionString);
			if (this.mounted)
				this.setState({mcVersions: mcVersions})
			else
				this.state.mcVersions = mcVersions;
		})()
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

	loadModFromRemote = (id: number, mcVersions: Array<string>) =>
	{
		return Promise.all([curseforge.getMod(id), curseforge.getModFiles(id).then((modFiles: any) => {
			modFiles = modFiles.filter((file: any) => {
				return file.minecraft_versions.find((version : string) => {
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
			})
			modFiles.sort((lhs: {timestamp: string}, rhs: {timestamp: string}) => {
				return moment(rhs.timestamp).isAfter(lhs.timestamp) ? 1 : -1;
			})
			return modFiles;
		})]);
	}

	updateModList = async (mods: Array<Mod>) =>
	{
		const promises = mods.map((mod : Mod) => {
			return this.loadModFromRemote(mod.id, mod.minecraftVersions).then(([_1, modFiles]) => {
				if (modFiles.length === 0) {
					mod.newestTimestamp = '?';
					return;
				}
				mod.newestTimestamp = modFiles[0].timestamp;
				mod.latestFile = modFiles[0];
				console.log(mod.newestTimestamp)
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
		// TODO: load mod file.

		let pack = _.clone(this.state.pack);
		try
		{
			pack = JSON.parse(fs.readFileSync(pathTools.join(packInfo.metaDir, 'modpack.json')));
			pack.mods = await this.updateModList(pack.mods);
		}
		catch(e)
		{
			console.error(e);
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
	}

	savePack = () =>
	{
		if (!fs.existsSync(this.state.packInfo.directory))
			return;
		
		if (!fs.existsSync(this.state.packInfo.metaDir))
			fs.mkdirSync(this.state.packInfo.metaDir);

		let pack = _.clone(this.state.pack);
		pack.mods = pack.mods.map(mod => {
			delete mod.newestTimestamp;
			delete mod.latestFile;
			return mod;
		})

		fs.writeFileSync(pathTools.join(this.state.packInfo.metaDir, 'modpack.json'), JSON.stringify(pack, null, 4));
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
			lastOpened: this.state.packInfo.directory
		}))
	}

	showMessageBox = (message : string, type : string, actions: MessageBoxActions = {}) => 
	{
		this.messageBoxActions = actions;
		this.setState({
			messageBoxStyle: type,
			messageBoxText: message,
			messageBoxVisible: true
		})
	}

	initializePack = () =>
	{
		const packDir = this.state.packInfo.directory;
		if (!fs.existsSync(packDir))
			return this.showMessageBox('folder does not exist', 'Ok', {});

		if (!fs.existsSync(pathTools.join(packDir, "minecraft")))
			fs.mkdirSync(pathTools.join(packDir, "minecraft"));

		let forgeVersion = '';
		let forgeInstaller = '';

		let jobs = [
			// Download Minecraft.exe
			() => {
				return fetch("https://launcher.mojang.com/download/Minecraft.exe").then(response => {
					return response.arrayBuffer().then(buffer => {
						fs.writeFileSync(pathTools.join(packDir, "minecraft", "Minecraft.exe"), Buffer.from(buffer));
					})
				}).catch(err => {
					return this.showMessageBox(err.message, 'Ok', {});
				})
			},
			// Create run.bat
			() => {
				return fsPromise.writeFile(pathTools.join(packDir, "run.bat"), "set WORKDIR=%cd%\\minecraft\nstart \"\" \"minecraft/Minecraft.exe\" --workDir \"%WORKDIR%\"")
			},
			// Create launch_profiles.json
			() => 
			{
				let profiles = new LauncherProfiles();
				return fsPromise.writeFile(pathTools.join(packDir, "minecraft", "launcher_profiles.json"), JSON.stringify(profiles.getObject(), null, 4));
			},
			// Get Forge version and install
			() => {
				let scraper = new ForgeScrape();
				return (async () => {
					forgeVersion = await scraper.loadCurrentForgeVersion(this.state.pack.minecraftVersion);
					return scraper.downloadForge().then(buffer => {
						forgeInstaller = pathTools.join(packDir, "minecraft", "forge-" + forgeVersion + "-installer.jar");
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
				profiles.loadProfiles(pathTools.join(packDir, "minecraft", "launcher_profiles.json"));
				profiles.modifyForgeProfile(pathTools.basename(this.state.packInfo.directory));
				return fsPromise.writeFile(pathTools.join(packDir, "minecraft", "launcher_profiles.json"), JSON.stringify(profiles.getObject(), null, 4));
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



	addModToPack = async (modFromApi: any) => {
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
				img.src = modFromApi.logo.thumbnailUrl;
				ctx.drawImage(img, 0, 0, this.converterCanvas.width, this.converterCanvas.height);
			}
			imageData = this.converterCanvas.toDataURL();
		}

		const [_1, modFiles] = await  this.loadModFromRemote(modFromApi.id, [this.state.pack.minecraftVersion]);
		console.log(modFiles);
		if (modFiles.length === 0) {
			this.showMessageBox('No file found for given Minecraft version.', 'Ok');
			return;
		}
		const mod : Mod = {
			name: modFromApi.name,
			id: modFromApi.id,
			sid: modFromApi.key,
			minecraftVersions: modFiles[0].minecraft_versions,
			installedName: '',
			installedTimestamp: '',
			newestTimestamp: modFiles[0].timestamp,
			logoPng64: imageData,
			latestFile: modFiles[0]
		};
		pack.mods.push(mod);
		this.setState({pack: pack}, () => {
			this.savePack();
		});
	}

	onModSearchFetchRequest = ({value} : {value: string}) => 
	{
		curseforge.getMods({ 
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
			<img className={styles.suggestionImage} src={mod.logo.thumbnailUrl}></img>
			<div className={styles.suggestionCaption}>{mod.name}</div>
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
		return this.state.pack.mods;
	}

	deleteModByIndex = (index: number) =>
	{
		let pack = _.clone(this.state.pack);
		const installed = pack.mods[index].installedName;
		const isInstalled = installed !== undefined && installed !== null && installed !== "";
		const remove = () => {
			if (isInstalled)
			{
				const result = pathTools.join(this.state.packInfo.directory, 'minecraft', 'mods', pack.mods[index].installedName);
				fs.unlinkSync(result);
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
				Yes: () => {
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

	installSingle = async (latestFile: any, fileName: string) => 
	{
		const result = pathTools.join(this.state.packInfo.directory, 'minecraft', 'mods', fileName);
		console.log(result);
		return fetch(latestFile.download_url).then(response => {
			return response.arrayBuffer().then(buffer => {
				return fsPromise.writeFile(result, Buffer.from(buffer))
			})
		})
	}

	reinstallMods = () => 
	{
		let pack = _.clone(this.state.pack);
		const installJobs = pack.mods.map((mod: Mod, i: number) => {
			// check not required, install all!
			//if (moment(value.newestTimestamp).isAfter(value.installedTimestamp))

			const lastSlash = mod.latestFile.download_url.lastIndexOf('/');
			const fileName = mod.latestFile.download_url.substring(lastSlash + 1, mod.latestFile.download_url.length);
			pack.mods[i].installedName = fileName;
			pack.mods[i].installedTimestamp = mod.latestFile.timestamp;
			return async () => {return this.installSingle(mod.latestFile, fileName)};
		});

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
					progressBoxVisible: false
				})
				this.savePack();
			})
		})()
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

	updateMods = () => 
	{

	}

	deployPack = () => 
	{

	}

	render()
	{
		return (
			<div className={styles.container} data-tid="container">
				<div className={styles.packArea}>
					<div>Opened Pack: </div>
					<div className={styles.openedPack}>{this.state.packInfo.directory}</div>
					<SlimButton onClick={() => {
						electron.remote.dialog.showOpenDialog({properties: ['openDirectory']}).then((dir) => {
							this.openPack(dir.filePaths[0]);
						})
					}}>Open</SlimButton>
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
									onSuggestionsFetchRequested={this.onModSearchFetchRequest}
									onSuggestionsClearRequested={this.onModSearchClearRequest}
									getSuggestionValue={this.getModSuggestionValue}
									renderSuggestion={this.renderModSuggestion}
									renderSuggestionsContainer={this.renderModSuggestionContainer}
									inputProps={{
										placeholder: 'Enter a mod name',
										value: this.state.modSearchValue,
										onChange: this.onModSearchInputChange,
										className: styles.suggestBox
									}}
								/>
								<button
									onClick={() => {
										this.addModToPack(this.state.lastQuery.find(suggestion => {
											return suggestion.name === this.state.modSearchValue;
										}))
										this.setState({
											modSearchValue: '',
											lastQuery: []
										})
									}}
								>{'Add'}</button>
							</div>
						</div>
						<div className={styles.modpackButtons}>
							<StyledButton
								onClick={this.initializePack}
							>
								Initialize Pack
							</StyledButton>
							<StyledButton
								onClick={this.reinstallMods}
							>
								(Re)Install Mods
							</StyledButton>
							<StyledButton
								onClick={this.updateMods}
							>
								Update
							</StyledButton>
							<StyledButton
								onClick={this.deployPack}
							>
								Deploy
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
									accessor: 'name',
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
									}
								}
							]}
							onChange={() => {}}
							onDelete={this.deleteModByIndex}
							addLine={() => {}}
							data={this.getModList()}
						>
						</ModTable>
					</div>
				</div>

				<MessageBox
					visible={this.state.messageBoxVisible}
					message={this.state.messageBoxText}
					onButtonPress={() => {
						this.messageBoxActions = {};
						this.setState({messageBoxVisible: false});
					}}
					boxStyle={this.state.messageBoxStyle}
				>
				</MessageBox>

				<MessageBox
					visible={this.state.progressBoxVisible}
					message={'Downloading...'}
					onButtonPress={() => {}}
					boxStyle={'Modal'}
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

				<canvas ref={this.setConverterCanvas} style={{display: 'none'}}></canvas>
			</div>
		);
	}
};

export default Home;
