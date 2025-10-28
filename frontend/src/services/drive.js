// Minimal Drive + PDF stubs for prototype.
// Replace with Google Drive SDK integration and expo-print for real PDF.

export async function generatePdfFromImage(uri, title) {
  // Return a fake PDF blob-like object (or base64 string) for prototype.
  return Promise.resolve({
    name: `${title}.pdf`,
    mimeType: 'application/pdf',
    data: 'JVBERi0xLjQgCjEgMCBvYmoK' // truncated base64 header placeholder
  });
}

export async function uploadToDriveAndIndex(pdf, analysis) {
  // Stub upload: pretend success and return IDs/links.
  const fakeId = 'drive-file-id-demo';
  const link = 'https://drive.google.com/file/d/drive-file-id-demo/view';

  // In the real implementation: use Drive API to upload, then write Firestore doc.
  // Respect privacy: do not log OCR text or PII.

  return Promise.resolve({
    fileId: fakeId,
    webViewLink: link,
    name: pdf?.name || analysis?.title || 'Document.pdf',
    metadata: analysis
  });
}

