# Changelog

All notable changes to the Pixel Banner plugin will be documented in this file.

## [2.2.1] - 2024-10-24

### Added
- Banner Height: Customize the height of banner images (100-2500 pixels; default 350)
  - Global default setting
  - Folder-specific override
  - Per-note override via frontmatter
- Banner Fade Effect: Control the fade transparency (-1500 to 100)
  - Global default setting
  - Folder-specific override
  - Per-note override via frontmatter
- New custom field names for banner height and fade effect
- Updated settings interface with slider controls for fade effect
- Direct Children Only option for Folder Images
  - Enable this option to apply the banner settings only to the _direct children_ of the specified folder, excluding subfolders.

### Changed
- Improved settings UI with better organization of controls
- Enhanced visual feedback for settings changes
- Updated examples to showcase new banner height and fade options

### Fixed
- Fixed issue where banner image was not being displayed if it was an interal link not wrapped in quotes

## [2.1.0] - 2024-10-22

### Added
- Multiple custom field names: Users can now define multiple names for each frontmatter field
- Comma-separated field name definitions in settings
- Validation to prevent duplicate field names across all settings
- Validation to prevent spaces within individual field names
- Enhanced settings UI with clearer instructions for multiple field names
- Updated examples in the settings tab to randomly showcase different field name options

### Changed
- Custom field names are now stored as arrays instead of single strings
- Improved validation feedback when entering invalid field names
- Updated documentation to reflect multiple field name support

## [2.0.0] - 2024-10-21

### Added
- Rebrand to Pixel Banner
- Add support for Pixabay API
- Save and switch between API providers in settings

## [1.5.0] - 2024-10-19

### Added
- Add Banner Image Display options: cover, contain, and auto
  - Allow Image Repeat when "contain" is selected
- Updated settings interface

## [1.4.1] - 2024-10-19

### Bug Fixes
- Fixed issue where banner images were not being displayed in embedded notes

## [1.4.0] - 2024-10-18

### Added
- Content Start Position: Allow users to set a custom start position for content below the banner image
- New setting in the plugin configuration for Content Start Position
- Frontmatter field `content-start-position` to override the global setting on a per-note basis
- Added compatibility with Obsidian's lasted version release 1.7.2+ (deferred views)

### Known Issues
- Embedding notes with banner images is currently not supported, but will be in a future release

## [1.3.0] - 2024-10-12

### Added
- Folder-specific banner images: Set default banner images for entire folders
- Folder selection dialog: Improved UX for selecting folder paths in settings
- Automatic settings application: Changes in settings are now immediately applied to all open notes
- Reset button for default keywords: Added ability to reset default keywords to original values

### Changed
- Improved settings layout: Reorganized settings for better clarity and ease of use
- Enhanced API key description: Clarified when the Pexels API key is required
- Updated default keywords: Expanded the list of default keywords for more variety
- Improved input field layouts: API key and Default keywords inputs now span full width

### Fixed
- Cache invalidation: Resolved issues with cached images not updating when settings changed

## [1.2.0] - 2024-10-11

### Added
- Custom field names feature: Users can now customize the frontmatter field names for the banner and Y-position.
- New settings in the plugin configuration to set custom field names.
- Reset buttons for each custom field name setting.
- Validation to ensure custom field names are unique.

### Changed
- Updated the `updateBanner` and `handleMetadataChange` methods to work with custom field names.
- Improved documentation in README.md to explain the new custom field names feature.

### Developer Notes
- Added new properties to the `DEFAULT_SETTINGS` object for custom field names.
- Modified the `PexelsBannerSettingTab` class to include new settings for custom field names.
- Implemented validation logic to prevent duplicate field names.

## [1.1.0] - 2023-10-09

### Added
- Support for local images from the vault.
- Support for Obsidian internal links to images.

### Changed
- Improved error handling and logging.

## [1.0.0] - 2024-09-23

### Added
- Initial release of the Pixel Banner plugin.
- Fetch and display banner images from Pexels based on keywords.
- Support for direct image URLs.
- Customizable image size and orientation.
- Adjustable vertical position of the banner image.
- Default keywords for when no specific keyword is provided.
