const { Plugin, PluginSettingTab, Setting, requestUrl, FuzzySuggestModal } = require('obsidian');

const DEFAULT_SETTINGS = {
    apiKey: '',
    imageSize: 'medium',
    imageOrientation: 'landscape',
    numberOfImages: 10,
    defaultKeywords: 'nature, abstract, landscape, technology, art, cityscape, wildlife, ocean, mountains, forest, space, architecture, food, travel, science, music, sports, fashion, business, education, health, culture, history, weather, transportation, industry, people, animals, plants, patterns',
    yPosition: 50,
    customBannerField: 'pexels-banner',
    customYPositionField: 'pexels-banner-y-position',
    folderImages: [] // Add this new field
};

class FolderSuggestModal extends FuzzySuggestModal {
    constructor(app, onChoose) {
        super(app);
        this.onChoose = onChoose;
    }

    getItems() {
        return this.app.vault.getAllLoadedFiles()
            .filter(file => file.children) // Filter for folders
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
    constructor(containerEl, plugin, folderImage, index) {
        super(containerEl);
        this.plugin = plugin;
        this.folderImage = folderImage;
        this.index = index;

        this.setClass("folder-image-setting");

        this.settingEl.empty();

        const infoEl = this.settingEl.createDiv("setting-item-info");
        infoEl.createDiv("setting-item-name");
        infoEl.createDiv("setting-item-description");

        this.addFolderInput();
        
        const controlEl = this.settingEl.createDiv("setting-item-control");
        this.addImageInput(controlEl);
        this.addYPositionInput(controlEl);
        this.addDeleteButton(controlEl);
    }

    addFolderInput() {
        const folderInputContainer = this.settingEl.createDiv('folder-input-container');
        
        const folderInput = new Setting(folderInputContainer)
            .setName("Folder path")
            .addText(text => {
                text.setPlaceholder("Folder path")
                    .setValue(this.folderImage.folder || "")
                    .onChange(async (value) => {
                        this.folderImage.folder = value;
                        await this.plugin.saveSettings();
                    });
                this.folderInputEl = text.inputEl;
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

    addImageInput(containerEl) {
        const imageInput = containerEl.createEl('input', {
            type: 'text',
            attr: {
                spellcheck: 'false',
                placeholder: 'Image URL or keyword'
            }
        });
        imageInput.value = this.folderImage.image || "";
        imageInput.addEventListener('change', async () => {
            this.folderImage.image = imageInput.value;
            await this.plugin.saveSettings();
        });
    }

    addYPositionInput(containerEl) {
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
        slider.addEventListener('change', async () => {
            this.folderImage.yPosition = parseInt(slider.value);
            await this.plugin.saveSettings();
        });
    }

    addDeleteButton(containerEl) {
        const deleteButton = containerEl.createEl('button');
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-trash-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        deleteButton.addEventListener('click', async () => {
            this.plugin.settings.folderImages.splice(this.index, 1);
            await this.plugin.saveSettings();
            this.settingEl.remove();
        });
    }
}

module.exports = class PexelsBannerPlugin extends Plugin {
    debounceTimer = null;
    loadedImages = new Map();
    lastKeywords = new Map();
    imageCache = new Map();
    rateLimiter = {
        lastRequestTime: 0,
        minInterval: 1000 // 1 second between requests
    };
    lastYPositions = new Map();

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new PexelsBannerSettingTab(this.app, this));
        
        // Register events
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf) {
                    this.handleActiveLeafChange(leaf);
                }
            })
        );

        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                this.debouncedHandleMetadataChange(file);
            })
        );

        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.handleLayoutChange();
            })
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        
        // Ensure folderImages is always an array
        if (!Array.isArray(this.settings.folderImages)) {
            this.settings.folderImages = [];
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Clear the image cache when settings are saved
        this.loadedImages.clear();
        this.lastKeywords.clear();
        this.imageCache.clear();
        // Trigger an update for the active leaf
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view.getViewType() === "markdown") {
            await this.updateBanner(activeLeaf.view, true);
        }
    }

    async handleActiveLeafChange(leaf) {
        const view = leaf.view;
        if (view.getViewType() === "markdown") {
            await this.updateBanner(view, false);
            
            // Update embedded notes
            const embeddedNotes = view.contentEl.querySelectorAll('.internal-embed');
            for (const embed of embeddedNotes) {
                const embedFile = this.app.metadataCache.getFirstLinkpathDest(embed.getAttribute('src'), '');
                if (embedFile) {
                    const embedView = {
                        file: embedFile,
                        contentEl: embed
                    };
                    await this.updateBanner(embedView, false);
                }
            }
        }
    }

    getFolderSpecificImage(filePath) {
        const folderPath = this.getFolderPath(filePath);
        for (const folderImage of this.settings.folderImages) {
            if (folderPath.startsWith(folderImage.folder)) {
                return {
                    image: folderImage.image,
                    yPosition: folderImage.yPosition
                };
            }
        }
        return null;
    }

    getFolderPath(filePath) {
        const lastSlashIndex = filePath.lastIndexOf('/');
        return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
    }

    debouncedHandleMetadataChange(file) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.handleMetadataChange(file);
        }, 500);
    }

    async handleMetadataChange(file) {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view.file === file) {
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            const customBannerField = this.settings.customBannerField;
            const customYPositionField = this.settings.customYPositionField;
            const newKeyword = frontmatter && frontmatter[customBannerField];
            const newYPosition = frontmatter && (frontmatter[customYPositionField] || frontmatter['pexels-banner-y']);
            const oldKeyword = this.lastKeywords.get(file.path);
            const oldYPosition = this.lastYPositions.get(file.path);

            if (newKeyword !== oldKeyword || newYPosition !== oldYPosition) {
                await this.updateBanner(activeLeaf.view, true);
            }
        }
    }

    async handleLayoutChange() {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view.getViewType() === "markdown") {
            await this.updateBanner(activeLeaf.view, true);  // Set isContentChange to true
        }
    }

    async updateBanner(view, isContentChange) {
        const frontmatter = this.app.metadataCache.getFileCache(view.file)?.frontmatter;
        const contentEl = view.contentEl;
        const customBannerField = this.settings.customBannerField;
        const customYPositionField = this.settings.customYPositionField;
        const customYPosition = frontmatter && (frontmatter[customYPositionField] || frontmatter['pexels-banner-y']);
        
        let yPosition = customYPosition !== undefined ? customYPosition : this.settings.yPosition;
        let bannerImage = frontmatter && frontmatter[customBannerField];

        // Check for folder-specific image if no frontmatter image is specified
        if (!bannerImage) {
            const folderSpecific = this.getFolderSpecificImage(view.file.path);
            if (folderSpecific) {
                bannerImage = folderSpecific.image;
                yPosition = customYPosition !== undefined ? customYPosition : folderSpecific.yPosition;
            }
        }
        
        // Clear the cached image for this file to force a reload
        if (isContentChange) {
            this.loadedImages.delete(view.file.path);
            this.lastKeywords.delete(view.file.path);
        }
        
        // Always call addPexelsBanner, even if bannerImage is undefined
        await this.addPexelsBanner(contentEl, { 
            frontmatter, 
            file: view.file, 
            isContentChange,
            yPosition,
            customBannerField,
            customYPositionField,
            bannerImage
        });

        // Update the lastYPositions Map
        this.lastYPositions.set(view.file.path, yPosition);

        // Handle embedded notes
        const embeddedNotes = contentEl.querySelectorAll('.internal-embed');
        for (const embed of embeddedNotes) {
            const embedFile = this.app.metadataCache.getFirstLinkpathDest(embed.getAttribute('src'), '');
            if (embedFile) {
                const embedView = {
                    file: embedFile,
                    contentEl: embed
                };
                await this.updateBanner(embedView, isContentChange);
            }
        }
    }

    async addPexelsBanner(el, ctx) {
        const { frontmatter, file, isContentChange, yPosition, customBannerField, customYPositionField, bannerImage } = ctx;
        
        // Remove all existing banners within this element
        const existingBanners = el.querySelectorAll('.pexels-banner-image');
        existingBanners.forEach(banner => banner.remove());
        
        if (bannerImage) {
            let input = bannerImage;
            
            // Handle the case where input is an array of arrays
            if (Array.isArray(input)) {
                // Reconstruct the Obsidian link format
                input = `[[${input.flat(Infinity).join('')}]]`;
            }

            const inputType = this.getInputType(input);
            let imageUrl = this.loadedImages.get(file.path);
            const lastInput = this.lastKeywords.get(file.path);

            if (!imageUrl || (isContentChange && input !== lastInput)) {
                if (inputType === 'url') {
                    imageUrl = input;
                } else if (inputType === 'vaultPath') {
                    imageUrl = await this.getVaultImageUrl(input);
                } else if (inputType === 'obsidianLink') {
                    const resolvedFile = this.getPathFromObsidianLink(input);
                    if (resolvedFile) {
                        imageUrl = await this.getVaultImageUrl(resolvedFile.path);
                    }
                } else if (inputType === 'keyword') {
                    imageUrl = await this.fetchPexelsImage(input);
                } else {
                    return; // Exit the function if input is invalid
                }
                if (imageUrl) {
                    this.loadedImages.set(file.path, imageUrl);
                    this.lastKeywords.set(file.path, input);
                }
            }

            // Create the banner div
            const bannerDiv = createDiv({ cls: 'pexels-banner-image' });
            bannerDiv.style.backgroundImage = `url('${imageUrl}')`;
            bannerDiv.style.backgroundPosition = `center ${yPosition}%`;

            // Find the appropriate parent element and insert the banner
            if (el.classList.contains('markdown-source-view')) {
                const cmSizer = el.querySelector('.cm-sizer');
                if (cmSizer) {
                    cmSizer.prepend(bannerDiv);
                } else {
                    el.prepend(bannerDiv);
                }
            } else if (el.classList.contains('markdown-reading-view')) {
                const previewView = el.querySelector('.markdown-preview-view');
                if (previewView) {
                    previewView.prepend(bannerDiv);
                } else {
                    el.prepend(bannerDiv);
                }
            } else {
                // For other cases (like embedded views), just prepend to the element
                el.prepend(bannerDiv);
            }

            el.classList.add('pexels-banner');
        } else {
            el.classList.remove('pexels-banner');
            
            // Clear the stored image and keyword for this file
            this.loadedImages.delete(file.path);
            this.lastKeywords.delete(file.path);
        }
    }

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = reject;
            img.src = url;
        });
    }

    async fetchPexelsImage(keyword) {
        // Check cache first
        if (this.imageCache.has(keyword)) {
            return this.imageCache.get(keyword);
        }

        // Implement rate limiting
        const now = Date.now();
        if (now - this.rateLimiter.lastRequestTime < this.rateLimiter.minInterval) {
            await new Promise(resolve => setTimeout(resolve, this.rateLimiter.minInterval));
        }
        this.rateLimiter.lastRequestTime = Date.now();

        const defaultKeywords = this.settings.defaultKeywords.split(',').map(k => k.trim());
        const fallbackKeyword = defaultKeywords[Math.floor(Math.random() * defaultKeywords.length)];
        const keywords = [keyword, fallbackKeyword];
        
        for (const currentKeyword of keywords) {
            try {
                const response = await requestUrl({
                    url: `https://api.pexels.com/v1/search?query=${encodeURIComponent(currentKeyword)}&per_page=${this.settings.numberOfImages}&size=${this.settings.imageSize}&orientation=${this.settings.imageOrientation}`,
                    method: 'GET',
                    headers: {
                        'Authorization': this.settings.apiKey
                    }
                });

                if (response.status !== 200) {
                    console.error('Failed to fetch images:', response.status, response.text);
                    return null;
                }

                const data = response.json;

                if (data.photos && data.photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * data.photos.length);
                    if (currentKeyword !== keyword) {
                        console.log(`No image found for "${keyword}". Using image for "${currentKeyword}" instead.`);
                    }
                    const imageUrl = data.photos[randomIndex].src.original;
                    this.imageCache.set(keyword, imageUrl);
                    try {
                        await this.preloadImage(imageUrl);
                    } catch (error) {
                        console.error(`Failed to preload image: ${error.message}`);
                    }
                    return imageUrl;
                } else if (currentKeyword === keyword) {
                    console.log(`No image found for the provided keyword: "${keyword}". Trying a random default keyword.`);
                }
            } catch (error) {
                console.error(`Error fetching image from Pexels API for keyword "${currentKeyword}":`, error);
                new Notice(`Failed to fetch image: ${error.message}`);
            }
        }

        console.error('No images found for any keywords, including the random default.');
        return null;
    }

    getInputType(input) {
        if (typeof input !== 'string') {
            return 'invalid';
        }

        // Trim the input and remove surrounding quotes if present
        input = input.trim().replace(/^["'](.*)["']$/, '$1');

        // Check if it's an Obsidian internal link
        if (input.includes('[[') && input.includes(']]')) {
            return 'obsidianLink';
        }
        
        try {
            new URL(input);
            return 'url';
        } catch (_) {
            // Check if the input is a valid file path within the vault
            const file = this.app.vault.getAbstractFileByPath(input);
            if (file && 'extension' in file) {
                if (file.extension.match(/^(jpg|jpeg|png|gif|bmp|svg)$/i)) {
                    return 'vaultPath';
                }
            }
            // If the file doesn't exist in the vault or isn't an image, treat it as a keyword
            return 'keyword';
        }
    }

    getPathFromObsidianLink(link) {
        // Remove the [[ from the beginning of the link
        let innerLink = link.startsWith('[[') ? link.slice(2) : link;
        // Remove the ]] from the end if it exists
        innerLink = innerLink.endsWith(']]') ? innerLink.slice(0, -2) : innerLink;
        // Split by '|' in case there's an alias, and take the first part
        const path = innerLink.split('|')[0];
        // Resolve the path within the vault
        return this.app.metadataCache.getFirstLinkpathDest(path, '');
    }

    async getVaultImageUrl(path) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file && 'extension' in file) {
            try {
                const arrayBuffer = await this.app.vault.readBinary(file);
                const blob = new Blob([arrayBuffer], { type: `image/${file.extension}` });
                return URL.createObjectURL(blob);
            } catch (error) {
                console.error('Error reading vault image:', error);
                return null;
            }
        }
        return null;
    }

    updateAllBanners() {
        this.app.workspace.iterateAllLeaves(leaf => {
            if (leaf.view.getViewType() === "markdown") {
                this.updateBanner(leaf.view, true);
            }
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

        // API Key section
        new Setting(mainContent)
            .setName('API key')
            .setDesc('Enter your Pexels API key. This is only required if you want to fetch images from Pexels using keywords. It\'s not needed for using direct URLs or local images.')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                })
            )
            .then(setting => {
                setting.settingEl.addClass('flex-column');
                setting.settingEl.querySelector('.setting-item-control').style.width = '100%';
                setting.controlEl.querySelector('input').style.width = '100%';
                setting.controlEl.style.display = 'block';
                setting.controlEl.style.marginTop = '10px';
            });

        // Image settings section
        new Setting(mainContent)
            .setName('Images')
            .setDesc('Configure settings for images fetched from Pexels. These settings apply when using keywords to fetch random images.')
            .setHeading();

        new Setting(mainContent)
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

        new Setting(mainContent)
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

        new Setting(mainContent)
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

        new Setting(mainContent)
            .setName('Default keywords')
            .setDesc('Enter a comma-separated list of default keywords to be used when no keyword is provided in the frontmatter, or when the provided keyword does not return any results. - (Pexels API only)')
            .addTextArea(text => text
                .setPlaceholder('Enter keywords, separated by commas')
                .setValue(this.plugin.settings.defaultKeywords)
                .onChange(async (value) => {
                    this.plugin.settings.defaultKeywords = value;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.defaultKeywords = DEFAULT_SETTINGS.defaultKeywords;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the entire settings tab
                })
            )
            .then(setting => {
                setting.settingEl.addClass('flex-column');
                setting.settingEl.querySelector('.setting-item-control').style.width = '100%';
                const textarea = setting.controlEl.querySelector('textarea');
                textarea.style.width = '100%';
                textarea.style.minWidth = '100%';
                textarea.style.height = '100px';
                setting.controlEl.style.display = 'block';
                setting.controlEl.style.marginTop = '10px';
            });

        new Setting(mainContent)
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

        // Add new section for custom field names
        new Setting(mainContent)
            .setName('Custom Field Names')
            .setDesc('Customize the frontmatter field names used for the banner and Y-position. This allows you to use different field names in your notes.')
            .setHeading();

        // Add validation function
        const validateFieldName = (value, otherFieldName) => {
            if (value === otherFieldName) {
                new Notice("Field names must be unique!");
                return false;
            }
            return true;
        };

        new Setting(mainContent)
            .setName('Banner Field Name')
            .setDesc('Set a custom field name for the banner in frontmatter')
            .addText(text => text
                .setPlaceholder('pexels-banner')
                .setValue(this.plugin.settings.customBannerField)
                .onChange(async (value) => {
                    if (validateFieldName(value, this.plugin.settings.customYPositionField)) {
                        this.plugin.settings.customBannerField = value;
                        await this.plugin.saveSettings();
                    } else {
                        text.setValue(this.plugin.settings.customBannerField);
                    }
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.customBannerField = DEFAULT_SETTINGS.customBannerField;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        new Setting(mainContent)
            .setName('Y-Position Field Name')
            .setDesc('Set a custom field name for the Y-position in frontmatter')
            .addText(text => text
                .setPlaceholder('pexels-banner-y-position')
                .setValue(this.plugin.settings.customYPositionField)
                .onChange(async (value) => {
                    if (validateFieldName(value, this.plugin.settings.customBannerField)) {
                        this.plugin.settings.customYPositionField = value;
                        await this.plugin.saveSettings();
                    } else {
                        text.setValue(this.plugin.settings.customYPositionField);
                    }
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.customYPositionField = DEFAULT_SETTINGS.customYPositionField;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Add new section for folder images
        new Setting(mainContent)
            .setName('Folder Images')
            .setDesc('Set default banner images for specific folders. These will apply to all notes in the folder unless overridden by note-specific settings.')
            .setHeading();

        const folderImagesContainer = mainContent.createDiv('folder-images-container');

        this.plugin.settings.folderImages.forEach((folderImage, index) => {
            new FolderImageSetting(folderImagesContainer, this.plugin, folderImage, index);
        });

        new Setting(folderImagesContainer)
            .addButton(button => button
                .setButtonText("Add Folder Image")
                .onClick(async () => {
                    this.plugin.settings.folderImages.push({folder: "", image: "", yPosition: 50});
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the entire settings tab
                }));

        // Move the "How to use" section below the folder images
        new Setting(mainContent)
            .setName('How to use')
            .setHeading();

        const instructionsEl = mainContent.createEl('div', {cls: 'pexels-banner-section'});
        instructionsEl.createEl('p', {text: 'Add a "pexels-banner" field to your note\'s frontmatter with keywords for the image you want, or a direct URL to an image. You can also specify a custom y-position for the image.'});
        const codeEl = instructionsEl.createEl('pre');
        codeEl.createEl('code', {text: 
`---
pexels-banner: blue turtle
pexels-banner-y: 30
---

# Or use a direct URL:
---
pexels-banner: https://example.com/image.jpg
pexels-banner-y: 70
---

# Or use a path to an image in the vault:
---
pexels-banner: Assets/my-image.png
pexels-banner-y: 0
---

# Or use an Obsidian internal link:
---
pexels-banner: [[example-image.png]]
pexels-banner-y: 100
---`
        });

        // Add example image
        const exampleImg = containerEl.createEl('img', {
            attr: {
                src: 'https://raw.githubusercontent.com/jparkerweb/pexels-banner/main/example.jpg',
                alt: 'Example of a Pexels banner',
                style: 'max-width: 100%; height: auto; margin-top: 10px; border-radius: 5px;'
            }
        });

        // Footer
        const footerEl = containerEl.createEl('div', {cls: 'pexels-banner-footer'});
        footerEl.createEl('p', {
            text: 'All settings are saved and applied automatically when changed.',
            cls: 'pexels-banner-footer-text'
        });
    }
}