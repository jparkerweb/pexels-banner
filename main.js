const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
    apiKey: '',
    imageSize: 'medium',
    imageOrientation: 'landscape',
    numberOfImages: 10,
    defaultKeywords: 'nature,abstract,landscape,technology,art,cityscape,wildlife,ocean,mountains,forest,space,architecture,food,travel,science,music,sports,fashion,business,education,health,culture,history,weather,transportation,industry,people,animals,plants,patterns'
};

module.exports = class PexelsBannerPlugin extends Plugin {
    debounceTimer = null;
    loadedImages = new Map();
    lastKeywords = new Map();

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
            const newKeyword = frontmatter && frontmatter['pexels-banner'];
            const oldKeyword = this.lastKeywords.get(file.path);

            if (newKeyword !== oldKeyword) {
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
        await this.addPexelsBanner(contentEl, { frontmatter, file: view.file, isContentChange });
    }

    async addPexelsBanner(el, ctx) {
        const { frontmatter, file, isContentChange } = ctx;
        if (frontmatter && frontmatter['pexels-banner']) {
            const keyword = frontmatter['pexels-banner'];
            let imageUrl = this.loadedImages.get(file.path);
            const lastKeyword = this.lastKeywords.get(file.path);

            if (!imageUrl || (isContentChange && keyword !== lastKeyword)) {
                imageUrl = await this.fetchPexelsImage(keyword);
                if (imageUrl) {
                    this.loadedImages.set(file.path, imageUrl);
                    this.lastKeywords.set(file.path, keyword);
                }
            }

            if (imageUrl) {
                // Remove existing banner if present
                const existingBanner = el.querySelector('.pexels-banner-image');
                if (existingBanner) {
                    existingBanner.remove();
                }

                // Create and insert the banner div
                const bannerDiv = createDiv({ cls: 'pexels-banner-image' });
                bannerDiv.style.backgroundImage = `url('${imageUrl}')`;
                el.classList.add('pexels-banner');
                el.prepend(bannerDiv);
            }
        } else {
            // Remove the banner if 'pexels-banner' is not in frontmatter
            const existingBanner = el.querySelector('.pexels-banner-image');
            if (existingBanner) {
                existingBanner.remove();
                el.classList.remove('pexels-banner');
            }
            // Clear the stored image and keyword for this file
            this.loadedImages.delete(file.path);
            this.lastKeywords.delete(file.path);
        }
    }

    async fetchPexelsImage(keyword) {
        const defaultKeywords = this.settings.defaultKeywords.split(',').map(k => k.trim());
        const fallbackKeyword = defaultKeywords[Math.floor(Math.random() * defaultKeywords.length)];
        const keywords = [keyword, fallbackKeyword];
        
        for (const currentKeyword of keywords) {
            try {
                const response = await fetch(`https://api.pexels.com/v1/search?query=${currentKeyword}&per_page=${this.settings.numberOfImages}&size=${this.settings.imageSize}&orientation=${this.settings.imageOrientation}`, {
                    headers: {
                        Authorization: this.settings.apiKey
                    }
                });

                const data = await response.json();

                if (data.photos && data.photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * data.photos.length);
                    if (currentKeyword !== keyword) {
                        console.log(`No image found for "${keyword}". Using image for "${currentKeyword}" instead.`);
                    }
                    return data.photos[randomIndex].src.original;
                } else if (currentKeyword === keyword) {
                    console.log(`No image found for the provided keyword: "${keyword}". Trying a random default keyword.`);
                }
            } catch (error) {
                console.error(`Error fetching image from Pexels API for keyword "${currentKeyword}":`, error);
            }
        }

        console.error('No images found for any keywords, including the random default.');
        return null;
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

        const header = containerEl.createEl('div', {cls: 'pexels-banner-header'});
        header.createEl('h2', {text: 'Pexels Banner Settings'});

        // New section: About this plugin
        const aboutSection = containerEl.createEl('div', {cls: 'pexels-banner-section'});
        aboutSection.createEl('h3', {text: 'About Pexels Banner'});
        aboutSection.createEl('p', {text: 'The Pexels Banner plugin allows you to automatically add beautiful banner images to your notes using the Pexels API. You can specify keywords in your note\'s frontmatter, and the plugin will fetch a relevant image to display at the top of your note.'});
        aboutSection.createEl('p', {text: 'This plugin enhances your note-taking experience by providing visual context and improving the overall aesthetics of your notes.'});

        // Add example image
        const exampleImg = aboutSection.createEl('img', {
            attr: {
                src: 'data:image/jpeg;base64,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pKxKegUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXo3w48c6b4Z0Sezv4LySWS4aYGFFIwVUd2HPymvOaKipTjUjyyNKVWVKXNHcVzudiOhOaSiirMwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACipE8naN/mbu+MYp3+j/8ATX9KYiGipv8AR/8Apr+lH+j/APTX9KAIaKm/0f8A6a/pR/o//TX9KAIaKm/0f/pr+lH+j/8ATX9KAIaKm/0f/pr+lH+j/wDTX9KAIaKm/wBH/wCmv6Uf6P8A9Nf0oAhoqb/R/wDpr+lH+j/9Nf0oAhoqb/R/+mv6Uf6P/wBNf0oAhoqb/R/+mv6Uf6P/ANNf0oAhoqb/AEf/AKa/pR/o/wD01/SgCGipv9H/AOmv6Uf6P/01/SgCGipv9H/6a/pR/o//AE1/SgCGipv9H/6a/pR/o/8A01/SgCGipv8AR/8Apr+lH+j/APTX9KAIaKm/0f8A6a/pR/o//TX9KAIaKm/0f/pr+lH+j/8ATX9KAIaKm/0f/pr+lH+j/wDTX9KAIaKm/wBH/wCmv6Uf6P8A9Nf0oAhoqb/R/wDpr+lH+j/9Nf0oAhoqb/R/+mv6Uf6P/wBNf0oAhoqb/R/+mv6Uf6P/ANNf0oAhoqb/AEf/AKa/pR/o/wD01/SgCGipv9H/AOmv6Uf6P/01/SgCGipv9H/6a/pR/o//AE1/SgCGipv9H/6a/pR/o/8A01/SgCGipv8AR/8Apr+lH+j/APTX9KAIaKm/0f8A6a/pR/o//TX9KAIaKm/0f/pr+lH+j/8ATX9KAIaKm/0f/pr+lH+j/wDTX9KAIaKm/wBH/wCmv6Uf6P8A9Nf0oAhoqb/R/wDpr+lH+j/9Nf0oAhoqb/R/+mv6Uf6P/wBNf0oAhoqb/R/+mv6Uf6P/ANNf0oAhoqb/AEf/AKa/pR/o/wD01/SgCGipv9H/AOmv6Uf6P/01/SgCGipv9H/6a/pR/o//AE1/SgCGipv9H/6a/pR/o/8A01/SgCGipv8AR/8Apr+lH+j/APTX9KAIaKm/0f8A6a/pR/o//TX9KAIaKm/0f/pr+lH+j/8ATX9KAIaKm/0f/pr+lH+j/wDTX9KAIaKm/wBH/wCmv6Uf6P8A9Nf0oAhoqb/R/wDpr+lH+j/9Nf0oAhoqb/R/+mv6Uf6P/wBNf0oAhoqb/R/+mv6Uf6P/ANNf0oAhoqb/AEf/AKa/pR/o/wD01/SgCGipv9H/AOmv6Uf6P/01/SgCGipv9H/6a/pR/o//AE1/SgCGipv9H/6a/pR/o/8A01/SgCGipv8AR/8Apr+lH+j/APTX9KAIaKm/0f8A6a/pR/o//TX9KAIaKm/0f/pr+lH+j/8ATX9KAIaKm/0f/pr+lH+j/wDTX9KAIaKm/wBH/wCmv6Uf6P8A9Nf0oAhoqb/R/wDpr+lNk8rb+735/wBrFAEdFFFIYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//Z',
                alt: 'Example of a Pexels banner',
                style: 'max-width: 100%; height: auto; margin-top: 10px; border-radius: 5px;'
            }
        });

        // Add spacing after the About section
        containerEl.createEl('div', {cls: 'pexels-banner-spacing'});

        const mainContent = containerEl.createEl('div', {cls: 'pexels-banner-main-content'});

        // API Key section
        const apiKeySection = mainContent.createEl('div', {cls: 'pexels-banner-section'});
        apiKeySection.createEl('h3', {text: 'Pexels API Key'});
        const apiKeySteps = apiKeySection.createEl('ol');
        apiKeySteps.createEl('li').createEl('a', {
            text: 'https://www.pexels.com/api/',
            href: 'https://www.pexels.com/api/',
            target: '_blank',
            rel: 'noopener'
        });
        apiKeySteps.createEl('li', {text: 'Signup for a free account or login'});
        apiKeySteps.createEl('li', {text: 'Create / Copy your API key and paste it below'});

        new Setting(apiKeySection)
            .setName('API Key')
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

        // Image Settings section
        const imageSettingsSection = mainContent.createEl('div', {cls: 'pexels-banner-section'});
        imageSettingsSection.createEl('h3', {text: 'Image Settings'});

        new Setting(imageSettingsSection)
            .setName('Image Size')
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

        new Setting(imageSettingsSection)
            .setName('Image Orientation')
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

        new Setting(imageSettingsSection)
            .setName('Number of Images')
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

        // Add new setting for default keywords
        new Setting(imageSettingsSection)
            .setName('Default Keywords')
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

        // How to use section
        const instructionsEl = mainContent.createEl('div', {cls: 'pexels-banner-section'});
        instructionsEl.createEl('h3', {text: 'How to Use'});
        instructionsEl.createEl('p', {text: 'Add a "pexels-banner" field to your note\'s frontmatter with keywords for the image you want.'});
        const codeEl = instructionsEl.createEl('pre');
        codeEl.createEl('code', {text: 
`---
pexels-banner: blue turtle
---`
        });


        // Footer
        const footerEl = containerEl.createEl('div', {cls: 'pexels-banner-footer'});
        footerEl.createEl('p', {
            text: 'All settings are saved automatically when changed.',
            cls: 'pexels-banner-footer-text'
        });
    }
}