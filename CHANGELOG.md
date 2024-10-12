# Changelog

All notable changes to the Pexels Banner plugin will be documented in this file.

## [1.2.0] - 2023-05-28

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

## [1.1.0] - 2023-05-15

### Added
- Support for local images from the vault.
- Support for Obsidian internal links to images.

### Changed
- Improved error handling and logging.

## [1.0.0] - 2023-05-01

### Added
- Initial release of the Pexels Banner plugin.
- Fetch and display banner images from Pexels based on keywords.
- Support for direct image URLs.
- Customizable image size and orientation.
- Adjustable vertical position of the banner image.
- Default keywords for when no specific keyword is provided.
