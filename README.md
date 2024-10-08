# 🚩 Pexels Banner for Obsidian

Pexels Banner is a plugin for Obsidian that allows you to automatically add beautiful banner images to your notes using the Pexels API or direct URLs. Enhance your note-taking experience with visually appealing headers that provide context and improve the overall aesthetics of your notes.

## Features

- Automatically fetch and display banner images from Pexels based on keywords
- Use direct URLs for custom images
- Use local images from your vault
- Use Obsidian internal links to images
- Customize image size and orientation
- Set default keywords for when no specific keyword is provided
- Adjust vertical position of the banner image globally or per note
- Seamless integration with Obsidian's interface

## Installation

1. Open Obsidian and go to Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click on Browse and search for "Pexels Banner"
4. Install the plugin and enable it

## Usage

1. Obtain a free API key from [Pexels](https://www.pexels.com/api/)
2. In Obsidian, go to Settings > Pexels Banner and enter your API key
3. In any note, add a `pexels-banner` field to the frontmatter with keywords for the desired image, a direct URL, a path to a local image, or an Obsidian internal link:

```yaml
---
pexels-banner: blue turtle
---

# Or use a direct URL:

---
pexels-banner: https://example.com/image.jpg
---

# Or use a local image:

---
pexels-banner: /path/to/local/image.jpg
---

# Or use an Obsidian internal link:

---
pexels-banner: [[path/to/internal/image.jpg]]
---

# Specify a custom y-position for the image (0-100):

---
pexels-banner: nature
pexels-banner-y-position: 30
---
```

## Configuration

In the plugin settings, you can customize:

- Image size (small, medium, large)
- Image orientation (landscape, portrait, square)
- Number of images to fetch (1-50)
- Default keywords for when no specific keyword is provided
- Global y-position of the banner image (0-100)

The global y-position can be overridden on a per-note basis using the `pexels-banner-y-position` frontmatter field.

## Example Note Screenshot

![example](example.jpg)

## Feedback and Support

If you encounter any issues or have suggestions for improvements, please [open an issue](https://github.com/jparkerweb/pexels-banner/issues) on the GitHub repository.

## Credits

This plugin uses the [Pexels API](https://www.pexels.com/api/) to fetch images. Special thanks to Pexels for providing this service.
