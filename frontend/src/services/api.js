// Backend API client for /analyze.
// Reads base URL from EXPO_PUBLIC_API_BASE_URL; if absent, returns a mocked response.

import { auth } from './firebase.js';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const USE_MOCKS = (process.env.EXPO_PUBLIC_USE_MOCKS || '').toLowerCase() === 'true';

export async function analyze(payload) {
  const { ocrText, exifDate, thumbBase64, locale } = payload;

  if (!API_BASE || USE_MOCKS) {
    // Mock response when no backend configured yet.
    return Promise.resolve({
      docType: 'invoice',
      title: '2025-10-26_Invoice_Acorn-Design_#8123',
      date: '2025-10-26',
      tags: ['finance', 'invoice', 'acorn-design'],
      fields: { invoiceNumber: '8123', vendor: 'Acorn Design', total: 543.2, currency: 'CAD' },
      folderPath: 'Documents/Invoices/2025',
      confidence: 0.84
    });
  }

  const idToken = await getIdTokenSafe();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ocrText, exifDate, thumbBase64, locale })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analyze failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getIdTokenSafe() {
  if (!auth || !auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch (_e) {
    return null;
  }
}

export async function ensureFolderPath(folderPath) {
  if (!API_BASE || USE_MOCKS) {
    return Promise.resolve({ folderPath, status: 'stub' });
  }
  const idToken = await getIdTokenSafe();
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(`${API_BASE}/ensureFolderPath`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ folderPath })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ensureFolderPath failed: ${res.status} ${text}`);
  }
  return res.json();
}
