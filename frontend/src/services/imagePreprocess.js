// Image preprocessing utilities to optimize images for OCR.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Preprocess an image for optimal OCR results.
 * - Ensures reasonable dimensions (OCR works better with images that aren't too large or too small)
 * - Maintains aspect ratio
 * - Returns high-quality JPEG for ML Kit processing
 *
 * @param {string} uri - Image URI to preprocess
 * @returns {Promise<string>} - URI of the preprocessed image
 */
export async function preprocessForOcr(uri) {
  if (!uri) {
    throw new Error('Image URI is required for preprocessing');
  }

  try {
    // Resize to a reasonable width for OCR (1920px is a good balance)
    // ML Kit performs well with images around this size
    // Too large = slow processing, too small = missed text
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }],
      {
        compress: 0.9,
        format: SaveFormat.JPEG,
        base64: false
      }
    );

    return manipulated.uri;
  } catch (error) {
    console.error('Image preprocessing failed:', error);
    // If preprocessing fails, return original URI
    // Better to attempt OCR with original than to fail completely
    return uri;
  }
}

/**
 * Apply basic image enhancements for better OCR accuracy.
 * This is optional and can be extended with more sophisticated processing.
 *
 * @param {string} uri - Image URI to enhance
 * @returns {Promise<string>} - URI of the enhanced image
 */
export async function enhanceForOcr(uri) {
  if (!uri) {
    throw new Error('Image URI is required for enhancement');
  }

  try {
    // For now, just ensure proper sizing and quality
    // Future enhancements could include:
    // - Contrast adjustment
    // - Sharpening
    // - Noise reduction
    // - Perspective correction
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }],
      {
        compress: 0.95,
        format: SaveFormat.JPEG,
        base64: false
      }
    );

    return manipulated.uri;
  } catch (error) {
    console.error('Image enhancement failed:', error);
    return uri;
  }
}
