# Image Editing Features

This document describes the image editing capabilities integrated into the document scanning application.

## Overview

The image editing system provides users with tools to enhance and modify captured images before they are converted to PDF and processed by the backend. This improves OCR accuracy and document quality.

## Architecture

### Components

1. **ImageEditor Component** (`frontend/src/components/ImageEditor.jsx`)
   - Modal-based editing interface
   - Provides real-time preview of edits
   - Handles user interactions for various editing tools

2. **ImageEditor Service** (`frontend/src/services/imageEditor.js`)
   - Core image processing logic
   - Handles manipulation operations using expo-image-manipulator
   - Provides utility functions for cropping, rotation, and filters

3. **Integration Points**
   - **Camera Screen**: Immediate editing after capture
   - **PageReview Screen**: Edit existing captured pages

## Features

### 1. Rotation
- 90-degree clockwise and counterclockwise rotation
- Maintains image quality during rotation
- Preserves aspect ratio

### 2. Cropping
- **Aspect Ratio Presets**:
  - Free-form cropping
  - A4 (210:297)
  - Letter (8.5:11)
  - Legal (8.5:14)
  - Square (1:1)
- Automatic centering of crop area
- Maintains resolution

### 3. Color Adjustments
- **Brightness**: -100 to +100 range
- **Contrast**: -100 to +100 range
- **Grayscale Filter**: Convert to black and white
- Real-time preview of adjustments

### 4. Auto-Enhance
- One-tap optimization for document scanning
- Improves text readability
- Optimizes for OCR processing

## User Flow

### After Capture Flow
1. User captures image with camera
2. ImageEditor modal automatically appears
3. User can:
   - Apply edits using available tools
   - Preview changes in real-time
   - Save edited image or cancel
4. Edited image is added to capture collection
5. User continues with normal flow

### From PageReview Flow
1. User taps "Edit" on any captured page
2. ImageEditor modal opens with existing image
3. User can modify previously edited images
4. Changes are saved back to the collection

## Technical Implementation

### Image Processing Pipeline

```
Original Image → Apply Edits → Generate Thumbnail → Update Collection
```

### Edit Operations

```javascript
const edits = {
  rotation: 90,           // Rotation in degrees
  crop: {                 // Crop dimensions
    originX: 100,
    originY: 50,
    width: 800,
    height: 600
  },
  brightness: 20,         // Brightness adjustment (-100 to 100)
  contrast: 10,           // Contrast adjustment (-100 to 100)
  grayscale: true         // Grayscale filter
};
```

### File Management

- **Original Images**: Stored in device cache
- **Edited Images**: Create new files, preserve originals
- **Thumbnails**: Generated for UI display
- **Cleanup**: Automatic cleanup of temporary files

## Performance Considerations

### Memory Management
- Images are processed at reasonable resolutions (max 1920px width)
- Thumbnails are compressed for efficient display
- Large images are downsampled before processing

### Processing Time
- Rotation and cropping: Fast operations (< 1 second)
- Color adjustments: Moderate speed (1-2 seconds)
- Auto-enhance: Quick optimization (< 1 second)

### Storage
- Edited images maintain similar file sizes to originals
- Thumbnails are significantly smaller (~50KB)
- Temporary files are cleaned up automatically

## Integration with Existing Flow

### Camera Integration
```javascript
// In Camera.jsx
const handleCapture = async () => {
  const photo = await cameraRef.current.takePictureAsync();
  setPendingCapture(captureData);
  setEditingImage(photo?.uri); // Opens ImageEditor
};
```

### PageReview Integration
```javascript
// In PageReview.jsx
<TouchableOpacity onPress={() => {
  setEditingImage(cap.uri);
  setEditingIndex(index);
}}>
  <Text>Edit</Text>
</TouchableOpacity>
```

## Error Handling

### Common Issues
1. **Insufficient Memory**: Graceful degradation to lower quality
2. **Corrupted Images**: Fallback to original image
3. **Processing Failures**: User notification and retry options
4. **Storage Issues**: Cleanup and retry mechanisms

### Recovery Strategies
- Auto-save progress during editing
- Recovery from temporary files
- Fallback to original image if editing fails

## Future Enhancements

### Planned Features
1. **Advanced Color Correction**
   - White balance adjustment
   - Saturation control
   - Hue adjustment

2. **Perspective Correction**
   - Automatic document straightening
   - Corner detection and correction
   - Perspective transform

3. **Batch Operations**
   - Apply edits to multiple images
   - Bulk enhancement
   - Consistent formatting

4. **AI-Powered Enhancements**
   - Automatic document detection
   - Smart cropping
   - Quality assessment

### Technical Improvements
1. **GPU Acceleration**: Use OpenGL for faster processing
2. **Progressive Loading**: Show preview during processing
3. **Cloud Processing**: Offload heavy operations to backend
4. **Undo/Redo**: Maintain edit history

## Testing

### Test Cases
1. **Basic Operations**: Rotate, crop, adjust colors
2. **Edge Cases**: Very large/small images, unusual aspect ratios
3. **Performance**: Memory usage, processing time
4. **Integration**: Camera flow, PageReview flow
5. **Error Recovery**: Network issues, storage full, crashes

### Manual Testing Checklist
- [ ] Capture and edit image successfully
- [ ] Apply all edit operations
- [ ] Test with different image sizes
- [ ] Verify thumbnail generation
- [ ] Test cancel and save operations
- [ ] Edit from PageReview screen
- [ ] Test with poor quality images
- [ ] Verify memory usage during editing
- [ ] Test error conditions

## Dependencies

### Required Packages
- `expo-image-manipulator`: Core image processing
- `react-native`: UI components and navigation
- `react-native-slider`: Adjustment controls

### Optional Enhancements
- `react-native-image-filter-kit`: Advanced filters
- `react-native-vision-camera`: Enhanced camera features
- `react-native-fs`: File system operations

## API Reference

### ImageEditor Component Props

```javascript
<ImageEditor
  visible={boolean}           // Modal visibility
  imageUri={string}          // Image to edit
  onSave={function}          // Save callback
  onCancel={function}        // Cancel callback
  initialEdits={object}      // Previous edits to restore
/>
```

### ImageEditor Service Methods

```javascript
// Apply comprehensive edits
await imageEditor.applyEdits(uri, edits);

// Auto-enhance image
await imageEditor.autoEnhance(uri);

// Create thumbnail
await imageEditor.createThumbnail(uri, maxWidth);

// Calculate crop dimensions
imageEditor.calculateCropDimensions(dimensions, ratio);
```

## Troubleshooting

### Common Issues

**Issue**: Edits not applying correctly
**Solution**: Check edit validation, ensure proper format

**Issue**: Memory crashes during editing
**Solution**: Reduce image resolution before processing

**Issue**: Slow processing times
**Solution**: Implement progressive loading, show loading indicators

**Issue**: Thumbnails not updating
**Solution**: Regenerate thumbnails after edits, clear cache

### Debug Information

Enable debug logging:
```javascript
// In imageEditor.js
console.log('Applying edits:', edits);
console.log('Processing result:', result);
```

Monitor memory usage:
```javascript
// Check available memory before processing
const memoryInfo = await getMemoryInfo();
```

## Security Considerations

### Image Data
- All processing happens locally on device
- No sensitive data transmitted during editing
- Temporary files are securely managed

### File Access
- Proper permissions for file system access
- Secure cleanup of temporary files
- No unauthorized file access