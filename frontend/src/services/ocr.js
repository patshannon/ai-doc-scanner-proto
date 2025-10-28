// Backend-based OCR for prototype (works with Expo Go).
// Sends image to backend for OCR processing using Tesseract.

import { preprocessForOcr } from './imagePreprocess.js';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { auth } from './firebase.js';
import { File } from 'expo-file-system';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const USE_MOCKS = (process.env.EXPO_PUBLIC_USE_MOCKS || '').toLowerCase() === 'true';

async function getIdTokenSafe() {
  if (!auth || !auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch (_e) {
    return null;
  }
}

/**
 * Run OCR on a captured image by sending it to the backend.
 * @param {Object} capture - Capture object with uri property
 * @returns {Promise<string>} - Extracted text from the image
 */
export async function runOcr(capture) {
  if (!capture?.uri) {
    throw new Error('Invalid capture: missing uri');
  }

  // If using mocks or no backend, return sample data
  if (!API_BASE || USE_MOCKS) {
    const sample = `INVOICE\nAcorn Design\nInvoice No: 8123\nTotal Due: $543.20\nDate: 2025-10-26`;
    return Promise.resolve(sample);
  }

  try {
    // Preprocess and convert image to base64
    const processedUri = await preprocessForOcr(capture.uri);
    const manipulated = await manipulateAsync(
      processedUri,
      [],
      { compress: 0.8, format: SaveFormat.JPEG, base64: true }
    );

    if (!manipulated?.base64) {
      throw new Error('Failed to convert image to base64');
    }

    // Send to backend OCR endpoint
    const response = await fetch(`${API_BASE}/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: `data:image/jpeg;base64,${manipulated.base64}`
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OCR request failed: ${response.status} ${text}`);
    }

    const result = await response.json();

    if (!result || !result.text) {
      console.warn('No text detected in image');
      return '';
    }

    // Do NOT log OCR text per security guidance
    return result.text;
  } catch (error) {
    console.error('OCR failed:', error);
    throw new Error(`OCR processing failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Upload a file to Google Drive.
 * @param {Object} capture - Capture object with uri property
 * @param {string} filename - Name for the file in Google Drive
 * @param {string} [folderPath] - Optional folder path like "Documents/2024/Receipts"
 * @param {string} [googleAccessToken] - Optional Google OAuth access token for user's Drive
 * @param {string} [mimeType] - MIME type of the file (default: 'image/jpeg')
 * @returns {Promise<Object>} - Upload result with fileId, webViewLink, folderId
 */
export async function uploadToDrive(capture, filename, folderPath = null, googleAccessToken = null, mimeType = 'image/jpeg') {
  if (!capture?.uri) {
    throw new Error('Invalid capture: missing uri');
  }

  // If using mocks or no backend, return mock data
  if (!API_BASE || USE_MOCKS) {
    return Promise.resolve({
      fileId: 'mock-file-id-123',
      webViewLink: 'https://drive.google.com/file/d/mock-file-id-123/view',
      folderId: folderPath ? 'mock-folder-id-456' : null
    });
  }

  try {
    let base64Data;

    // Handle PDF files differently from images
    if (mimeType === 'application/pdf') {
      // For PDFs, use the new File API to read and encode
      console.log('Reading PDF file from:', capture.uri);
      const file = new File(capture.uri);
      base64Data = await file.base64();
      console.log('PDF base64 length:', base64Data?.length);
    } else {
      // For images, use image manipulator
      const manipulated = await manipulateAsync(
        capture.uri,
        [],
        { compress: 0.8, format: SaveFormat.JPEG, base64: true }
      );

      if (!manipulated?.base64) {
        throw new Error('Failed to convert image to base64');
      }
      base64Data = manipulated.base64;
    }

    if (!base64Data) {
      throw new Error('Failed to convert file to base64');
    }

    // Send to backend upload endpoint
    const requestBody = {
      image: `data:${mimeType};base64,${base64Data}`,
      filename: filename,
      mimeType: mimeType
    };

    if (folderPath) {
      requestBody.folderPath = folderPath;
    }

    if (googleAccessToken) {
      requestBody.googleAccessToken = googleAccessToken;
    }

    // Get Firebase ID token for authentication
    const idToken = await getIdTokenSafe();
    const headers = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload request failed: ${response.status} ${text}`);
    }

    const result = await response.json();

    console.log('Upload successful:', result.webViewLink);
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    throw new Error(`Google Drive upload failed: ${error.message || 'Unknown error'}`);
  }
}

