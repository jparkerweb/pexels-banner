import { Plugin, MarkdownView, requestUrl, Notice } from 'obsidian';
import { DEFAULT_SETTINGS, PixelBannerSettingTab, debounce } from './settings';

module.exports = class PixelBannerPlugin extends Plugin {
    debounceTimer = null;
    loadedImages = new Map();
    lastKeywords = new Map();
    imageCache = new Map();
    rateLimiter = {
        lastRequestTime: 0,
        minInterval: 1000 // 1 second between requests
    };
    lastYPositions = new Map();
    lastFrontmatter = new Map();

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new PixelBannerSettingTab(this.app, this));
        
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
        
        // Migrate custom fields from string to array if necessary
        this.migrateCustomFields();
        
        // Ensure folderImages is always an array
        if (!Array.isArray(this.settings.folderImages)) {
            this.settings.folderImages = [];
        }

        if (this.settings.folderImages) {
            this.settings.folderImages.forEach(folderImage => {
                folderImage.imageDisplay = folderImage.imageDisplay || 'cover';
                folderImage.imageRepeat = folderImage.imageRepeat || false;
                folderImage.directChildrenOnly = folderImage.directChildrenOnly || false; // New setting
            });
        }
    }

    migrateCustomFields() {
        const fieldsToMigrate = [
            'customBannerField',
            'customYPositionField',
            'customContentStartField',
            'customImageDisplayField',
            'customImageRepeatField'
        ];

        fieldsToMigrate.forEach(field => {
            if (typeof this.settings[field] === 'string') {
                console.log(`converting ${field} to array`);
                this.settings[field] = [this.settings[field]];
            } else if (!Array.isArray(this.settings[field])) {
                console.log(`setting default value for ${field}`);
                this.settings[field] = DEFAULT_SETTINGS[field];
            }
        });

        // Save the migrated settings
        this.saveSettings();
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
        if (leaf && leaf.view instanceof MarkdownView && leaf.view.file) {
            await this.updateBanner(leaf.view, false);
        }
    }

    async handleMetadataChange(file) {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view instanceof MarkdownView && activeLeaf.view.file && activeLeaf.view.file === file) {
            const currentFrontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            const cachedFrontmatter = this.lastFrontmatter.get(file.path);

            if (this.isFrontmatterChange(cachedFrontmatter, currentFrontmatter)) {
                this.lastFrontmatter.set(file.path, currentFrontmatter);
                await this.updateBanner(activeLeaf.view, true);
            }
        }
    }

    isFrontmatterChange(cachedFrontmatter, currentFrontmatter) {
        if (!cachedFrontmatter && !currentFrontmatter) return false;
        if (!cachedFrontmatter || !currentFrontmatter) return true;
        return JSON.stringify(cachedFrontmatter) !== JSON.stringify(currentFrontmatter);
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
        
        let yPosition = this.settings.yPosition;
        let contentStartPosition = this.settings.contentStartPosition;
        let bannerImage = getFrontmatterValue(frontmatter, this.settings.customBannerField);

        // Flatten the bannerImage if it's an array within an array
        if (Array.isArray(bannerImage)) {
            bannerImage = bannerImage.flat()[0];
            bannerImage = `[[${bannerImage}]]`;
        }

        // Check for folder-specific settings
        const folderSpecific = this.getFolderSpecificImage(view.file.path);
        if (folderSpecific) {
            bannerImage = bannerImage || folderSpecific.image;
            yPosition = folderSpecific.yPosition;
            contentStartPosition = folderSpecific.contentStartPosition;
        }

        // Override with note-specific settings if available
        if (frontmatter) {
            const customYPosition = getFrontmatterValue(frontmatter, this.settings.customYPositionField);
            if (customYPosition !== undefined) {
                yPosition = customYPosition;
            }
            const customContentStart = getFrontmatterValue(frontmatter, this.settings.customContentStartField);
            if (customContentStart !== undefined) {
                contentStartPosition = customContentStart;
            }
        }
        
        if (isContentChange) {
            this.loadedImages.delete(view.file.path);
            this.lastKeywords.delete(view.file.path);
        }
        
        await this.addPixelBanner(contentEl, { 
            frontmatter, 
            file: view.file, 
            isContentChange,
            yPosition,
            contentStartPosition,
            customBannerField: this.settings.customBannerField,
            customYPositionField: this.settings.customYPositionField,
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

    async addPixelBanner(el, ctx) {
        const { frontmatter, file, isContentChange, yPosition, contentStartPosition, bannerImage, isReadingView } = ctx;
        const viewContent = el;

        // Check if this is an embedded note
        const isEmbedded = viewContent.classList.contains('internal-embed');

        if (!isEmbedded && !viewContent.classList.contains('view-content')) {
            return;
        }

        viewContent.classList.toggle('pixel-banner', !!bannerImage);

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

        let bannerDiv = container.querySelector(':scope > .pixel-banner-image');
        if (!bannerDiv) {
            bannerDiv = createDiv({ cls: 'pixel-banner-image' });
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
                bannerDiv.style.backgroundSize = getFrontmatterValue(frontmatter, this.settings.customImageDisplayField) || 
                    this.getFolderSpecificSetting(file.path, 'imageDisplay') || 
                    this.settings.imageDisplay || 
                    'cover';
                
                const shouldRepeat = getFrontmatterValue(frontmatter, this.settings.customImageRepeatField);
                if (shouldRepeat !== undefined) {
                    // Convert the value to a boolean
                    const repeatValue = String(shouldRepeat).toLowerCase() === 'true';
                    bannerDiv.style.backgroundRepeat = repeatValue ? 'repeat' : 'no-repeat';
                } else {
                    bannerDiv.style.backgroundRepeat = (bannerDiv.style.backgroundSize === 'contain' && 
                        (this.getFolderSpecificSetting(file.path, 'imageRepeat') || this.settings.imageRepeat)) ? 'repeat' : 'no-repeat';
                }
                
                // Set the banner height
                const bannerHeight = getFrontmatterValue(frontmatter, this.settings.customBannerHeightField) ||
                    this.getFolderSpecificSetting(file.path, 'bannerHeight') ||
                    this.settings.bannerHeight ||
                    350;
                bannerDiv.style.setProperty('--pixel-banner-height', `${bannerHeight}px`);

                // Set the fade effect
                const fadeValue = getFrontmatterValue(frontmatter, this.settings.customFadeField) ??
                    this.getFolderSpecificSetting(file.path, 'fade') ??
                    this.settings.fade ??
                    -75;
                
                // Apply the fade value directly as a percentage
                bannerDiv.style.setProperty('--pixel-banner-fade', `${fadeValue}%`);

                bannerDiv.style.display = 'block';
            }
        } else {
            bannerDiv.style.display = 'none';
            this.loadedImages.delete(file.path);
            this.lastKeywords.delete(file.path);
            // Reset the content start position when there's no banner
            this.applyContentStartPosition(viewContent, 0);
        }

        // Apply the content start position
        this.applyContentStartPosition(viewContent, contentStartPosition);
    }

    setupMutationObserver() {
        this.observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                if (mutation.type === 'childList') {
                    const removedNodes = Array.from(mutation.removedNodes);
                    const addedNodes = Array.from(mutation.addedNodes);

                    const bannerRemoved = removedNodes.some(node => 
                        node.classList && node.classList.contains('pixel-banner-image')
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
            if (folderImage.directChildrenOnly) {
                if (folderPath === folderImage.folder) {
                    return {
                        image: folderImage.image,
                        yPosition: folderImage.yPosition,
                        contentStartPosition: folderImage.contentStartPosition
                    };
                }
            } else if (folderPath.startsWith(folderImage.folder)) {
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

    async getImageUrl(type, input) {
        if (type === 'url' || type === 'path') {
            return input;
        }

        if (type === 'obsidianLink') {
            const file = this.getPathFromObsidianLink(input);
            if (file) {
                return this.getVaultImageUrl(file.path);
            }
            return null;
        }

        if (type === 'vaultPath') {
            return this.getVaultImageUrl(input);
        }

        if (type === 'keyword') {
            if (this.settings.apiProvider === 'pexels') {
                // console.log('Using Pexels API');
                return this.fetchPexelsImage(input);
            } else if (this.settings.apiProvider === 'pixabay') {
                // console.log('Using Pixabay API');
                return this.fetchPixabayImage(input);
            }
        }

        // console.log('No matching type found, returning null');
        return null;
    }

    async fetchPexelsImage(keyword) {
        const apiKey = this.settings.pexelsApiKey;
        if (!apiKey) {
            new Notice('Pexels API key is not set. Please set it in the plugin settings.');
            return null;
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
                        'Authorization': apiKey
                    }
                });

                if (response.status !== 200) {
                    console.error('Failed to fetch images:', response.status, response.text);
                    continue;
                }

                const data = response.json;

                if (data.photos && data.photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * data.photos.length);
                    if (currentKeyword !== keyword) {
                        console.log(`No image found for "${keyword}". Using image for "${currentKeyword}" instead.`);
                    }
                    const imageUrl = data.photos[randomIndex].src[this.settings.imageSize];
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
                console.error(`Error fetching image from API for keyword "${currentKeyword}":`, error);
                new Notice(`Failed to fetch image: ${error.message}`);
            }
        }

        console.error('No images found for any keywords, including the random default.');
        return null;
    }

    async fetchPixabayImage(keyword) {
        const apiKey = this.settings.pixabayApiKey;
        if (!apiKey) {
            new Notice('Pixabay API key is not set. Please set it in the plugin settings.');
            return null;
        }

        // console.log('Entering fetchPixabayImage with keyword:', keyword);
        const defaultKeywords = this.settings.defaultKeywords.split(',').map(k => k.trim());
        const keywordsToTry = [keyword, ...defaultKeywords];
        const maxAttempts = 5;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const currentKeyword = attempt === 0 ? keyword : keywordsToTry[Math.floor(Math.random() * keywordsToTry.length)];
            // console.log(`Attempt ${attempt + 1} with keyword: ${currentKeyword}`);

            const apiUrl = 'https://pixabay.com/api/';
            const params = new URLSearchParams({
                key: apiKey,
                q: encodeURIComponent(currentKeyword),
                image_type: 'photo',
                per_page: this.settings.numberOfImages,
                safesearch: true,
            });

            // console.log('Pixabay API URL:', `${apiUrl}?${params}`);

            try {
                const response = await this.makeRequest(`${apiUrl}?${params}`);
                
                if (response.status !== 200) {
                    console.error(`Pixabay API error: ${response.status} ${response.statusText}`);
                    continue;
                }

                let data;
                if (response.arrayBuffer) {
                    const text = new TextDecoder().decode(response.arrayBuffer);
                    try {
                        data = JSON.parse(text);
                    } catch (error) {
                        console.error('Failed to parse Pixabay response:', error);
                        continue;
                    }
                } else {
                    console.error('Unexpected response format:', response);
                    continue;
                }

                if (data.hits && data.hits.length > 0) {
                    const imageUrls = data.hits.map(hit => hit.largeImageURL);
                    
                    if (imageUrls.length > 0) {
                        const randomIndex = Math.floor(Math.random() * imageUrls.length);
                        const selectedImageUrl = imageUrls[randomIndex];
                        return selectedImageUrl;
                    }
                }
                
                console.log(`No images found for keyword: ${currentKeyword}`);
            } catch (error) {
                console.error('Error fetching image from Pixabay:', error);
            }
        }

        console.error('No images found after all attempts');
        new Notice('Failed to fetch an image after multiple attempts, try a different keyword and/or update the backup keyword list in settings.');
        return null;
    }

    async makeRequest(url) {
        const now = Date.now();
        if (now - this.rateLimiter.lastRequestTime < this.rateLimiter.minInterval) {
            // console.log('Rate limiting in effect, waiting...');
            await new Promise(resolve => setTimeout(resolve, this.rateLimiter.minInterval));
        }
        this.rateLimiter.lastRequestTime = Date.now();

        try {
            const response = await requestUrl({ url });
            return response;
        } catch (error) {
            console.error('Request failed:', error);
            throw new Error(`Request failed: ${error.message}`);
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

    getInputType(input) {
        if (Array.isArray(input)) {
            input = input.flat()[0];
        }

        if (typeof input !== 'string') {
            return 'invalid';
        }

        // Trim the input and remove surrounding quotes if present
        input = input.trim().replace(/^["'](.*)["']$/, '$1');

        // Check if it's an Obsidian internal link
        if (input.startsWith('[[') && input.endsWith(']]')) {
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
                // console.log('updateAllBanners', leaf.view);
                this.updateBanner(leaf.view, true);
            }
        });
    }

    async postProcessor(el, ctx) {
        const frontmatter = ctx.frontmatter;
        if (frontmatter && frontmatter[this.settings.customBannerField]) {
            await this.addPixelBanner(el, {
                frontmatter,
                file: ctx.sourcePath,
                isContentChange: false,
                yPosition: frontmatter[this.settings.customYPositionField] || this.settings.yPosition,
                contentStartPosition: frontmatter[this.settings.customContentStartField] || this.settings.contentStartPosition,
                customBannerField: this.settings.customBannerField,
                customYPositionField: this.settings.customYPositionField,
                customContentStartField: this.settings.customContentStartField,
                customImageDisplayField: this.settings.customImageDisplayField,
                customImageRepeatField: this.settings.customImageRepeatField,
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
        el.style.setProperty('--pixel-banner-content-start', `${contentStartPosition}px`);
    }

    getFolderSpecificSetting(filePath, settingName) {
        const folderPath = this.getFolderPath(filePath);
        for (const folderImage of this.settings.folderImages) {
            if (folderPath.startsWith(folderImage.folder)) {
                return folderImage[settingName];
            }
        }
        return undefined;
    }
}

// Add this helper function at the top level
function getFrontmatterValue(frontmatter, fieldNames) {
    if (!frontmatter || !Array.isArray(fieldNames)) return undefined;
    
    for (const fieldName of fieldNames) {
        if (fieldName in frontmatter) {
            const value = frontmatter[fieldName];
            // Convert 'true' and 'false' strings to actual boolean values
            if (typeof value === 'string' && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
                return value.toLowerCase() === 'true';
            }
            return value;
        }
    }
    return undefined;
}

