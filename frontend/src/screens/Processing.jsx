import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { runOcr } from '../services/ocr.js';
import { analyze } from '../services/api.js';

export default function ProcessingScreen({ capture, onAnalyzed, onBack }) {
  const [status, setStatus] = useState('Running OCR');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const work = async () => {
      try {
        setStatus('Running OCR');
        const ocrText = await runOcr(capture);
        setStatus('Analyzing');
        const res = await analyze({
          ocrText,
          exifDate: capture?.exifDate || null,
          thumbBase64: capture?.thumbBase64 || null,
          locale: 'en-CA'
        });
        if (mounted) onAnalyzed(res);
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

