// Backend API client for /process-document.
// Reads base URL from EXPO_PUBLIC_API_BASE_URL; if absent, returns a mocked response.

import { auth } from './firebase.js';

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

export async function processDocument(pdfDataUri, googleAccessToken, skipUpload = false, selectedParentFolderId = null, userEdits = null) {
  if (!API_BASE || USE_MOCKS) {
    // Mock response when no backend configured yet.
    return Promise.resolve({
      title: '2025-10-26_Invoice_Acorn-Design_#8123',
      category: 'invoices',
      year: 2024,
      inputTokens: 1000,
      outputTokens: 50,
      estimatedCost: 0.00009,
      suggestedParentFolder: null,
      suggestedParentFolderId: null,
      availableParentFolders: [],
      finalFolderPath: 'Invoices/2024/'
    });
  }

  const idToken = await getIdTokenSafe();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const body = { pdfData: pdfDataUri };
  if (googleAccessToken) {
    body.googleAccessToken = googleAccessToken;
  }
  if (skipUpload) {
    body.skipUpload = skipUpload;
  }
  if (selectedParentFolderId) {
    body.selectedParentFolderId = selectedParentFolderId;
  }
  if (userEdits) {
    if (userEdits.title) body.title = userEdits.title;
    if (userEdits.category) body.category = userEdits.category;
    if (userEdits.year) body.year = userEdits.year;
  }

  const res = await fetch(`${API_BASE}/process-document`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Process document failed: ${res.status} ${text}`);
  }
  return res.json();
}
