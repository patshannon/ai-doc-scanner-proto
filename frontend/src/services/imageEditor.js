import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { Image } from 'react-native';
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
      a4: { width: 210, height: 297 },
      letter: { width: 8.5, height: 11 },
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
  async applyEdits(uri, edits) {
    if (!uri) {
      throw new Error('Image URI is required');
    }

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

      // In scan mode we run a local grayscale/contrast pass so the preview and exported image feel scans-like
      if (edits.scanMode) {
        const scanUri = await this.applyScanFilter(result.uri);
        return scanUri;
      }

      return result.uri;
    } catch (error) {
      console.error('Error applying edits:', error);
      throw new Error(`Failed to apply edits: ${error.message}`);
    }
  }

  async applyScanFilter(uri) {
    if (!uri) {
      return uri;
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
      console.warn('Unable to apply scan filter, returning original uri', error);
      return uri;
    }
  }

  applyScanMatrix(data) {
    const contrastFactor = 1.8;
    const brightnessOffset = 0.06;

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
