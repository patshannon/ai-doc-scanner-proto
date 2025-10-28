// Minimal OCR stub for prototype.
// In MVP, replace with ML Kit (on-device) integration.

export async function runOcr(capture) {
  // Do NOT log OCR text per security guidance.
  // Return a stable, sample OCR text for now.
  const sample = `INVOICE\nAcorn Design\nInvoice No: 8123\nTotal Due: $543.20\nDate: 2025-10-26`;
  return Promise.resolve(sample);
}

