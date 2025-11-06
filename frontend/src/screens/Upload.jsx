import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { generatePdfFromImage, convertPdfToDataUri } from '../services/drive.js';
import { processDocument } from '../services/api.js';

export default function UploadScreen({ capture, analysis, googleAuth, onUploaded, onBack }) {
  const [status, setStatus] = useState('Preparing');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const work = async () => {
      try {
        setStatus('Generating PDF');
        const pdf = await generatePdfFromImage(capture?.uri, analysis?.title || 'document');
        
        setStatus('Converting to data URI');
        const pdfDataUri = await convertPdfToDataUri(pdf.uri);

        setStatus('Processing document');
        const res = await processDocument(pdfDataUri, googleAuth?.accessToken);
        
        if (mounted) {
          onUploaded({
            fileId: res.fileId,
            webViewLink: res.webViewLink,
            name: res.title,
            title: res.title,
            category: res.category,
            folderId: res.folderId
          });
        }
      } catch (e) {
        setError(e?.message || 'Upload failed');
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
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  status: { color: '#333' },
  err: { color: '#b00020' },
  btn: { backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnText: { color: '#fff' }
});
