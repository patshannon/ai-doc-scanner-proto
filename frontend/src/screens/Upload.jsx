import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Platform } from 'react-native';
import { uploadDocument } from '../services/api.js';

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

        const res = await uploadDocument({
          pdfDataUri: analysis.pdfDataUri,
          googleAccessToken,
          title: userEdits.title,
          category: userEdits.category,
          year: userEdits.year,
          confirmedPath: analysis.confirmedPath,
          selectedParentFolderId: analysis.selectedParentFolderId
        });

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
        <ActivityIndicator size="large" color="#30bfa1" />
        <Text style={styles.status}>Uploading to Google Drive...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>!</Text>
        </View>
        <Text style={styles.errTitle}>Upload Failed</Text>
        <Text style={styles.errDesc}>{error}</Text>
        <TouchableOpacity style={styles.btnSecondary} onPress={onBack}>
          <Text style={styles.btnTextSecondary}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.successIcon}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.heroTitle}>Upload Complete</Text>
          <Text style={styles.heroSubtitle}>Your document has been securely saved.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fileRow}>
            <View style={styles.pdfIcon}>
              <Text style={styles.pdfText}>PDF</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>{analysis?.title || 'Untitled'}.pdf</Text>
              <Text style={styles.fileMeta}>{analysis?.pageCount || 1} page{analysis?.pageCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.pathSection}>
            <Text style={styles.pathLabel}>SAVED TO</Text>
            <Text style={styles.pathValue}>
              {uploadResult?.finalFolderPath ? `/${uploadResult.finalFolderPath}` : 'Google Drive'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {uploadResult?.driveUrl ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleOpenDrive}>
              <Text style={styles.btnTextPrimary}>Open in Google Drive</Text>
            </TouchableOpacity>
          ) : (
             <View style={styles.warningBox}>
              <Text style={styles.warningText}>Drive link unavailable (Auth missing)</Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.btnSecondary} onPress={onDone}>
            <Text style={styles.btnTextSecondary}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060b',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05060b',
    padding: 24,
  },
  status: {
    marginTop: 16,
    color: '#8ca3ff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Hero Section
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(48, 191, 161, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(48, 191, 161, 0.3)',
  },
  checkMark: {
    fontSize: 36,
    color: '#30bfa1',
    fontWeight: 'bold',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#8ca3ff',
    textAlign: 'center',
  },
  // Card Section
  card: {
    backgroundColor: '#101420',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pdfIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ff4757',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  pdfText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  fileMeta: {
    fontSize: 13,
    color: '#8ca3ff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  pathSection: {
    gap: 6,
  },
  pathLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '700',
    letterSpacing: 1,
  },
  pathValue: {
    fontSize: 14,
    color: '#30bfa1',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Actions
  actions: {
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: '#30bfa1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnTextPrimary: {
    color: '#04140d',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  btnTextSecondary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    padding: 12,
    backgroundColor: 'rgba(255, 159, 67, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  warningText: {
    color: '#ff9f43',
    fontSize: 13,
  },
  // Error State
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 32,
    color: '#ff4757',
    fontWeight: 'bold',
  },
  errTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  errDesc: {
    fontSize: 16,
    color: '#8ca3ff',
    textAlign: 'center',
    marginBottom: 32,
  },
});
