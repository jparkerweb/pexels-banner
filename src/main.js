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
    imageCache = new Map();
    rateLimiter = {
        lastRequestTime: 0,
        minInterval: 1000 // 1 second between requests
    };

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
            const input = frontmatter['pexels-banner'];
            let imageUrl = this.loadedImages.get(file.path);
            const lastInput = this.lastKeywords.get(file.path);

            // Check if the input is a URL
            const isUrl = this.isValidUrl(input);

            if (!imageUrl || (isContentChange && input !== lastInput)) {
                if (isUrl) {
                    imageUrl = input;
                } else {
                    imageUrl = await this.fetchPexelsImage(input);
                }
                if (imageUrl) {
                    this.loadedImages.set(file.path, imageUrl);
                    this.lastKeywords.set(file.path, input);
                }
            }

            if (imageUrl) {
                // Find the appropriate parent elements
                const previewView = el.querySelector('.markdown-preview-view');
                const sourceView = el.querySelector('.markdown-source-view');

                // Remove existing banners if present
                const existingBanners = el.querySelectorAll('.pexels-banner-image');
                existingBanners.forEach(banner => banner.remove());

                // Create the banner div
                const bannerDiv = createDiv({ cls: 'pexels-banner-image' });
                bannerDiv.style.backgroundImage = `url('${imageUrl}')`;

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
            }
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
                const response = await fetch(`https://api.pexels.com/v1/search?query=${currentKeyword}&per_page=${this.settings.numberOfImages}&size=${this.settings.imageSize}&orientation=${this.settings.imageOrientation}`, {
                    headers: {
                        Authorization: this.settings.apiKey
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

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

    // Helper function to check if a string is a valid URL
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
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
                src: 'https://raw.githubusercontent.com/jparkerweb/pexels-banner/main/example.jpg',
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
        instructionsEl.createEl('p', {text: 'Add a "pexels-banner" field to your note\'s frontmatter with keywords for the image you want, or a direct URL to an image.'});
        const codeEl = instructionsEl.createEl('pre');
        codeEl.createEl('code', {text: 
`---
pexels-banner: blue turtle
---

# Or use a direct URL:

---
pexels-banner: https://example.com/image.jpg
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