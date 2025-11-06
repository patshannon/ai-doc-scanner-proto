// Generate PDF from camera image on the frontend.
import { printToFileAsync } from 'expo-print';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export async function generatePdfFromImage(uri, title) {
  try {
    // Convert the image to base64 so it can be embedded in HTML
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

export async function convertPdfToDataUri(pdfUri) {
  try {
    const { File } = await import('expo-file-system');
    const file = new File([pdfUri], 'document.pdf');
    const base64 = await file.text().then(text => 
      Buffer.from(text).toString('base64')
    );
    return `data:application/pdf;base64,${base64}`;
  } catch (error) {
    // Fallback to legacy API
    try {
      const { readAsStringAsync } = await import('expo-file-system/legacy');
      const base64 = await readAsStringAsync(pdfUri, { encoding: 'base64' });
      return `data:application/pdf;base64,${base64}`;
    } catch (legacyError) {
      throw new Error(`Failed to convert PDF to data URI: ${error.message}`);
    }
  }
}

