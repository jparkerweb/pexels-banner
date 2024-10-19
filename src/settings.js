import { PluginSettingTab, Setting, FuzzySuggestModal } from 'obsidian';

const DEFAULT_SETTINGS = {
    apiKey: '',
    imageSize: 'medium',
    imageOrientation: 'landscape',
    numberOfImages: 10,
    defaultKeywords: 'nature, abstract, landscape, technology, art, cityscape, wildlife, ocean, mountains, forest, space, architecture, food, travel, science, music, sports, fashion, business, education, health, culture, history, weather, transportation, industry, people, animals, plants, patterns',
    yPosition: 50,
    customBannerField: 'banner',
    customYPositionField: 'banner-y',
    folderImages: [],
    contentStartPosition: 150,
    customContentStartField: 'content-start',
};

class FolderSuggestModal extends FuzzySuggestModal {
    constructor(app, onChoose) {
        super(app);
        this.onChoose = onChoose;
    }

    getItems() {
        return this.app.vault.getAllLoadedFiles()
            .filter(file => file.children)
            .map(folder => folder.path);
    }

    getItemText(item) {
        return item;
    }

    onChooseItem(item) {
        this.onChoose(item);
    }
}

class FolderImageSetting extends Setting {
    constructor(containerEl, plugin, folderImage, index, onDelete) {
        super(containerEl);
        this.plugin = plugin;
        this.folderImage = folderImage;
        this.index = index;
        this.onDelete = onDelete;

        this.setClass("folder-image-setting");

        this.settingEl.empty();

        const infoEl = this.settingEl.createDiv("setting-item-info");
        infoEl.createDiv("setting-item-name");
        infoEl.createDiv("setting-item-description");

        this.addFolderInput();
        this.addImageInput();        
        this.addPositions();
    }

    addFolderInput() {
        const folderInputContainer = this.settingEl.createDiv('folder-input-container');
        
        const folderInput = new Setting(folderInputContainer)
            .setName("folder path")
            .addText(text => {
                text.setValue(this.folderImage.folder || "")
                    .onChange(async (value) => {
                        this.folderImage.folder = value;
                        await this.plugin.saveSettings();
                    });
                this.folderInputEl = text.inputEl;
                this.folderInputEl.style.width = '300px';
            });

        folderInput.addButton(button => button
            .setButtonText("Browse")
            .onClick(() => {
                new FolderSuggestModal(this.plugin.app, (chosenPath) => {
                    this.folderImage.folder = chosenPath;
                    this.folderInputEl.value = chosenPath;
                    this.plugin.saveSettings();
                }).open();
            }));
    }

    addImageInput() {
        const folderInputContainer = this.settingEl.createDiv('folder-input-container');
        
        const imageInput = new Setting(folderInputContainer)
            .setName("image url or keyword")
            .addText(text => {
                text.setValue(this.folderImage.image || "")
                    .onChange(async (value) => {
                        this.folderImage.image = value;
                        await this.plugin.saveSettings();
                    });
                this.imageInputEl = text.inputEl;
                this.imageInputEl.style.width = '306px';
            });
    }

    addPositions() {
        const controlEl = this.settingEl.createDiv("setting-item-control");
        this.addYPositionInput(controlEl);
        this.addContentStartInput(controlEl);
        this.addDeleteButton(controlEl);
    }

    addYPositionInput(containerEl) {
        const label = containerEl.createEl('label', { text: 'y-position' });
        label.style.fontSize = '12px';
        const slider = containerEl.createEl('input', {
            type: 'range',
            cls: 'slider',
            attr: {
                min: '0',
                max: '100',
                step: '1'
            }
        });
        slider.value = this.folderImage.yPosition || "50";
        slider.style.marginLeft = '20px';
        slider.addEventListener('change', async () => {
            this.folderImage.yPosition = parseInt(slider.value);
            await this.plugin.saveSettings();
        });
        label.appendChild(slider);
    }

    addContentStartInput(containerEl) {
        const label = containerEl.createEl('label', { text: 'content start position' });
        label.style.fontSize = '12px';
        label.style.marginLeft = '25px';

        const contentStartInput = containerEl.createEl('input', {
            type: 'number',
            attr: {
                min: '0'
            }
        });
        contentStartInput.style.width = '50px';
        contentStartInput.style.marginLeft = '20px';
        contentStartInput.value = this.folderImage.contentStartPosition || "150";
        contentStartInput.addEventListener('change', async () => {
            this.folderImage.contentStartPosition = parseInt(contentStartInput.value);
            await this.plugin.saveSettings();
        });

        label.appendChild(contentStartInput);
    }

    addDeleteButton(containerEl) {
        const deleteButton = containerEl.createEl('button');
        deleteButton.style.marginLeft = '20px';
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-trash-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        deleteButton.addEventListener('click', async () => {
            this.plugin.settings.folderImages.splice(this.index, 1);
            await this.plugin.saveSettings();
            this.settingEl.remove();
            if (this.onDelete) {
                this.onDelete();
            }
        });
        deleteButton.addEventListener('mouseover', () => {
            deleteButton.style.color = 'red';
        });
        deleteButton.addEventListener('mouseout', () => {
            deleteButton.style.color = '';
        });
    }
}

class PexelsBannerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.addClass('pexels-banner-settings');

        const mainContent = containerEl.createEl('div', {cls: 'pexels-banner-main-content'});

        // Create tabs
        const { tabsEl, tabContentContainer } = this.createTabs(mainContent, ['API', 'General', 'Folders', 'Examples']);

        // API tab content
        const apiTab = tabContentContainer.createEl('div', {cls: 'tab-content', attr: {'data-tab': 'API'}});
        this.createAPISettings(apiTab);

        // General tab content
        const generalTab = tabContentContainer.createEl('div', {cls: 'tab-content', attr: {'data-tab': 'General'}});
        this.createGeneralSettings(generalTab);

        // Folders tab content
        const foldersTab = tabContentContainer.createEl('div', {cls: 'tab-content', attr: {'data-tab': 'Folders'}});
        this.createFolderSettings(foldersTab);

        // Examples tab content
        const examplesTab = tabContentContainer.createEl('div', {cls: 'tab-content', attr: {'data-tab': 'Examples'}});
        this.createExampleSettings(examplesTab);

        // Activate the first tab
        tabsEl.firstChild.click();
    }

    createTabs(containerEl, tabNames) {
        const tabsEl = containerEl.createEl('div', {cls: 'pexels-banner-settings-tabs'});
        const tabContentContainer = containerEl.createEl('div', {cls: 'pexels-banner-settings-tab-content-container'});

        tabNames.forEach(tabName => {
            const tabEl = tabsEl.createEl('button', {cls: 'pexels-banner-settings-tab', text: tabName});
            tabEl.addEventListener('click', () => {
                // Deactivate all tabs
                tabsEl.querySelectorAll('.pexels-banner-settings-tab').forEach(tab => tab.removeClass('active'));
                tabContentContainer.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

                // Activate clicked tab
                tabEl.addClass('active');
                tabContentContainer.querySelector(`.tab-content[data-tab="${tabName}"]`).style.display = 'block';
            });
        });

        return { tabsEl, tabContentContainer };
    }

    createAPISettings(containerEl) {
        new Setting(containerEl)
            .setName('API key')
            .setDesc('Enter your Pexels API key. This is only required if you want to fetch images from Pexels using keywords. It\'s not needed for using direct URLs or local images.')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Images')
            .setDesc('Configure settings for images fetched from Pexels. These settings apply when using keywords to fetch random images.')
            .setHeading();

        new Setting(containerEl)
            .setName('Size')
            .setDesc('Select the size of the image - (Pexels API only)')
            .addDropdown(dropdown => dropdown
                .addOption('small', 'Small')
                .addOption('medium', 'Medium')
                .addOption('large', 'Large')
                .setValue(this.plugin.settings.imageSize)
                .onChange(async (value) => {
                    this.plugin.settings.imageSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Orientation')
            .setDesc('Select the orientation of the image - (Pexels API only)')
            .addDropdown(dropdown => dropdown
                .addOption('landscape', 'Landscape')
                .addOption('portrait', 'Portrait')
                .addOption('square', 'Square')
                .setValue(this.plugin.settings.imageOrientation)
                .onChange(async (value) => {
                    this.plugin.settings.imageOrientation = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Number of images')
            .setDesc('Enter the number of random images to fetch (1-50) - (Pexels API only)')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(String(this.plugin.settings.numberOfImages || 10))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 50) {
                        this.plugin.settings.numberOfImages = numValue;
                        await this.plugin.saveSettings();
                    }
                }))
            .then(setting => {
                const inputEl = setting.controlEl.querySelector('input');
                inputEl.type = 'number';
                inputEl.min = '1';
                inputEl.max = '50';
                inputEl.style.width = '50px';
            });

        const defaultKeywordsSetting = new Setting(containerEl)
            .setName('Default keywords')
            .setDesc('Enter a comma-separated list of default keywords to be used when no keyword is provided in the frontmatter, or when the provided keyword does not return any results. - (Pexels API only)')
            .addTextArea(text => {
                text
                    .setPlaceholder('Enter keywords, separated by commas')
                    .setValue(this.plugin.settings.defaultKeywords)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultKeywords = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = '100%';
                text.inputEl.style.marginTop = '15px';
                text.inputEl.style.height = '90px';
            })
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.defaultKeywords = DEFAULT_SETTINGS.defaultKeywords;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        defaultKeywordsSetting.settingEl.dataset.id = 'defaultKeywords'; // Add this line
        defaultKeywordsSetting.settingEl.style.display = 'flex';
        defaultKeywordsSetting.settingEl.style.flexDirection = 'column';
    }

    createGeneralSettings(containerEl) {
        new Setting(containerEl)
            .setName('Image Vertical Position')
            .setDesc('Set the vertical position of the image (0-100)')
            .addSlider(slider => slider
                .setLimits(0, 100, 1)
                .setValue(this.plugin.settings.yPosition)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.yPosition = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                })
            );

        new Setting(containerEl)
            .setName('Content Start Position')
            .setDesc('Set the default vertical position where the content starts (in pixels)')
            .addText(text => text
                .setPlaceholder('150')
                .setValue(String(this.plugin.settings.contentStartPosition))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 0) {
                        this.plugin.settings.contentStartPosition = numValue;
                        await this.plugin.saveSettings();
                        this.plugin.updateAllBanners();
                    }
                }))
            .then(setting => {
                const inputEl = setting.controlEl.querySelector('input');
                inputEl.type = 'number';
                inputEl.min = '0';
                inputEl.style.width = '60px';
            });

        new Setting(containerEl)
            .setName('Custom Field Names')
            .setDesc('Customize the frontmatter field names used for the banner and Y-position. This allows you to use different field names in your notes.')
            .setHeading();

        new Setting(containerEl)
            .setName('Banner Field Name')
            .setDesc('Set a custom field name for the banner in frontmatter')
            .addText(text => {
                text
                    .setPlaceholder('pexels-banner')
                    .setValue(this.plugin.settings.customBannerField)
                    .onChange(async (value) => {
                        if (this.validateFieldName(value, this.plugin.settings.customYPositionField) && 
                            this.validateFieldName(value, this.plugin.settings.customContentStartField)) {
                            this.plugin.settings.customBannerField = value;
                            await this.plugin.saveSettings();
                        } else {
                            text.setValue(this.plugin.settings.customBannerField);
                        }
                    });
                text.inputEl.style.width = '220px';
            })
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.customBannerField = DEFAULT_SETTINGS.customBannerField;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        new Setting(containerEl)
            .setName('Y-Position Field Name')
            .setDesc('Set a custom field name for the Y-position in frontmatter')
            .addText(text => {
                text
                    .setPlaceholder('pexels-banner-y-position')
                    .setValue(this.plugin.settings.customYPositionField)
                    .onChange(async (value) => {
                        if (this.validateFieldName(value, this.plugin.settings.customBannerField) && 
                            this.validateFieldName(value, this.plugin.settings.customContentStartField)) {
                            this.plugin.settings.customYPositionField = value;
                            await this.plugin.saveSettings();
                        } else {
                            text.setValue(this.plugin.settings.customYPositionField);
                        }
                    });
                text.inputEl.style.width = '220px';
            })
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.customYPositionField = DEFAULT_SETTINGS.customYPositionField;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        new Setting(containerEl)
            .setName('Content Start Position Field Name')
            .setDesc('Set a custom field name for the content start position in frontmatter')
            .addText(text => {
                text
                    .setPlaceholder('pexels-banner-content-start')
                    .setValue(this.plugin.settings.customContentStartField)
                    .onChange(async (value) => {
                        if (this.validateFieldName(value, this.plugin.settings.customBannerField) && 
                            this.validateFieldName(value, this.plugin.settings.customYPositionField)) {
                            this.plugin.settings.customContentStartField = value;
                            await this.plugin.saveSettings();
                        } else {
                            text.setValue(this.plugin.settings.customContentStartField);
                        }
                    });
                text.inputEl.style.width = '220px';
            })
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.customContentStartField = DEFAULT_SETTINGS.customContentStartField;
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }

    createFolderSettings(containerEl) {
        new Setting(containerEl)
            .setName('Folder Images')
            .setDesc('Set default banner images for specific folders. These will apply to all notes in the folder unless overridden by note-specific settings.')
            .setHeading();

        const folderImagesContainer = containerEl.createDiv('folder-images-container');

        const updateFolderSettings = () => {
            folderImagesContainer.empty();
            this.plugin.settings.folderImages.forEach((folderImage, index) => {
                new FolderImageSetting(folderImagesContainer, this.plugin, folderImage, index, updateFolderSettings);
            });
        };

        updateFolderSettings();

        // Move this button outside of updateFolderSettings
        new Setting(containerEl)
            .addButton(button => button
                .setButtonText("+ Add Folder Image Setting")
                .onClick(async () => {
                    this.plugin.settings.folderImages.push({folder: "", image: "", yPosition: 50, contentStartPosition: 150});
                    await this.plugin.saveSettings();
                    updateFolderSettings();
                }));
    }

    createExampleSettings(containerEl) {
        new Setting(containerEl)
            .setName('How to use')
            .setHeading();

        const instructionsEl = containerEl.createEl('div', {cls: 'pexels-banner-section'});
        instructionsEl.createEl('p', {text: 'Add a "banner" field to your note\'s frontmatter with keywords for the image you want, or a direct URL to an image. You can also specify a custom y-position for the image.'});
        const codeEl = instructionsEl.createEl('pre');
        codeEl.createEl('code', {text: 
`---
banner: blue turtle
banner-y: 30
content-start: 200
---

# Or use a direct URL:
---
banner: https://example.com/image.jpg
banner-y: 70
content-start: 180
---

# Or use a path to an image in the vault:
---
banner: Assets/my-image.png
banner-y: 0
content-start: 100
---

# Or use an Obsidian internal link:
---
banner: [[example-image.png]]
banner-y: 100
content-start: 50
---`
        });

        // Add example image
        containerEl.createEl('img', {
            attr: {
                src: 'https://raw.githubusercontent.com/jparkerweb/pexels-banner/main/example.jpg',
                alt: 'Example of a Pexels banner',
                style: 'max-width: 100%; height: auto; margin-top: 10px; border-radius: 5px;'
            }
        });
    }

    validateFieldName(value, otherFieldName) {
        if (value === otherFieldName) {
            new Notice("Field names must be unique!");
            return false;
        }
        return true;
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export { DEFAULT_SETTINGS, FolderSuggestModal, FolderImageSetting, PexelsBannerSettingTab, debounce };
