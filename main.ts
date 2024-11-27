import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, RequestUrlParam, DropdownComponent, FileView } from 'obsidian';

interface Settings {
	client_id: string;
	client_secret: string;
	access_token: string;
}

const DEFAULT_SETTINGS: Settings = {
	client_id: '',
	client_secret: '',
	access_token: ''
}

const searchGame = async (plugin: Plugin, data: Settings) => {
	
	const config: RequestUrlParam = {
		url: 'https://api.igdb.com/v4/games',
		method: 'POST',
		contentType: 'plain',
		body: `search "{doom}"; fields id, name;`,
		headers: {
			'Client-ID': `${data.client_id}`,
			'Authorization': `Bearer ${data.access_token}`
		}
	}

	await requestUrl(config)
		.then(function (response) {
			new Notice('Sucesso.');
			new SearchCoverModal(this.app, response.json, data).open();
			})
		.catch(function (error) {
			new Notice('Erro.');
			console.log(error);
			});
}

const ensureDirectoryExists = async (app: App, folderPath: string) => {
    try {
		console.log('folderPath', folderPath);
        const folder = app.vault.getAbstractFileByPath(folderPath);
		console.log('folder', folder);
        if (!folder) {
            await app.vault.createFolder(folderPath);
            console.log(`Diretório criado: ${folderPath}`);
        } else {
            console.log(`Diretório já existe: ${folderPath}`);
        }
    } catch (error) {
        console.error('Erro ao verificar ou criar o diretório:', error);
    }
}

function getFileNameFromUrl(url: string): { fileName: string; extension: string } {
    // Extrai a parte final da URL
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];

    // Separa o nome do arquivo e a extensão
    const [fileName, extension] = lastPart.split('.');

    return { fileName, extension };
}

const downloadImageFile = async (app: App, url: string, data: Settings): Promise<string> => {
	const filename = getFileNameFromUrl(url)
	const savePath = `mygamecover/${filename.fileName}.${filename.extension}`
	const folderPath = savePath.substring(0, savePath.lastIndexOf('/')); // Extraindo a pasta do caminho
	await ensureDirectoryExists(app, folderPath); // Garante que a pasta exista
	try {
		const config: RequestUrlParam = {
			url: `https:${url}`,
			method: 'GET',
			contentType: 'arraybuffer', // binary response,
			headers: {
				'Client-ID': `${data.client_id}`,
				'Authorization': `Bearer ${data.access_token}`,
			}
		}
		return await requestUrl(config)
			.then(async (response) => {
				new Notice('Cover was downloaded successfully.');
				// Converte os dados binários para um Blob ou Uint8Array
				const imageData = new Uint8Array(response.arrayBuffer);
				// Salva a imagem no sistema de arquivos do Obsidian
				const file = await app.vault.createBinary(savePath, imageData);
				console.log(`Imagem salva com sucesso em: ${savePath}`);
				console.log('return', `${file.path}`);
				// Salvar e retornar filepath
				return `${file.path}`
				})
			.catch(function (error) {
				new Notice('Error downloading cover.');
				console.log(error);
				return '';
				});
    } catch (error) {
        console.error('Erro ao baixar ou salvar a imagem:', error);
		return '';
    }
}

const getCoverData = async (app: App, id: string, elImg: HTMLElement, data: Settings) => {
	
	const config: RequestUrlParam = {
		url: 'https://api.igdb.com/v4/games',
		method: 'POST',
		contentType: 'plain',
		body: `fields id,name,rating,cover.width,cover.height,cover.image_id,cover.url,cover.image_id; where id=${id};`,
		headers: {
			'Client-ID': `${data.client_id}`,
			'Authorization': `Bearer ${data.access_token}`,
			'Accept': 'application/json'
		}
	}

	await requestUrl(config)
		.then(async (response) => {
			new Notice('Success.');
			// Carregar a imagem usando método Get
			const filePath = await downloadImageFile(app, response.json[0].cover.url, data);
			// Obtém o caminho de recurso absoluto
			const resourcePath = app.vault.adapter.getResourcePath(filePath);
			elImg.setAttr('src', resourcePath)
			})
		.catch((error) => {
			new Notice('Error.');
			console.log(error);
			});
}

const showSelectedGameCover = (app: App, value: string, elImg: HTMLImageElement, settings: Settings) => {
	getCoverData(app, value, elImg, settings);
}

export default class MyPlugin extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();
		const plugin = this;

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('image-down', 'Get cover image', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Buscando jogo...');
			searchGame(plugin, this.settings);
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('.');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				// new SearchCoverModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						// new SearchCoverModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			// console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SearchCoverModal extends Modal {
	gamesData: {id: number, name: string}[];
	settings: Settings;
	app: App;

	constructor(app: App, gamesData: {id: number, name: string}[], settings: Settings) {
		super(app);
		this.app = app;
		this.gamesData = gamesData;
		this.settings = settings;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Game title: ');
		const gamesDropDown = new DropdownComponent(contentEl);
		gamesDropDown.addOption('', '-- Select --');
		this.gamesData.forEach(game => {
			gamesDropDown.addOption(`${game.id}`, game.name);
		});
		const book = contentEl.createEl('div');
		const imageAttrs: DomElementInfo = {type: 'img', attr: {'src': 'https://picsum.photos/id/237/200'}}
		const elImg = book.createEl('img', imageAttrs);
		const elSmall = book.createEl('small', { text: '' });
		gamesDropDown.onChange((value) => {
			if (value != '') {
				elSmall.setText(`Id: ${value}`);
				showSelectedGameCover(this.app, value, elImg, this.settings);
			}
		})
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('IMDb client id')
			.setDesc('client_id')
			.addText(text => text
				.setPlaceholder('Enter your client_id')
				.setValue(this.plugin.settings.client_id)
				.onChange(async (value) => {
					this.plugin.settings.client_id = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('IMDb client secret')
			.setDesc('client_secret')
			.addText(text => text
				.setPlaceholder('Enter your client_secret')

				.setValue(this.plugin.settings.client_secret)
				.onChange(async (value) => {
					this.plugin.settings.client_secret = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('IMDb bearer access token')
			.setDesc('access_token')
			.addText(text => text
				.setPlaceholder('Enter your access_token')
				.setValue(this.plugin.settings.access_token)
				.onChange(async (value) => {
					this.plugin.settings.access_token = value;
					await this.plugin.saveSettings();
				}));
	}
}
