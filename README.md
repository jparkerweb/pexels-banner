# 🚩 Pixel Banner for Obsidian

Pixel Banner is a plugin for Obsidian that allows you to automatically add beautiful banner images to your notes using the Pexels/Pixabay APIs, direct URLs, or folder-specific settings. Enhance your note-taking experience with visually appealing headers that provide context and improve the overall aesthetics of your notes.

## Features

- Automatically fetch and display banner images from Pexels/Pixabay based on keywords
- Use direct URLs for custom images
- Use local images from your vault
- Use Obsidian internal links to images
- Set folder-specific default banner images
- Customize image size and orientation
- Set default keywords for when no specific keyword is provided
- Adjust vertical position of the banner image globally, per folder, or per note
- Customize frontmatter field names
- Set a custom start position for the content below the banner image
- Set the banner image display to cover or contain and adjust wrapping
- Seamless integration with Obsidian's interface

## Installation

1. Open Obsidian and go to Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click on Browse and search for "Pexels Banner" or "Pixel Banner"
4. Install the plugin and enable it

### Manual Installation
- Unzip the [latest release](https://github.com/jparkerweb/pixel-banner/releases/latest) into your `<vault>/.obsidian/plugins/` folder.

## Usage

1. Obtain a free API key from [Pexels](https://www.pexels.com/api/) or [Pixabay](https://pixabay.com/api/docs/)
2. In Obsidian, go to Settings > Pixel Banner and enter your API key(s)
3. In any note, add a `banner` field to the frontmatter with keywords for the desired image, a direct URL, a path to a local image, or an Obsidian internal link:

```yaml
---
banner: blue turtle
---

# Or use a direct URL:

---
banner: https://example.com/image.jpg
---

# Or use a local image:

---
banner: /path/to/local/image.jpg
---

# Or use an Obsidian internal link:

---
banner: [[path/to/internal/image.jpg]]
---

# Specify a custom y-position for the image (0-100) and content start position (in pixels):

---
banner: nature
banner-y: 30
content-start: 90
---

# Specify a custom field name for the banner and y-position:

---
my-banner: sunset
my-y-pos: 60
---

# Specify a custom display mode (cover or contain) and repeat (true or false):

---
banner: ocean
banner-display: cover
banner-repeat: true
---
```

### Folder-Specific Banners

You can set default banner images for entire folders:

1. Go to Settings > Pixel Banner
2. Scroll down to the "Folder Images" section
3. Click "Add Folder Image"
4. Enter the folder path, image URL or keyword, and Y-position
5. Repeat for additional folders as needed

Folder-specific settings will apply to all notes in that folder (and subfolders) that don't have their own banner specified in the frontmatter.

## Configuration

In the plugin settings, you can customize:

- Image size (small, medium, large)
- Image orientation (landscape, portrait, square)
- Number of images to fetch (1-50)
- Default keywords for when no specific keyword is provided
- Global y-position of the banner image (0-100)
- Custom field names for banner and Y-position in frontmatter
- Folder-specific default banner images

The global y-position can be overridden on a per-note basis using the `banner-y` frontmatter field (or your custom field name).

### Custom Field Names

You can customize the frontmatter field names used for each setting, and even define multiple names for each field:

1. Go to Settings > Pixel Banner
2. Scroll down to the "Custom Field Names" section
3. Enter your preferred field names for each setting, separated by commas
4. Use any of the defined field names in your frontmatter

For example, if you set the banner field names to "banner, header-image, cover" and the Y-position field names to "banner-y, y-pos", you could use any of these variations in your frontmatter:

```yaml
---
header-image: sunset
banner-y: 60
---
```

### Content Start Position

You can set a custom start position for the content below the banner image:

1. Go to Settings > Pixel Banner
2. Scroll down to the "Content Start Position" section
3. Enter a value (in pixels) to adjust where the content starts below the banner
4. This setting can be overridden on a per-note basis using the `content-start` frontmatter field

For example, to set a custom start position in your frontmatter:

```yaml
---
banner: nature
content-start: 200
---
```

## Example Note Screenshot

![example](example.jpg)

## Settings Screenshot

![settings-1](img/settings-1.jpg)

![settings-2](img/settings-2.jpg)

![settings-3](img/settings-3.jpg)

![settings-4](img/settings-4.jpg)

## Feedback and Support

If you encounter any issues or have suggestions for improvements, please [open an issue](https://github.com/jparkerweb/pixel-banner/issues) on the GitHub repository.

## Credits

This plugin optionally uses the [Pexels](https://www.pexels.com/api/) and [Pixabay](https://pixabay.com/api/docs/) APIs to fetch images. Special thanks to Pexels / Pixabay for providing this service.
