# Statement of Work: Adding Pixabay API Option

## Objective
Add an option for users to choose between Pexels and Pixabay APIs for fetching images in the Pixel Banner plugin.

## Tasks

### 1. Update Settings
- [x] Modify `DEFAULT_SETTINGS` in `src/settings.js` to include new fields for `pexelsApiKey` and `pixabayApiKey`
- [x] Update `PixelBannerSettingTab` class to add a dropdown for API provider selection
- [x] Ensure both API keys are saved and used based on the selected provider

### 2. Update Main Plugin Logic
- [x] Modify `src/main.js` to handle both Pexels and Pixabay API calls
- [x] Create a new method `fetchPixabayImage` similar to `fetchPexelsImage`
- [x] Update `getImageUrl` method to use the correct API based on user selection
- [x] Ensure existing Pexels functionality remains unchanged
- [x] Implement retrieval of multiple images and random selection for Pixabay
- [x] Implement fallback mechanism using default keywords for Pixabay

### 3. API Integration
- [x] Implement Pixabay API call with proper error handling
- [x] Ensure rate limiting is respected for both APIs
- [x] Map Pixabay response to match the structure used for Pexels

### 4. User Interface Updates
- [x] Update the settings tab UI to include the new API provider dropdown
- [x] Adjust the API key input field label based on the selected provider

### 5. Documentation Updates
- [ ] Update `README.md` to include information about the new Pixabay option
- [ ] Add any new settings or options to the documentation

### 6. Testing
- [ ] Test the plugin with both Pexels and Pixabay APIs
- [ ] Ensure existing Pexels functionality remains unchanged
- [ ] Test error handling and edge cases for both APIs
- [ ] Verify that multiple images are retrieved and randomly selected for Pixabay
- [ ] Test the fallback mechanism using default keywords for Pixabay

### 7. Version Update
- [ ] Update `manifest.json` with new version number
- [ ] Update `CHANGELOG.md` with details of the new feature

### 8. Code Cleanup and Optimization
- [x] Refactor code to maintain readability with the new feature
- [x] Optimize any shared functionality between the two APIs

### 9. Final Review
- [ ] Conduct a final code review to ensure all changes are correct and maintain existing functionality
- [ ] Test the plugin in various scenarios to ensure stability
