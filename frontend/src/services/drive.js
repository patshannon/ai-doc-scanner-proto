// Google Drive integration via backend API
import { uploadToDrive as uploadImageToBackend } from './ocr.js';
import { printToFileAsync } from 'expo-print';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export async function generatePdfFromImage(uri, title) {
  try {
    // First, convert the image to base64 so it can be embedded in HTML
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 2048 } }], // Resize to reasonable size for PDF
      { compress: 0.9, format: SaveFormat.JPEG, base64: true }
    );

    if (!manipulated?.base64) {
      throw new Error('Failed to convert image to base64');
    }

    // Create HTML with base64-embedded image to convert to PDF
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              width: 100%;
              height: 100%;
            }
            img {
              width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="data:image/jpeg;base64,${manipulated.base64}" alt="Document" />
        </body>
      </html>
    `;

    // Convert HTML to PDF
    const { uri: pdfUri } = await printToFileAsync({
      html,
      base64: false
    });

    return {
      name: `${title}.pdf`,
      mimeType: 'application/pdf',
      uri: pdfUri
    };
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

export async function uploadToDriveAndIndex(pdf, analysis, googleAccessToken = null) {
  // Upload PDF to Google Drive via backend API
  try {
    const filename = pdf?.name || `${analysis?.title || 'Document'}.pdf`;
    const mimeType = pdf?.mimeType || 'application/pdf';
    const folderPath = analysis?.folderPath || 'Documents/Other';

    // Create capture object with the PDF URI
    const capture = { uri: pdf?.uri };

    // Call backend upload endpoint with Google access token
    const result = await uploadImageToBackend(capture, filename, folderPath, googleAccessToken, mimeType);

    return {
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      name: filename,
      metadata: analysis,
      folderId: result.folderId
    };
  } catch (error) {
    console.error('Drive upload error:', error);
    throw new Error(`Failed to upload to Google Drive: ${error.message}`);
  }
}

