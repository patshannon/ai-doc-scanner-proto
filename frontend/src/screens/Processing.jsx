import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { generatePdfFromImage, convertPdfToDataUri } from '../services/drive.js';
import { processDocument } from '../services/api.js';

export default function ProcessingScreen({ capture, onAnalyzed, onBack }) {
  const [status, setStatus] = useState('Generating PDF');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const work = async () => {
      try {
        setStatus('Generating PDF');
        const pdf = await generatePdfFromImage(capture?.uri, 'document');
        
        setStatus('Converting to data URI');
        const pdfDataUri = await convertPdfToDataUri(pdf.uri);

        setStatus('Processing with backend');
        const res = await processDocument(pdfDataUri, null);
        
        if (mounted) {
          onAnalyzed({
            title: res.title,
            category: res.category
          });
        }
      } catch (e) {
        setError(e?.message || 'Processing failed');
      }
    };
    work();
    return () => { mounted = false; };
  }, []);

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

