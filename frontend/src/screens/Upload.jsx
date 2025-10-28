import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { generatePdfFromImage } from '../services/drive.js';
import { uploadToDriveAndIndex } from '../services/drive.js';
import { ensureFolderPath } from '../services/api.js';

export default function UploadScreen({ capture, analysis, googleAuth, onUploaded, onBack }) {
  const [status, setStatus] = useState('Preparing PDF');
  const [error, setError] = useState(null);
  const [ensuredPath, setEnsuredPath] = useState(analysis?.folderPath || '');

  useEffect(() => {
    let mounted = true;
    const work = async () => {
      try {
        setStatus('Ensuring folder path');
        let resolved = analysis;
        try {
          const ensured = await ensureFolderPath(
            analysis?.folderPath || 'Documents/Other',
            googleAuth?.accessToken
          );
          if (ensured?.folderPath && ensured.folderPath !== analysis?.folderPath) {
            resolved = { ...analysis, folderPath: ensured.folderPath };
          }
          if (mounted) {
            setEnsuredPath(ensured?.folderPath || analysis?.folderPath || '');
          }
        } catch (_e) {
          // Non-fatal in prototype; proceed with original path
          if (mounted) {
            setEnsuredPath(analysis?.folderPath || '');
          }
        }
        setStatus('Generating PDF');
        const pdf = await generatePdfFromImage(capture?.uri, resolved?.title || 'Document');
        setStatus('Uploading to Drive');
        const res = await uploadToDriveAndIndex(pdf, resolved, googleAuth?.accessToken);
        if (mounted) onUploaded(res);
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
      {ensuredPath ? <Text style={styles.detail}>Folder: {ensuredPath}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  status: { color: '#333' },
  err: { color: '#b00020' },
  btn: { backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnText: { color: '#fff' },
  detail: { color: '#666', fontSize: 12 }
});
