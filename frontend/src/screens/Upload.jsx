import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { processDocument } from '../services/api.js';

export default function UploadScreen({ analysis, googleAuth, onDone, onBack }) {
  const [uploading, setUploading] = useState(true);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const doUpload = async () => {
      try {
        if (!analysis?.pdfDataUri) {
          throw new Error('No PDF data available');
        }

        const googleAccessToken = googleAuth?.accessToken || null;

        // Pass user's edited values so backend uses them instead of re-analyzing
        const userEdits = {
          title: analysis.title,
          category: analysis.category,
          year: analysis.year
        };

        const res = await processDocument(
          analysis.pdfDataUri,
          googleAccessToken,
          false, // skipUpload = false (actually upload this time)
          analysis.selectedParentFolderId,
          userEdits
        );

        if (mounted) {
          setUploadResult(res);
          setUploading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e?.message || 'Upload failed');
          setUploading(false);
        }
      }
    };

    doUpload();
    return () => { mounted = false; };
  }, []);

  const handleOpenDrive = () => {
    if (uploadResult?.driveUrl) {
      Linking.openURL(uploadResult.driveUrl);
    }
  };

  if (uploading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.status}>Uploading to Google Drive...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Upload Error: {error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>✅ Upload Complete</Text>
      <Text style={styles.label}>Title:</Text>
      <Text style={styles.value}>{analysis?.title || 'n/a'}</Text>
      <Text style={styles.label}>Category:</Text>
      <Text style={styles.value}>{analysis?.category || 'n/a'}</Text>
      <Text style={styles.label}>Year:</Text>
      <Text style={styles.value}>{analysis?.year || 'n/a'}</Text>
      <Text style={styles.label}>Pages:</Text>
      <Text style={styles.value}>{analysis?.pageCount || 1}</Text>

      {uploadResult?.driveUrl ? (
        <View style={styles.driveCard}>
          <Text style={styles.driveLabel}>📁 Google Drive</Text>
          <Text style={styles.driveSuccess}>Successfully uploaded to Drive!</Text>
          <Text style={styles.driveLocation}>Location: {uploadResult?.finalFolderPath || 'Unknown'}</Text>
          <TouchableOpacity style={styles.driveBtn} onPress={handleOpenDrive}>
            <Text style={styles.driveBtnText}>Open in Drive</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.driveCard}>
          <Text style={styles.driveWarning}>
            Not uploaded to Drive. Connect Google OAuth to enable uploads.
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onDone}>
          <Text style={styles.btnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  status: { fontSize: 14, color: '#333', marginTop: 8 },
  err: { fontSize: 14, color: '#b00020', textAlign: 'center' },
  big: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 12 },
  value: { fontSize: 14, color: '#111' },
  driveCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 10,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0a8754',
    gap: 8
  },
  driveLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  driveSuccess: { fontSize: 13, color: '#0a8754' },
  driveLocation: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  driveWarning: { fontSize: 13, color: '#cc6600' },
  driveBtn: {
    backgroundColor: '#0a8754',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4
  },
  driveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  btn: { flex: 1, backgroundColor: '#111', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondary: { backgroundColor: '#666' },
  btnText: { color: '#fff', fontWeight: '600' }
});
