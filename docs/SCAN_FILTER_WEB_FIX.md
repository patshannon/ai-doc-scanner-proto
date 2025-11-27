# Scan Filter Web Compatibility Fix

## Issue
The scan filter (grayscale + contrast enhancement) was not working on the production web app deployed to Firebase Hosting.

## Root Cause
Two platform-specific compatibility issues:

### 1. **Image Processing API Incompatibility**
The scan filter used React Native-specific libraries that don't work in web browsers:
- `Buffer` - Node.js module (not available in browsers)
- `jpeg-js` - Native image processing library (incompatible with web)
- `expo-file-system/legacy` - React Native API (not available on web)

### 2. **Image Load Event Structure**
The ImageEditor component accessed image dimensions using React Native's event structure:
```javascript
event.nativeEvent.source.width  // Only works on native
```

On web, image dimensions are accessed differently:
```javascript
event.target.naturalWidth  // Web API
```

## Solution

### Fix 1: Platform-Aware Scan Filter (`imageEditor.js`)
Added platform detection to use different implementations:

**For Web:**
- Uses HTML5 Canvas API
- Creates canvas element
- Draws image and extracts pixel data
- Applies the same `applyScanMatrix()` function
- Returns blob URL

**For Native (iOS/Android):**
- Keeps existing Buffer + jpeg-js implementation
- Uses FileSystem API for file operations

### Fix 2: Cross-Platform Image Dimensions (`ImageEditor.jsx`)
Updated `handleImageLoad` to safely extract dimensions from both platforms:

```javascript
if (event.nativeEvent?.source) {
  // React Native path
  ({ width, height } = event.nativeEvent.source);
} else if (event.target) {
  // Web path
  width = event.target.naturalWidth || event.target.width;
  height = event.target.naturalHeight || event.target.height;
}
```

## Files Modified
1. `/frontend/src/services/imageEditor.js` - Platform-aware scan filter implementation
2. `/frontend/src/components/ImageEditor.jsx` - Cross-platform image load handling

## Testing
✅ Web build successful  
✅ Deployed to Firebase Hosting: https://doc-ai-proto.web.app  
✅ Scan filter now works on all platforms (web, iOS, Android)

## Visual Result
The scan filter now correctly applies:
- Grayscale conversion
- Contrast enhancement (1.2x factor)
- Document-optimized processing

Results are visually identical across all platforms since both implementations use the same `applyScanMatrix()` function.
