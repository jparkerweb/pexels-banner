import { Plugin, MarkdownView, requestUrl, Notice } from 'obsidian';
import { DEFAULT_SETTINGS, PexelsBannerSettingTab, debounce } from './settings';

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
        
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange.bind(this))
        );

        this.registerEvent(
            this.app.metadataCache.on('changed', this.handleMetadataChange.bind(this))
        );

        this.registerEvent(
            this.app.workspace.on('layout-change', this.handleLayoutChange.bind(this))
        );

        // Add event listener for mode change
        this.registerEvent(
            this.app.workspace.on('mode-change', this.handleModeChange.bind(this))
        );

        this.registerMarkdownPostProcessor(this.postProcessor.bind(this));

        this.setupMutationObserver();
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
            console.log('saveSettings', activeLeaf.view);
            await this.updateBanner(activeLeaf.view, true);
        }
    }

    async handleActiveLeafChange(leaf) {
        if (leaf && leaf.view instanceof MarkdownView && leaf.view.file) {
            await this.updateBanner(leaf.view, false);
        }
    }

    async handleMetadataChange(file) {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view instanceof MarkdownView && activeLeaf.view.file && activeLeaf.view.file === file) {
            await this.updateBanner(activeLeaf.view, true);
        }
    }

    handleLayoutChange() {
        // Use setTimeout to give the view a chance to fully render
        setTimeout(() => {
            const activeLeaf = this.app.workspace.activeLeaf;
            if (activeLeaf && (activeLeaf.view instanceof MarkdownView || activeLeaf.view.getViewType() === "markdown")) {
                this.updateBanner(activeLeaf.view, false);
            }
        }, 100); // 100ms delay
    }

    async handleModeChange(leaf) {
        if (leaf && leaf.view instanceof MarkdownView && leaf.view.file) {
            await this.updateBanner(leaf.view, true);
        }
    }

    async updateBanner(view, isContentChange) {
        if (!view || !view.file) {
            return;
        }

        const frontmatter = this.app.metadataCache.getFileCache(view.file)?.frontmatter;
        const contentEl = view.contentEl;
        const customBannerField = this.settings.customBannerField;
        const customYPositionField = this.settings.customYPositionField;
        const customYPosition = frontmatter && (frontmatter[customYPositionField] || frontmatter['banner-y']);
        
        let yPosition = customYPosition !== undefined ? customYPosition : this.settings.yPosition;
        let bannerImage = frontmatter && frontmatter[customBannerField];

        if (!bannerImage) {
            const folderSpecific = this.getFolderSpecificImage(view.file.path);
            if (folderSpecific) {
                bannerImage = folderSpecific.image;
                yPosition = customYPosition !== undefined ? customYPosition : folderSpecific.yPosition;
            }
        }
        
        if (isContentChange) {
            this.loadedImages.delete(view.file.path);
            this.lastKeywords.delete(view.file.path);
        }
        
        await this.addPexelsBanner(contentEl, { 
            frontmatter, 
            file: view.file, 
            isContentChange,
            yPosition,
            customBannerField,
            customYPositionField,
            customContentStartField: this.settings.customContentStartField,
            bannerImage,
            isReadingView: view.getMode && view.getMode() === 'preview'
        });

        this.lastYPositions.set(view.file.path, yPosition);

        // Process embedded notes
        const embeddedNotes = contentEl.querySelectorAll('.internal-embed');
        for (const embed of embeddedNotes) {
            const embedFile = this.app.metadataCache.getFirstLinkpathDest(embed.getAttribute('src'), '');
            if (embedFile) {
                const embedView = {
                    file: embedFile,
                    contentEl: embed,
                    getMode: () => 'preview'
                };
                await this.updateBanner(embedView, false);
            }
        }
    }

    async addPexelsBanner(el, ctx) {
        const { frontmatter, file, isContentChange, yPosition, bannerImage, isReadingView } = ctx;
        const viewContent = el;

        // Check if this is an embedded note
        const isEmbedded = viewContent.classList.contains('internal-embed');

        if (!isEmbedded && !viewContent.classList.contains('view-content')) {
            return;
        }

        viewContent.classList.toggle('pexels-banner', !!bannerImage);

        let container;
        if (isEmbedded) {
            container = viewContent.querySelector('.markdown-embed-content');
        } else {
            container = isReadingView 
                ? viewContent.querySelector('.markdown-preview-sizer:not(.internal-embed .markdown-preview-sizer)')
                : viewContent.querySelector('.cm-sizer');
        }

        if (!container) {
            return;
        }

        let bannerDiv = container.querySelector(':scope > .pexels-banner-image');
        if (!bannerDiv) {
            bannerDiv = createDiv({ cls: 'pexels-banner-image' });
            container.insertBefore(bannerDiv, container.firstChild);
        }

        if (bannerImage) {
            let imageUrl = this.loadedImages.get(file.path);
            const lastInput = this.lastKeywords.get(file.path);

            if (!imageUrl || (isContentChange && bannerImage !== lastInput)) {
                imageUrl = await this.getImageUrl(this.getInputType(bannerImage), bannerImage);
                if (imageUrl) {
                    this.loadedImages.set(file.path, imageUrl);
                    this.lastKeywords.set(file.path, bannerImage);
                }
            }

            if (imageUrl) {
                bannerDiv.style.backgroundImage = `url('${imageUrl}')`;
                bannerDiv.style.backgroundPosition = `center ${yPosition}%`;
                bannerDiv.style.display = 'block';
            }
        } else {
            bannerDiv.style.display = 'none';
            this.loadedImages.delete(file.path);
            this.lastKeywords.delete(file.path);
        }

        this.applyContentStartPosition(viewContent, this.settings.contentStartPosition);
    }

    setupMutationObserver() {
        this.observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                if (mutation.type === 'childList') {
                    const removedNodes = Array.from(mutation.removedNodes);
                    const addedNodes = Array.from(mutation.addedNodes);

                    const bannerRemoved = removedNodes.some(node => 
                        node.classList && node.classList.contains('pexels-banner-image')
                    );

                    const contentChanged = addedNodes.some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList.contains('markdown-preview-section') || 
                         node.classList.contains('cm-content'))
                    );

                    if (bannerRemoved || contentChanged) {
                        this.debouncedEnsureBanner();
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    debouncedEnsureBanner = debounce(() => {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
            this.updateBanner(activeLeaf.view, false);
        }
    }, 100);

    getFolderSpecificImage(filePath) {
        const folderPath = this.getFolderPath(filePath);
        for (const folderImage of this.settings.folderImages) {
            if (folderPath.startsWith(folderImage.folder)) {
                return {
                    image: folderImage.image,
                    yPosition: folderImage.yPosition,
                    contentStartPosition: folderImage.contentStartPosition
                };
            }
        }
        return null;
    }

    getFolderPath(filePath) {
        const lastSlashIndex = filePath.lastIndexOf('/');
        return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
    }

    async getImageUrl(inputType, input) {
        switch (inputType) {
            case 'url':
                return input;
            case 'vaultPath':
                return await this.getVaultImageUrl(input);
            case 'obsidianLink':
                const resolvedFile = this.getPathFromObsidianLink(input);
                return resolvedFile ? await this.getVaultImageUrl(resolvedFile.path) : null;
            case 'keyword':
                return await this.fetchPexelsImage(input);
            default:
                return null;
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
                console.log('updateAllBanners', leaf.view);
                this.updateBanner(leaf.view, true);
            }
        });
    }

    async postProcessor(el, ctx) {
        const frontmatter = ctx.frontmatter;
        if (frontmatter && frontmatter[this.settings.customBannerField]) {
            await this.addPexelsBanner(el, {
                frontmatter,
                file: ctx.sourcePath,
                isContentChange: false,
                yPosition: frontmatter[this.settings.customYPositionField] || this.settings.yPosition,
                customBannerField: this.settings.customBannerField,
                customYPositionField: this.settings.customYPositionField,
                customContentStartField: this.settings.customContentStartField,
                bannerImage: frontmatter[this.settings.customBannerField]
            });
        }
    }

    onunload() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }

    applyContentStartPosition(el, contentStartPosition) {
        el.style.setProperty('--pexels-banner-content-start', `${contentStartPosition}px`);
    }
}
