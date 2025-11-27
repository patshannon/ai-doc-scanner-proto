import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { Image, Platform } from 'react-native';
import jpeg from 'jpeg-js';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

/**
 * Advanced image editing service for document scanning
 * Extends basic preprocessing with comprehensive editing capabilities
 */

export class ImageEditor {
  constructor() {
    this.aspectRatios = {
      free: null,
      letter: { width: 8.5, height: 11 },
      a4: { width: 210, height: 297 },
      legal: { width: 8.5, height: 14 },
      square: { width: 1, height: 1 }
    };
  }

  /**
   * Apply comprehensive edits to an image
   * @param {string} uri - Original image URI
   * @param {Object} edits - Edit operations to apply
   * @returns {Promise<string>} - URI of edited image
   */
  async applyEdits(uri, edits, options = { skipFilter: false }) {
    if (!uri) {
      throw new Error('Image URI is required');
    }

    console.log('[ImageEditor] Applying edits:', {
      scanMode: edits.scanMode,
      skipFilter: options.skipFilter,
      rotation: edits.rotation,
      hasCrop: !!edits.crop
    });

    try {
      const actions = [];

      // Apply rotation
      if (edits.rotation && edits.rotation !== 0) {
        actions.push({ rotate: edits.rotation });
      }

      // Apply crop if specified
      if (edits.crop) {
        actions.push({
          crop: {
            originX: edits.crop.originX,
            originY: edits.crop.originY,
            width: edits.crop.width,
            height: edits.crop.height
          }
        });
      }

      // Apply flip if needed
      if (edits.flipHorizontal) {
        actions.push({ flip: 'horizontal' });
      }
      if (edits.flipVertical) {
        actions.push({ flip: 'vertical' });
      }

      // Determine compression settings based on scan mode
      const compressSettings = edits.scanMode
        ? {
            compress: 0.95, // Higher quality for scan mode
            format: SaveFormat.JPEG,
            base64: false
          }
        : {
            compress: 0.9,
            format: SaveFormat.JPEG,
            base64: false
          };

      // Apply transformations
      const result = await manipulateAsync(
        uri,
        actions,
        compressSettings
      );

      console.log('[ImageEditor] Transformations applied, result URI:', result.uri);

      // In scan mode we run a local grayscale/contrast pass so the preview and exported image feel scans-like
      // We skip this if skipFilter is true (for fast previews)
      if (edits.scanMode && !options.skipFilter) {
        console.log('[ImageEditor] Scan mode enabled, applying scan filter');
        const scanUri = await this.applyScanFilter(result.uri);
        console.log('[ImageEditor] Scan filter complete, returning:', scanUri);
        return scanUri;
      }

      if (edits.scanMode && options.skipFilter) {
        console.log('[ImageEditor] Scan mode enabled but skipFilter is true, skipping scan filter');
      } else if (!edits.scanMode) {
        console.log('[ImageEditor] Scan mode disabled, skipping scan filter');
      }

      return result.uri;
    } catch (error) {
      console.error('[ImageEditor] Error applying edits:', error);
      throw new Error(`Failed to apply edits: ${error.message}`);
    }
  }

  async applyScanFilter(uri) {
    if (!uri) {
      console.log('[ScanFilter] No URI provided, skipping filter');
      return uri;
    }

    console.log('[ScanFilter] Platform:', Platform.OS);
    console.log('[ScanFilter] Input URI:', uri);

    // Use different implementation for web vs native
    if (Platform.OS === 'web') {
      console.log('[ScanFilter] Using web implementation');
      return this.applyScanFilterWeb(uri);
    } else {
      console.log('[ScanFilter] Using native implementation');
      return this.applyScanFilterNative(uri);
    }
  }

  /**
   * Web-compatible scan filter using Canvas API
   */
  async applyScanFilterWeb(uri) {
    console.log('[ScanFilterWeb] Starting web scan filter');
    try {
      return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        
        console.log('[ScanFilterWeb] Creating image element, loading:', uri);
        
        img.onload = () => {
          console.log('[ScanFilterWeb] Image loaded successfully');
          console.log('[ScanFilterWeb] Image dimensions:', img.width, 'x', img.height);
          
          try {
            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            console.log('[ScanFilterWeb] Canvas created:', canvas.width, 'x', canvas.height);
            
            // Draw image
            ctx.drawImage(img, 0, 0);
            console.log('[ScanFilterWeb] Image drawn to canvas');
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            console.log('[ScanFilterWeb] Image data extracted, processing', data.length, 'bytes');
            
            // Apply scan matrix (grayscale + contrast)
            this.applyScanMatrix(data);
            console.log('[ScanFilterWeb] Scan matrix applied');
            
            // Put modified data back
            ctx.putImageData(imageData, 0, 0);
            console.log('[ScanFilterWeb] Modified data put back to canvas');
            
            // Convert to blob
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                console.log('[ScanFilterWeb] Blob created successfully, size:', blob.size, 'bytes');
                console.log('[ScanFilterWeb] Output URL:', url);
                resolve(url);
              } else {
                console.warn('[ScanFilterWeb] Canvas toBlob failed, returning original uri');
                resolve(uri);
              }
            }, 'image/jpeg', 0.95);
          } catch (error) {
            console.error('[ScanFilterWeb] Canvas processing failed:', error);
            resolve(uri);
          }
        };
        
        img.onerror = (error) => {
          console.error('[ScanFilterWeb] Image load failed:', error);
          resolve(uri);
        };
        
        img.src = uri;
      });
    } catch (error) {
      console.error('[ScanFilterWeb] Outer error:', error);
      return uri;
    }
  }

  /**
   * Native scan filter using jpeg-js
   */
  async applyScanFilterNative(uri) {
    if (Platform.OS === 'web') {
      console.warn('[ScanFilter] Native implementation called on web, falling back to web implementation');
      return this.applyScanFilterWeb(uri);
    }

    try {
      const readBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      if (!readBase64) {
        return uri;
      }

      const buffer = Buffer.from(readBase64, 'base64');
      const decoded = jpeg.decode(buffer, { useTArray: true });
      if (!decoded || !decoded.data) {
        return uri;
      }

      this.applyScanMatrix(decoded.data);

      const encoded = jpeg.encode(
        {
          data: decoded.data,
          width: decoded.width,
          height: decoded.height
        },
        95
      );

      const filteredBase64 = Buffer.from(encoded.data).toString('base64');
      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const scanUri = `${cacheDir}scan-${Date.now()}.jpg`;

      await FileSystem.writeAsStringAsync(scanUri, filteredBase64, {
        encoding: FileSystem.EncodingType.Base64
      });

      return scanUri;
    } catch (error) {
      console.warn('Unable to apply scan filter (native), returning original uri', error);
      return uri;
    }
  }

  applyScanMatrix(data) {
    // Reduced contrast and brightness to prevent washing out text
    const contrastFactor = 1.2;
    const brightnessOffset = 0.0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      let normalized = luma / 255;
      normalized = ((normalized - 0.5) * contrastFactor) + 0.5;
      normalized += brightnessOffset;
      normalized = Math.min(1, Math.max(0, normalized));
      const finalValue = Math.round(normalized * 255);
      data[i] = finalValue;
      data[i + 1] = finalValue;
      data[i + 2] = finalValue;
      // Preserve alpha channel
      data[i + 3] = data[i + 3] ?? 255;
    }
  }

  /**
   * Auto-enhance image for document scanning
   * Applies document-optimized settings for better text readability
   * @param {string} uri - Image URI
   * @param {boolean} scanMode - Whether to apply scan mode enhancements
   * @returns {Promise<string>} - Enhanced image URI
   */
  async autoEnhance(uri, scanMode = false) {
    try {
      // Scan mode uses higher quality compression for document preservation
      const compressQuality = scanMode ? 0.95 : 0.85;

      const result = await manipulateAsync(
        uri,
        [],
        {
          compress: compressQuality,
          format: SaveFormat.JPEG,
          base64: false
        }
      );

      return result.uri;
    } catch (error) {
      console.error('Error auto-enhancing image:', error);
      return uri;
    }
  }

  /**
   * Calculate crop dimensions for aspect ratio
   * @param {Object} imageDimensions - {width, height} of image
   * @param {string} aspectRatio - Aspect ratio key
   * @returns {Object} - Crop parameters
   */
  calculateCropDimensions(imageDimensions, aspectRatio) {
    const { width: imgWidth, height: imgHeight } = imageDimensions;
    
    if (aspectRatio === 'free') {
      return null;
    }
    
    const ratio = this.aspectRatios[aspectRatio];
    if (!ratio) {
      return null;
    }
    
    const targetRatio = ratio.width / ratio.height;
    const imageRatio = imgWidth / imgHeight;
    
    let cropWidth, cropHeight;
    
    if (imageRatio > targetRatio) {
      // Image is wider than target ratio
      cropHeight = imgHeight;
      cropWidth = cropHeight * targetRatio;
    } else {
      // Image is taller than target ratio
      cropWidth = imgWidth;
      cropHeight = cropWidth / targetRatio;
    }
    
    const originX = (imgWidth - cropWidth) / 2;
    const originY = (imgHeight - cropHeight) / 2;
    
    return {
      originX,
      originY,
      width: cropWidth,
      height: cropHeight
    };
  }

  /**
   * Get image dimensions
   * @param {string} uri - Image URI
   * @returns {Promise<Object>} - {width, height}
   */
  async getImageDimensions(uri) {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });
  }

  /**
   * Create thumbnail for preview
   * @param {string} uri - Image URI
   * @param {number} maxWidth - Maximum width for thumbnail
   * @returns {Promise<string>} - Thumbnail URI
   */
  async createThumbnail(uri, maxWidth = 480) {
    try {
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: maxWidth } }],
        {
          compress: 0.7,
          format: SaveFormat.JPEG,
          base64: true
        }
      );
      
      return `data:image/jpeg;base64,${result.base64}`;
    } catch (error) {
      console.error('Error creating thumbnail:', error);
      return null;
    }
  }

  /**
   * Validate edit parameters
   * @param {Object} edits - Edit operations
   * @returns {boolean} - Whether edits are valid
   */
  validateEdits(edits) {
    if (!edits || typeof edits !== 'object') {
      return false;
    }

    // Validate rotation
    if (edits.rotation !== undefined &&
        (typeof edits.rotation !== 'number' ||
         edits.rotation < -180 ||
         edits.rotation > 180)) {
      return false;
    }

    // Validate scan mode
    if (edits.scanMode !== undefined && typeof edits.scanMode !== 'boolean') {
      return false;
    }

    // Validate crop
    if (edits.crop) {
      const { originX, originY, width, height } = edits.crop;
      if (typeof originX !== 'number' || typeof originY !== 'number' ||
          typeof width !== 'number' || typeof height !== 'number' ||
          originX < 0 || originY < 0 || width <= 0 || height <= 0) {
        return false;
      }
    }

    return true;
  }
}

// Export singleton instance
export const imageEditor = new ImageEditor();

// Export convenience functions
export const applyEdits = (uri, edits) => imageEditor.applyEdits(uri, edits);
export const autoEnhance = (uri) => imageEditor.autoEnhance(uri);
export const createThumbnail = (uri, maxWidth) => imageEditor.createThumbnail(uri, maxWidth);
export const calculateCropDimensions = (dimensions, ratio) =>
  imageEditor.calculateCropDimensions(dimensions, ratio);
