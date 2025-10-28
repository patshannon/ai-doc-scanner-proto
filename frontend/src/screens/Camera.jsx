import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

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
    // Non-fatal; thumbnail is optional
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

export default function CameraScreen({ onCaptured, onTestGoogle, googleAuth, onBack }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);

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

      onCaptured({
        uri: photo?.uri,
        exifDate,
        thumbBase64
      });
    } catch (err) {
      setError(err?.message || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCaptured]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.info}>Requesting camera permissions…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.deniedWrap}>
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
      {onBack && (
        <View style={styles.topOverlay}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.overlay}>
        <View style={styles.statusWrap}>
          <Text style={styles.statusText}>{driveStatusText}</Text>
          {error ? <Text style={styles.errorText}>Error: {error}</Text> : null}
        </View>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onTestGoogle}>
            <Text style={styles.secondaryText}>Google OAuth</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.captureDisabled]}
            onPress={handleCapture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 12
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
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
  captureDisabled: { opacity: 0.5 },
  statusWrap: { gap: 4 },
  statusText: { color: '#f2f2f2', fontSize: 13 },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  secondaryText: { color: '#fff', fontWeight: '500' },
  errorText: { color: '#ffb4a2', fontSize: 12 },
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
