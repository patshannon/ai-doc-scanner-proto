import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { processDocument } from '../services/api.js';

export default function ProcessingScreen({ capture, onAnalyzed, onBack }) {
  const [status, setStatus] = useState('Processing image');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const work = async () => {
      try {
        setStatus('Converting image to base64');
        const manipulated = await manipulateAsync(
          capture?.uri,
          [{ resize: { width: 2048 } }],
          { compress: 0.8, format: SaveFormat.JPEG, base64: true }
        );

        if (!manipulated?.base64) {
          throw new Error('Failed to convert image');
        }

        const imageDataUri = `data:image/jpeg;base64,${manipulated.base64}`;

        setStatus('Analyzing with AI');
        const res = await processDocument(imageDataUri, null);
        
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

