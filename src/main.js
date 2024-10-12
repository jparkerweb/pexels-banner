const { Plugin, PluginSettingTab, Setting, requestUrl } = require('obsidian');

const DEFAULT_SETTINGS = {
    apiKey: '',
    imageSize: 'medium',
    imageOrientation: 'landscape',
    numberOfImages: 10,
    defaultKeywords: 'nature,abstract,landscape,technology,art,cityscape,wildlife,ocean,mountains,forest,space,architecture,food,travel,science,music,sports,fashion,business,education,health,culture,history,weather,transportation,industry,people,animals,plants,patterns',
    yPosition: 50,
    // Add new fields for custom frontmatter keys
    customBannerField: 'pexels-banner',
    customYPositionField: 'pexels-banner-y-position'
};

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
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async handleActiveLeafChange(leaf) {
        const view = leaf.view;
        if (view.getViewType() === "markdown") {
            await this.updateBanner(view, false);
        }
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
            await this.updateBanner(activeLeaf.view, false);
        }
    }

    async updateBanner(view, isContentChange) {
        const frontmatter = this.app.metadataCache.getFileCache(view.file)?.frontmatter;
        const contentEl = view.contentEl;
        const customBannerField = this.settings.customBannerField;
        const customYPositionField = this.settings.customYPositionField;
        const customYPosition = frontmatter && (frontmatter[customYPositionField] || frontmatter['pexels-banner-y']);
        const yPosition = customYPosition !== undefined ? customYPosition : this.settings.yPosition;
        
        await this.addPexelsBanner(contentEl, { 
            frontmatter, 
            file: view.file, 
            isContentChange,
            yPosition,
            customBannerField,
            customYPositionField
        });

        // Update the lastYPositions Map
        this.lastYPositions.set(view.file.path, yPosition);
    }

    async addPexelsBanner(el, ctx) {
        const { frontmatter, file, isContentChange, yPosition, customBannerField, customYPositionField } = ctx;
        if (frontmatter && frontmatter[customBannerField]) {
            let input = frontmatter[customBannerField];
            
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

            // Find the appropriate parent elements
            const previewView = el.querySelector('.markdown-preview-view');
            const sourceView = el.querySelector('.markdown-source-view');

            // Remove existing banners if present
            const existingBanners = el.querySelectorAll('.pexels-banner-image');
            existingBanners.forEach(banner => banner.remove());

            // Create the banner div
            const bannerDiv = createDiv({ cls: 'pexels-banner-image' });
            bannerDiv.style.backgroundImage = `url('${imageUrl}')`;
            bannerDiv.style.backgroundPosition = `center ${yPosition}%`;

            // Insert the banner div in the appropriate locations
            if (previewView) {
                previewView.prepend(bannerDiv.cloneNode(true));
            }
            if (sourceView) {
                const cmSizer = sourceView.querySelector('.cm-sizer');
                if (cmSizer) {
                    cmSizer.prepend(bannerDiv.cloneNode(true));
                } else {
                    sourceView.prepend(bannerDiv.cloneNode(true));
                }
            }

            el.classList.add('pexels-banner');
        } else {
            // Remove the banners if 'pexels-banner' is not in frontmatter
            const existingBanners = el.querySelectorAll('.pexels-banner-image');
            existingBanners.forEach(banner => banner.remove());
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
                this.updateBanner(leaf.view, false);
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
            .setDesc('Enter your Pexels API key')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                })
            )
            .then(setting => {
                setting.controlEl.querySelector('input').style.width = '100%';
            });

        // Add spacing after the API Key section
        mainContent.createEl('div', {cls: 'pexels-banner-spacing'});

        // Image settings section
        new Setting(mainContent)
            .setName('Images')
            .setHeading();

        new Setting(mainContent)
            .setName('Size')
            .setDesc('Select the size of the image')
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
            .setDesc('Select the orientation of the image')
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
            .setDesc('Enter the number of random images to fetch (1-50)')
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
            .setDesc('Enter a comma-separated list of default keywords to be used when no keyword is provided in the frontmatter, or when the provided keyword does not return any results.')
            .addTextArea(text => text
                .setPlaceholder('Enter keywords, separated by commas')
                .setValue(this.plugin.settings.defaultKeywords)
                .onChange(async (value) => {
                    this.plugin.settings.defaultKeywords = value;
                    await this.plugin.saveSettings();
                }))
            .then(setting => {
                const textarea = setting.controlEl.querySelector('textarea');
                textarea.style.width = '100%';
                textarea.style.minWidth = '200px';
                textarea.style.height = '100px';
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

        // How to use section
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
            text: 'All settings are saved automatically when changed.',
            cls: 'pexels-banner-footer-text'
        });
    }
}