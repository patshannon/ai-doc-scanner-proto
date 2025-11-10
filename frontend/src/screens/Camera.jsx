import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import ImageEditor from '../components/ImageEditor';
import { imageEditor } from '../services/imageEditor';

async function buildThumbnail(uri) {
  if (!uri) return null;
  try {
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 480 } }],
      { compress: 0.5, format: SaveFormat.JPEG, base64: true }
    );
    if (manipulated?.base64) {
      return `data:image/jpeg;base64,${manipulated.base64}`;
    }
  } catch (_err) {
    // Thumbnail is optional
  }
  return null;
}

function extractExifDate(exif) {
  if (!exif || typeof exif !== 'object') return null;
  const keys = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime'];
  for (const key of keys) {
    const value = exif[key];
    if (typeof value === 'string' && value.trim()) {
      const iso = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  return null;
}

function BackAction({ overlay = false, onBack }) {
  if (!onBack) return null;
  return (
    <View style={overlay ? styles.topOverlay : styles.backRow}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CameraScreen({
  captures = [],
  maxPages = 5,
  onAddCapture,
  onRemoveCapture,
  onRequestReview,
  onTestGoogle,
  googleAuth,
  onBack
}) {
  const cameraRef = useRef(null);
  const lastEditingImage = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [pendingCapture, setPendingCapture] = useState(null);

  const driveStatusText = useMemo(() => {
    if (!googleAuth) return 'Google OAuth not linked';
    if (googleAuth.expiresAt && googleAuth.expiresAt <= Date.now()) {
      return 'Google Drive scope expired — re-authorize';
    }
    return 'Google Drive scope granted';
  }, [googleAuth]);

  const handleRequestPermission = useCallback(async () => {
    try {
      setError(null);
      await requestPermission();
    } catch (err) {
      setError(err?.message || 'Camera permission request failed');
    }
  }, [requestPermission]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    if (captures.length >= maxPages) {
      setError(`Limit reached — max ${maxPages} pages per document`);
      return;
    }
    setCapturing(true);
    setError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        exif: true
      });

      const exifDate = extractExifDate(photo?.exif) || new Date().toISOString();
      const thumbBase64 = await buildThumbnail(photo?.uri);
      
      // Store pending capture for editing
      const captureData = {
        uri: photo?.uri,
        exifDate,
        thumbBase64
      };
      
      setPendingCapture(captureData);
      setEditingImage(photo?.uri);
    } catch (err) {
      setError(err?.message || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  }, [capturing, captures.length, maxPages, onAddCapture]);

  const handleEditSave = useCallback(async ({ uri, edits }) => {
    try {
      // Create new thumbnail from edited image
      const thumbBase64 = await buildThumbnail(uri);
      
      // Update pending capture with edited URI and new thumbnail
      const updatedCapture = {
        ...pendingCapture,
        uri,
        thumbBase64,
        edits // Store edit history for potential re-editing
      };
      
      // Add the edited capture to the collection
      onAddCapture?.(updatedCapture);
      
      // Clear editing state
      setEditingImage(null);
      setPendingCapture(null);
    } catch (err) {
      setError(err?.message || 'Failed to save edited image');
      setEditingImage(null);
      setPendingCapture(null);
    }
  }, [pendingCapture, onAddCapture]);

  const handleEditCancel = useCallback(() => {
    // Add original capture without editing
    if (pendingCapture) {
      onAddCapture?.(pendingCapture);
    }
    setEditingImage(null);
    setPendingCapture(null);
  }, [pendingCapture, onAddCapture]);

  const canReview = captures.length > 0;
  const canCaptureMore = captures.length < maxPages;

  if (!permission) {
    return (
      <View style={styles.centered}>
        <BackAction onBack={onBack} />
        <ActivityIndicator />
        <Text style={styles.info}>Requesting camera permissions…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.deniedWrap}>
        <BackAction onBack={onBack} />
        <Text style={styles.deniedTitle}>Camera access needed</Text>
        <Text style={styles.deniedCopy}>
          Enable the camera to capture documents. You can also grant access from iOS Settings later.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleRequestPermission}>
          <Text style={styles.primaryButtonText}>Allow Camera Access</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>Error: {error}</Text> : null}
        <TouchableOpacity style={styles.secondaryBtn} onPress={onTestGoogle}>
          <Text style={styles.secondaryText}>Test Google OAuth</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableZoomGesture
        autofocus="on"
      />
      <BackAction overlay onBack={onBack} />
      <View style={styles.overlay}>
        <View style={styles.statusWrap}>
          <Text style={styles.statusText}>{driveStatusText}</Text>
          <Text style={styles.pageCount}>Pages: {captures.length}/{maxPages}</Text>
          {error ? <Text style={styles.errorText}>Error: {error}</Text> : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbScroll}
          contentContainerStyle={styles.thumbRow}
        >
          {captures.map((cap, index) => (
            <View key={cap.id || index} style={styles.thumbCard}>
              <Image
                source={{ uri: cap.thumbBase64 || cap.uri }}
                style={styles.thumbImage}
              />
              <Text style={styles.thumbLabel}>Pg {index + 1}</Text>
              <TouchableOpacity
                style={styles.thumbRemove}
                onPress={() => onRemoveCapture?.(cap.id)}
              >
                <Text style={styles.thumbRemoveText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        {!canCaptureMore ? (
          <Text style={styles.limitNote}>
            Max pages captured. Remove a page or continue to review.
          </Text>
        ) : null}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onTestGoogle}>
            <Text style={styles.secondaryText}>Google OAuth</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureBtn, (!canCaptureMore || capturing) && styles.captureDisabled]}
            onPress={handleCapture}
            disabled={!canCaptureMore || capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reviewBtn, !canReview && styles.reviewDisabled]}
            disabled={!canReview}
            onPress={onRequestReview}
          >
            <Text style={styles.reviewText}>Review Pages</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Editor Modal */}
      {editingImage && lastEditingImage.current !== editingImage && (
        <ImageEditor
          visible={true}
          imageUri={editingImage}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        />
      )}
      {editingImage && (lastEditingImage.current = editingImage, null)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10
  },
  backRow: {
    width: '100%',
    paddingTop: 16,
    paddingHorizontal: 16,
    alignItems: 'flex-start'
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignSelf: 'flex-start'
  },
  backText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500'
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    gap: 12
  },
  statusWrap: { gap: 4 },
  statusText: { color: '#f2f2f2', fontSize: 13 },
  pageCount: { color: '#fff', fontSize: 12 },
  errorText: { color: '#ffb4a2', fontSize: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center'
  },
  secondaryText: { color: '#fff', fontWeight: '500' },
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  captureInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff'
  },
  captureDisabled: { opacity: 0.4 },
  reviewBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#0a8754',
    alignItems: 'center'
  },
  reviewDisabled: {
    backgroundColor: 'rgba(10,135,84,0.2)'
  },
  reviewText: { color: '#fff', fontWeight: '600' },
  thumbScroll: { maxHeight: 100 },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbCard: {
    width: 60,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbLabel: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  thumbRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  limitNote: { color: '#ffeb3b', fontSize: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  info: { color: '#444', fontSize: 13 },
  deniedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 },
  deniedTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  deniedCopy: { fontSize: 14, color: '#555', textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' }
});
