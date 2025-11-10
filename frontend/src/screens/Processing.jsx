import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { generatePdfFromImages, convertPdfToDataUri } from '../services/drive.js';
import { analyzeDocument } from '../services/api.js';

export default function ProcessingScreen({ captures = [], googleAuth, onAnalyzed, onBack }) {
  const [status, setStatus] = useState('Preparing PDF');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const work = async () => {
      if (!captures.length) {
        setError('No pages to process');
        return;
      }
      try {
        setStatus('Building PDF from pages');
        const pdf = await generatePdfFromImages(
          captures,
          'document',
          ({ current, total }) => {
            if (!cancelled) {
              setStatus(`Preparing page ${current} of ${total}`);
            }
          }
        );

        setStatus('Converting PDF to data URI');
        const pdfDataUri = await convertPdfToDataUri(pdf.uri);

        setStatus('Analyzing PDF with AI');
        const googleAccessToken = googleAuth?.accessToken || null;
        // Request analysis only; UploadScreen will send the final upload call.
        const res = await analyzeDocument(pdfDataUri, googleAccessToken);

        if (!cancelled) {
          onAnalyzed({
            ...res,
            pdfDataUri,
            pageCount: captures.length
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Processing failed');
        }
      }
    };
    work();
    return () => {
      cancelled = true;
    };
  }, [captures, googleAuth, onAnalyzed]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Error: {error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator />
      <Text style={styles.status}>{status}…</Text>
      <TouchableOpacity style={styles.cancelBtn} onPress={onBack}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  status: { color: '#333' },
  err: { color: '#b00020' },
  btn: { backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnText: { color: '#fff' },
  cancelBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  cancelText: { color: '#666' }
});
