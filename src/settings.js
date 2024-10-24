import { PluginSettingTab, Setting, FuzzySuggestModal } from 'obsidian';

const DEFAULT_SETTINGS = {
    apiProvider: 'pexels',
    pexelsApiKey: '',
    pixabayApiKey: '',
    imageSize: 'medium',
    imageOrientation: 'landscape',
    numberOfImages: 10,
    defaultKeywords: 'nature, abstract, landscape, technology, art, cityscape, wildlife, ocean, mountains, forest, space, architecture, food, travel, science, music, sports, fashion, business, education, health, culture, history, weather, transportation, industry, people, animals, plants, patterns',
    yPosition: 50,
    // Update these fields to be arrays
    customBannerField: ['banner'],
    customYPositionField: ['banner-y'],
    customContentStartField: ['content-start'],
    customImageDisplayField: ['banner-display'],
    customImageRepeatField: ['banner-repeat'],
    folderImages: [],
    contentStartPosition: 150,
    imageDisplay: 'cover',
    imageRepeat: false,
    bannerHeight: 350,
    customBannerHeightField: ['banner-height'],
    fade: -75,
    customFadeField: ['banner-fade'],
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

        const folderImageDeleteContainer = this.settingEl.createDiv('folder-image-delete-container');
        this.addDeleteButton(folderImageDeleteContainer);

        const infoEl = this.settingEl.createDiv("setting-item-info");
        infoEl.createDiv("setting-item-name");
        infoEl.createDiv("setting-item-description");

        this.addFolderInput();
        this.addImageInput();
        this.addImageDisplaySettings();
        this.addYPostionAndContentStart();
        this.addFadeAndBannerHeight();
        this.addDirectChildrenOnlyToggle(); // Add this line
    }

    addDeleteButton(containerEl) {
        const deleteButton = containerEl.createEl('button');
        deleteButton.style.marginLeft = '20px';
        deleteButton.style.width = '30px';
        deleteButton.style.height = '30px';
        deleteButton.style.padding = '0';
        deleteButton.style.border = '1px solid #80000030';
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-trash-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
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

    addImageDisplaySettings(containerEl) {
        const displayContainer = this.settingEl.createDiv('display-and-repeat-container');
        
        const displaySetting = new Setting(displayContainer)
            .setName("image display")
            .addDropdown(dropdown => {
                dropdown
                    .addOption('auto', 'Auto')
                    .addOption('cover', 'Cover')
                    .addOption('contain', 'Contain')
                    .setValue(this.folderImage.imageDisplay || 'cover')
                    .onChange(async (value) => {
                        this.folderImage.imageDisplay = value;
                        await this.plugin.saveSettings();
                    });
                dropdown.selectEl.style.marginRight = '20px';
            });

        const repeatSetting = new Setting(displayContainer)
            .setName("repeat")
            .addToggle(toggle => {
                toggle
                    .setValue(this.folderImage.imageRepeat || false)
                    .onChange(async (value) => {
                        this.folderImage.imageRepeat = value;
                        await this.plugin.saveSettings();
                    });
            });

        const toggleEl = repeatSetting.controlEl.querySelector('.checkbox-container');
        if (toggleEl) toggleEl.style.justifyContent = 'flex-start';
    }

    addYPostionAndContentStart() {
        const controlEl = this.settingEl.createDiv("setting-item-control full-width-control");
        this.addYPositionInput(controlEl);
        this.addContentStartInput(controlEl);
    }
    addFadeAndBannerHeight() {
        const controlEl = this.settingEl.createDiv("setting-item-control full-width-control");
        this.addFadeInput(controlEl);
        this.addBannerHeightInput(controlEl);
    }

    addYPositionInput(containerEl) {
        const label = containerEl.createEl('label', { text: 'y-position', cls: 'setting-item-name__label' });
        const sliderContainer = containerEl.createEl('div', { cls: 'slider-container' });
        const slider = sliderContainer.createEl('input', {
            type: 'range',
            cls: 'slider',
            attr: {
                min: '0',
                max: '100',
                step: '1'
            }
        });
        slider.value = this.folderImage.yPosition || "50";
        slider.style.width = '100px';
        slider.style.marginLeft = '10px';
        
        const valueDisplay = sliderContainer.createEl('div', { cls: 'slider-value' });
        valueDisplay.style.marginLeft = '10px';
        
        const updateValueDisplay = (value) => {
            valueDisplay.textContent = value;
        };
        
        updateValueDisplay(slider.value);
        
        slider.addEventListener('input', (event) => {
            updateValueDisplay(event.target.value);
        });

        slider.addEventListener('change', async () => {
            this.folderImage.yPosition = parseInt(slider.value);
            await this.plugin.saveSettings();
        });
        
        label.appendChild(sliderContainer);
        containerEl.appendChild(label);
    }

    addContentStartInput(containerEl) {
        const label = containerEl.createEl('label', { text: 'content start', cls: 'setting-item-name__label' });
        label.style.marginLeft = '20px';

        const contentStartInput = containerEl.createEl('input', {
            type: 'number',
            attr: {
                min: '0'
            }
        });
        contentStartInput.style.width = '50px';
        contentStartInput.style.marginLeft = '10px';
        contentStartInput.value = this.folderImage.contentStartPosition || "150";
        contentStartInput.addEventListener('change', async () => {
            this.folderImage.contentStartPosition = parseInt(contentStartInput.value);
            await this.plugin.saveSettings();
        });

        label.appendChild(contentStartInput);
        containerEl.appendChild(label);
    }

    addBannerHeightInput(containerEl) {
        const label = containerEl.createEl('label', { text: 'banner height', cls: 'setting-item-name__label' });
        label.style.marginLeft = '20px';
        const heightInput = containerEl.createEl('input', {
            type: 'number',
            attr: {
                min: '100',
                max: '2500'
            }
        });
        heightInput.style.width = '50px';
        heightInput.style.marginLeft = '10px';
        heightInput.value = this.folderImage.bannerHeight || "";
        heightInput.placeholder = String(this.plugin.settings.bannerHeight || 350);
        heightInput.addEventListener('change', async () => {
            let value = heightInput.value ? parseInt(heightInput.value) : null;
            if (value !== null) {
                value = Math.max(100, Math.min(2500, value));
                this.folderImage.bannerHeight = value;
                heightInput.value = value;
            } else {
                delete this.folderImage.bannerHeight;
                heightInput.value = "";
            }
            await this.plugin.saveSettings();
        });

        label.appendChild(heightInput);
        containerEl.appendChild(label);
    }

    addFadeInput(containerEl) {
        const label = containerEl.createEl('label', { text: 'fade', cls: 'setting-item-name__label' });
        const sliderContainer = containerEl.createEl('div', { cls: 'slider-container' });
        const slider = sliderContainer.createEl('input', {
            type: 'range',
            cls: 'slider',
            attr: {
                min: '-1500',
                max: '100',
                step: '5'
            }
        });
        slider.value = this.folderImage.fade !== undefined ? this.folderImage.fade : "-75";
        slider.style.width = '100px';
        slider.style.marginLeft = '10px';
        
        const valueDisplay = sliderContainer.createEl('div', { cls: 'slider-value' });
        valueDisplay.style.marginLeft = '10px';
        
        const updateValueDisplay = (value) => {
            valueDisplay.textContent = value;
        };
        
        updateValueDisplay(slider.value);
        
        slider.addEventListener('input', (event) => {
            updateValueDisplay(event.target.value);
        });

        slider.addEventListener('change', async () => {
            this.folderImage.fade = parseInt(slider.value);
            await this.plugin.saveSettings();
        });
        
        label.appendChild(sliderContainer);
        containerEl.appendChild(label);
    }

    // Add this method
    addDirectChildrenOnlyToggle() {
        new Setting(this.settingEl)
            .setName("Direct Children Only")
            .setDesc("Apply banner only to direct children of the folder")
            .addToggle(toggle => {
                toggle
                    .setValue(this.folderImage.directChildrenOnly || false)
                    .onChange(async (value) => {
                        this.folderImage.directChildrenOnly = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}

// Helper functions
function arrayToString(arr) {
    return Array.isArray(arr) ? arr.join(', ') : arr;
}

function stringToArray(str) {
    return str.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function validateFieldNames(settings, allFields, currentField, newNames) {
    // Check for valid characters in field names (alphanumeric, dashes, underscores only)
    const validNamePattern = /^[a-zA-Z0-9_-]+$/;
    const invalidNames = newNames.filter(name => !validNamePattern.test(name));
    if (invalidNames.length > 0) {
        return {
            isValid: false,
            message: `Invalid characters in field names (only letters, numbers, dashes, and underscores allowed): ${invalidNames.join(', ')}`
        };
    }

    // Then check for duplicates
    const otherFields = allFields.filter(f => f !== currentField);
    const otherFieldNames = otherFields.flatMap(f => settings[f]);
    const duplicates = newNames.filter(name => otherFieldNames.includes(name));
    
    if (duplicates.length > 0) {
        return {
            isValid: false,
            message: `Duplicate field names found: ${duplicates.join(', ')}`
        };
    }
    
    return { isValid: true };
}

function migrateSettings(settings) {
    const fieldsToMigrate = [
        'customBannerField',
        'customYPositionField',
        'customContentStartField',
        'customImageDisplayField',
        'customImageRepeatField'
    ];

    fieldsToMigrate.forEach(field => {
        if (typeof settings[field] === 'string') {
            settings[field] = [settings[field]];
        }
    });

    return settings;
}

class PixelBannerPlugin extends Plugin {
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.settings = migrateSettings(this.settings);
        
        if (!Array.isArray(this.settings.folderImages)) {
            this.settings.folderImages = [];
        }

        if (this.settings.folderImages) {
            this.settings.folderImages.forEach(folderImage => {
                folderImage.imageDisplay = folderImage.imageDisplay || 'cover';
                folderImage.imageRepeat = folderImage.imageRepeat || false;
            });
        }
    }
    // ... rest of the plugin class
}

class PixelBannerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('pixel-banner-settings');

        const mainContent = containerEl.createEl('div', { cls: 'pixel-banner-main-content' });

        // Create tabs
        const { tabsEl, tabContentContainer } = this.createTabs(mainContent, ['API Settings', 'General', 'Custom Field Names', 'Folder Images', 'Examples']);

        // API Settings tab content
        const apiTab = tabContentContainer.createEl('div', { cls: 'tab-content', attr: { 'data-tab': 'API Settings' } });
        this.createAPISettings(apiTab);

        // General tab content
        const generalTab = tabContentContainer.createEl('div', { cls: 'tab-content', attr: { 'data-tab': 'General' } });
        this.createGeneralSettings(generalTab);

        // Custom Fields tab content
        const customFieldsTab = tabContentContainer.createEl('div', { cls: 'tab-content', attr: { 'data-tab': 'Custom Field Names' } });
        this.createCustomFieldsSettings(customFieldsTab);

        // Folder Images tab content
        const foldersTab = tabContentContainer.createEl('div', { cls: 'tab-content', attr: { 'data-tab': 'Folder Images' } });
        this.createFolderSettings(foldersTab);

        // Examples tab content
        const examplesTab = tabContentContainer.createEl('div', { cls: 'tab-content', attr: { 'data-tab': 'Examples' } });
        this.createExampleSettings(examplesTab);

        // Activate the first tab
        tabsEl.firstChild.click();
    }

    createTabs(containerEl, tabNames) {
        const tabsEl = containerEl.createEl('div', { cls: 'pixel-banner-settings-tabs' });
        const tabContentContainer = containerEl.createEl('div', { cls: 'pixel-banner-settings-tab-content-container' });

        tabNames.forEach(tabName => {
            const tabEl = tabsEl.createEl('button', { cls: 'pixel-banner-settings-tab', text: tabName });
            tabEl.addEventListener('click', () => {
                // Deactivate all tabs
                tabsEl.querySelectorAll('.pixel-banner-settings-tab').forEach(tab => tab.removeClass('active'));
                tabContentContainer.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

                // Activate clicked tab
                tabEl.addClass('active');
                tabContentContainer.querySelector(`.tab-content[data-tab="${tabName}"]`).style.display = 'block';
            });
        });

        return { tabsEl, tabContentContainer };
    }

    createAPISettings(containerEl) {
        // section callout
        const calloutEl = containerEl.createEl('div', { cls: 'callout' });
        calloutEl.createEl('p', { text: 'Optionally select which API provider to use for fetching images. See the Examples tab for more information on referencing images by URL or local image. You can use any combination of API keyword, URL, or local image between notes.' });
        calloutEl.style.backgroundColor = 'var(--background-primary-alt)';
        calloutEl.style.border = '1px solid var(--background-modifier-border)';
        calloutEl.style.color = 'var(--text-accent)';
        calloutEl.style.fontSize = '0.9em';
        calloutEl.style.borderRadius = '5px';
        calloutEl.style.padding = '0 25px';
        calloutEl.style.marginBottom = '20px';

        // Add API provider radio buttons
        new Setting(containerEl)
            .setName('API Provider')
            .setDesc('Select the API provider for fetching images')
            .addDropdown(dropdown => dropdown
                .addOption('pexels', 'Pexels')
                .addOption('pixabay', 'Pixabay')
                .setValue(this.plugin.settings.apiProvider)
                .onChange(async (value) => {
                    this.plugin.settings.apiProvider = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the settings tab to update API key fields
                }));

        // Pexels API key
        new Setting(containerEl)
            .setName('Pexels API Key');
        containerEl.createEl('span', { text: 'Enter your Pexels API key. Get your API key from ', cls: 'setting-item-description' })
            .createEl('a', { href: 'https://www.pexels.com/api/', text: 'Pexels API' });
        const pexelsApiKeySetting = new Setting(containerEl)
            .addText(text => {
                text
                    .setPlaceholder('Pexels API key')
                    .setValue(this.plugin.settings.pexelsApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.pexelsApiKey = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = '100%';
            });
        pexelsApiKeySetting.settingEl.addClass('full-width-control');

        // Pixabay API key
        new Setting(containerEl)
            .setName('Pixabay API Key');
        containerEl.createEl('span', { text: 'Enter your Pixabay API key. Get your API key from ', cls: 'setting-item-description' })
            .createEl('a', { href: 'https://pixabay.com/api/docs/', text: 'Pixabay API' });
        const pixabayApiKeySetting = new Setting(containerEl)
            .addText(text => {
                text
                    .setPlaceholder('Pixabay API key')
                    .setValue(this.plugin.settings.pixabayApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.pixabayApiKey = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = '100%';
            });
        pixabayApiKeySetting.settingEl.addClass('full-width-control');

        new Setting(containerEl)
            .setName('Images')
            .setDesc('Configure settings for images fetched from API. These settings apply when using keywords to fetch random images.')
            .setHeading();

        new Setting(containerEl)
            .setName('Size')
            .setDesc('Select the size of the image - (API only)')
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
            .setDesc('Select the orientation of the image - (API only)')
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
            .setDesc('Enter the number of random images to fetch (3-50) - (API only)')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(String(this.plugin.settings.numberOfImages || 10))
                .onChange(async (value) => {
                    let numValue = Number(value);
                    if (!isNaN(numValue)) {
                        numValue = Math.max(3, Math.min(numValue, 50)); // Ensure value is between 3 and 50
                        this.plugin.settings.numberOfImages = numValue;
                        await this.plugin.saveSettings();
                    }
                }))
            .then(setting => {
                const inputEl = setting.controlEl.querySelector('input');
                inputEl.type = 'number';
                inputEl.min = '3'; // Set minimum to 3
                inputEl.max = '50';
                inputEl.style.width = '50px';
            });

        const defaultKeywordsSetting = new Setting(containerEl)
            .setName('Default keywords')
            .setDesc('Enter a comma-separated list of default keywords to be used when no keyword is provided in the frontmatter, or when the provided keyword does not return any results. - (API only)')
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

        defaultKeywordsSetting.settingEl.dataset.id = 'defaultKeywords';
        defaultKeywordsSetting.settingEl.style.display = 'flex';
        defaultKeywordsSetting.settingEl.style.flexDirection = 'column';
    }

    createGeneralSettings(containerEl) {
        // section callout
        const calloutEl = containerEl.createEl('div', { cls: 'callout' });
        calloutEl.createEl('p', { text: 'Set the default vertical position of the image, how it should be displayed, and where the content should start. These are global settings and apply to all notes with banners unless overridden by folder or note-specific settings.' });
        calloutEl.style.backgroundColor = 'var(--background-primary-alt)';
        calloutEl.style.border = '1px solid var(--background-modifier-border)';
        calloutEl.style.color = 'var(--text-accent)';
        calloutEl.style.fontSize = '0.9em';
        calloutEl.style.borderRadius = '5px';
        calloutEl.style.padding = '0 25px';
        calloutEl.style.marginBottom = '20px';

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
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.yPosition = DEFAULT_SETTINGS.yPosition;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                    // Update the slider value
                    const sliderEl = button.extraSettingsEl.parentElement.querySelector('.slider');
                    sliderEl.value = DEFAULT_SETTINGS.yPosition;
                    sliderEl.dispatchEvent(new Event('input'));
                }));

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
            })
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.contentStartPosition = DEFAULT_SETTINGS.contentStartPosition;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                    // Update the input value
                    const inputEl = button.extraSettingsEl.parentElement.querySelector('input');
                    inputEl.value = DEFAULT_SETTINGS.contentStartPosition;
                    inputEl.dispatchEvent(new Event('input'));
                }));

        new Setting(containerEl)
            .setName('Image Display')
            .setDesc('Set how the banner image should be displayed')
            .addDropdown(dropdown => dropdown
                .addOption('auto', 'Auto')
                .addOption('cover', 'Cover')
                .addOption('contain', 'Contain')
                .setValue(this.plugin.settings.imageDisplay || 'cover')
                .onChange(async (value) => {
                    this.plugin.settings.imageDisplay = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.imageDisplay = DEFAULT_SETTINGS.imageDisplay;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                    // Update the dropdown value
                    const dropdownEl = button.extraSettingsEl.parentElement.querySelector('select');
                    dropdownEl.value = DEFAULT_SETTINGS.imageDisplay;
                    dropdownEl.dispatchEvent(new Event('change'));
                }));

        new Setting(containerEl)
            .setName('Image Repeat')
            .setDesc('Enable image repetition when "Contain" is selected')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.imageRepeat)
                .onChange(async (value) => {
                    this.plugin.settings.imageRepeat = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    // Update the plugin setting
                    this.plugin.settings.imageRepeat = DEFAULT_SETTINGS.imageRepeat;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();

                    // Update the toggle state
                    const checkboxContainer = button.extraSettingsEl.parentElement.querySelector('.checkbox-container');
                    const toggleEl = checkboxContainer.querySelector('input');
                    if (toggleEl) {
                        toggleEl.checked = DEFAULT_SETTINGS.imageRepeat;
                        // Update the container class
                        checkboxContainer.classList.toggle('is-enabled', DEFAULT_SETTINGS.imageRepeat);
                        // Trigger the change event to ensure the onChange handler runs
                        const event = new Event('change', { bubbles: true });
                        toggleEl.dispatchEvent(event);
                    }
                }));

        new Setting(containerEl)
            .setName('Banner Height')
            .setDesc('Set the default height of the banner image (100-2500 pixels)')
            .addText(text => {
                text.setPlaceholder('350')
                    .setValue(String(this.plugin.settings.bannerHeight))
                    .onChange(async (value) => {
                        // Allow any input, including empty string
                        if (value === '' || !isNaN(Number(value))) {
                            await this.plugin.saveSettings();
                        }
                    });
                
                // Add event listener for 'blur' event
                text.inputEl.addEventListener('blur', async (event) => {
                    let numValue = Number(event.target.value);
                    if (isNaN(numValue) || event.target.value === '') {
                        // If the value is not a number or is empty, set to default
                        numValue = 350;
                    } else {
                        // Ensure value is between 100 and 2500
                        numValue = Math.max(100, Math.min(2500, numValue));
                    }
                    this.plugin.settings.bannerHeight = numValue;
                    text.setValue(String(numValue));
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                });

                text.inputEl.type = 'number';
                text.inputEl.min = '100';
                text.inputEl.max = '2500';
                text.inputEl.style.width = '50px';
            })
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.bannerHeight = DEFAULT_SETTINGS.bannerHeight;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                    // Update the input value
                    const inputEl = button.extraSettingsEl.parentElement.querySelector('input');
                    inputEl.value = DEFAULT_SETTINGS.bannerHeight;
                    inputEl.dispatchEvent(new Event('input'));
                }));

        new Setting(containerEl)
            .setName('Banner Fade')
            .setDesc('Set the default fade effect for the banner image (-1500 to 100)')
            .addSlider(slider => slider
                .setLimits(-1500, 100, 5)
                .setValue(this.plugin.settings.fade)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fade = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.fade = DEFAULT_SETTINGS.fade;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllBanners();
                    // Update the slider value
                    const sliderEl = button.extraSettingsEl.parentElement.querySelector('.slider');
                    sliderEl.value = DEFAULT_SETTINGS.fade;
                    sliderEl.dispatchEvent(new Event('input'));
                }));
    }

    createCustomFieldsSettings(containerEl) {
        // section callout
        const calloutEl = containerEl.createEl('div', { cls: 'callout' });
        calloutEl.createEl('p', { text: 'Customize the frontmatter field names used for the banner and Y-position. You can define multiple names for each field, separated by commas. Field names can only contain letters, numbers, dashes, and underscores. Example: "banner, pixel-banner, header_image" could all be used as the banner field name.' });
        calloutEl.style.backgroundColor = 'var(--background-primary-alt)';
        calloutEl.style.border = '1px solid var(--background-modifier-border)';
        calloutEl.style.color = 'var(--text-accent)';
        calloutEl.style.fontSize = '0.9em';
        calloutEl.style.borderRadius = '5px';
        calloutEl.style.padding = '0 25px';
        calloutEl.style.marginBottom = '20px';

        const customFields = [
            {
                setting: 'customBannerField',
                name: 'Banner Field Names',
                desc: 'Set custom field names for the banner in frontmatter (comma-separated)',
                placeholder: 'banner, pixel-banner, header-image'
            },
            {
                setting: 'customYPositionField',
                name: 'Y-Position Field Names',
                desc: 'Set custom field names for the Y-position in frontmatter (comma-separated)',
                placeholder: 'banner-y, y-position, banner-offset'
            },
            {
                setting: 'customContentStartField',
                name: 'Content Start Position Field Names',
                desc: 'Set custom field names for the content start position in frontmatter (comma-separated)',
                placeholder: 'content-start, start-position, content-offset'
            },
            {
                setting: 'customImageDisplayField',
                name: 'Image Display Field Names',
                desc: 'Set custom field names for the image display in frontmatter (comma-separated)',
                placeholder: 'banner-display, image-display, display-mode'
            },
            {
                setting: 'customImageRepeatField',
                name: 'Image Repeat Field Names',
                desc: 'Set custom field names for the image repeat in frontmatter (comma-separated)',
                placeholder: 'banner-repeat, image-repeat, repeat-image'
            },
            {
                setting: 'customBannerHeightField',
                name: 'Banner Height Field Names',
                desc: 'Set custom field names for the banner height in frontmatter (comma-separated)',
                placeholder: 'banner-height, image-height, header-height'
            },
            {
                setting: 'customFadeField',
                name: 'Fade Field Names',
                desc: 'Set custom field names for the fade effect in frontmatter (comma-separated)',
                placeholder: 'banner-fade, fade-effect, image-fade'
            }
        ];

        customFields.forEach(field => {
            new Setting(containerEl)
                .setName(field.name)
                .setDesc(field.desc)
                .addText(text => {
                    text
                        .setPlaceholder(field.placeholder)
                        .setValue(arrayToString(this.plugin.settings[field.setting]))
                        .onChange(async (value) => {
                            const newNames = stringToArray(value);
                            const validation = validateFieldNames(
                                this.plugin.settings,
                                customFields.map(f => f.setting),
                                field.setting,
                                newNames
                            );

                            if (validation.isValid) {
                                this.plugin.settings[field.setting] = newNames;
                                await this.plugin.saveSettings();
                            } else {
                                new Notice(validation.message);
                                text.setValue(arrayToString(this.plugin.settings[field.setting]));
                            }
                        });
                    text.inputEl.style.width = '220px';
                })
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip('Reset to default')
                    .onClick(async () => {
                        this.plugin.settings[field.setting] = DEFAULT_SETTINGS[field.setting];
                        await this.plugin.saveSettings();
                        
                        // Update only this specific setting
                        const settingEl = button.extraSettingsEl.parentElement;
                        const textInput = settingEl.querySelector('input[type="text"]');
                        textInput.value = arrayToString(DEFAULT_SETTINGS[field.setting]);
                        
                        // Trigger the change event to update the plugin's state
                        const event = new Event('input', { bubbles: true, cancelable: true });
                        textInput.dispatchEvent(event);
                    }));
        });
    }

    createFolderSettings(containerEl) {
        // section callout
        const calloutEl = containerEl.createEl('div', { cls: 'callout' });
        calloutEl.createEl('p', { text: 'Set default banner images for specific folders. These will apply to all notes in the folder unless overridden by note-specific settings.' });
        calloutEl.style.backgroundColor = 'var(--background-primary-alt)';
        calloutEl.style.border = '1px solid var(--background-modifier-border)';
        calloutEl.style.color = 'var(--text-accent)';
        calloutEl.style.fontSize = '0.9em';
        calloutEl.style.borderRadius = '5px';
        calloutEl.style.padding = '0 25px';
        calloutEl.style.marginBottom = '20px';

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
                    this.plugin.settings.folderImages.push({ folder: "", image: "", yPosition: 50, contentStartPosition: 150 });
                    await this.plugin.saveSettings();
                    updateFolderSettings();
                }));
    }

    createExampleSettings(containerEl) {
        new Setting(containerEl)
            .setName('How to use')
            .setHeading();

        // Helper function to get a random item from an array
        const getRandomFieldName = (fieldNames) => {
            const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
            return names[Math.floor(Math.random() * names.length)];
        };

        const instructionsEl = containerEl.createEl('div', { cls: 'pixel-banner-section' });
        instructionsEl.createEl('p', { text: 'Add the following fields to your note\'s frontmatter to customize the banner:' });
        const codeEl = instructionsEl.createEl('pre');
        codeEl.createEl('code', { text: 
`---
${getRandomFieldName(this.plugin.settings.customBannerField)}: blue turtle
${getRandomFieldName(this.plugin.settings.customYPositionField)}: 30
${getRandomFieldName(this.plugin.settings.customContentStartField)}: 200
${getRandomFieldName(this.plugin.settings.customImageDisplayField)}: contain
${getRandomFieldName(this.plugin.settings.customImageRepeatField)}: true
${getRandomFieldName(this.plugin.settings.customBannerHeightField)}: 400
${getRandomFieldName(this.plugin.settings.customFadeField)}: -75
---

# Or use a direct URL:
---
${getRandomFieldName(this.plugin.settings.customBannerField)}: https://example.com/image.jpg
${getRandomFieldName(this.plugin.settings.customYPositionField)}: 70
${getRandomFieldName(this.plugin.settings.customContentStartField)}: 180
${getRandomFieldName(this.plugin.settings.customImageDisplayField)}: cover
${getRandomFieldName(this.plugin.settings.customBannerHeightField)}: 300
${getRandomFieldName(this.plugin.settings.customFadeField)}: -75
---

# Or use a path to an image in the vault:
---
${getRandomFieldName(this.plugin.settings.customBannerField)}: Assets/my-image.png
${getRandomFieldName(this.plugin.settings.customYPositionField)}: 0
${getRandomFieldName(this.plugin.settings.customContentStartField)}: 100
${getRandomFieldName(this.plugin.settings.customImageDisplayField)}: auto
${getRandomFieldName(this.plugin.settings.customBannerHeightField)}: 250
${getRandomFieldName(this.plugin.settings.customFadeField)}: -75
---

# Or use an Obsidian internal link:
---
${getRandomFieldName(this.plugin.settings.customBannerField)}: [[example-image.png]]
${getRandomFieldName(this.plugin.settings.customYPositionField)}: 100
${getRandomFieldName(this.plugin.settings.customContentStartField)}: 50
${getRandomFieldName(this.plugin.settings.customImageDisplayField)}: contain
${getRandomFieldName(this.plugin.settings.customImageRepeatField)}: false
${getRandomFieldName(this.plugin.settings.customBannerHeightField)}: 500
${getRandomFieldName(this.plugin.settings.customFadeField)}: -75
---`
        });

        instructionsEl.createEl('p', { text: 'Note: The image display options are "auto", "cover", or "contain". The image repeat option is only applicable when the display is set to "contain".' });

        // Add example image
        containerEl.createEl('img', {
            attr: {
                src: 'https://raw.githubusercontent.com/jparkerweb/pixel-banner/main/example.jpg',
                alt: 'Example of a Pixel banner',
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

export { DEFAULT_SETTINGS, FolderSuggestModal, FolderImageSetting, PixelBannerSettingTab, debounce };
