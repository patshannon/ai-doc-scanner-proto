import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Switch,
  Platform
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { PlatformCamera } from '../components/PlatformCamera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import ImageEditor from '../components/ImageEditor';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function BrightGuideOverlay({ width, height }) {
  // Use full screen width for the guide frame
  // Letter aspect ratio is 1 : 1.294
  // Add some horizontal padding (24px on each side) so it doesn't touch edges
  const horizontalPadding = 48;
  const guideWidth = width - horizontalPadding;
  const guideHeight = guideWidth * 1.294;
  
  // Ensure it fits vertically (accounting for top and bottom bars)
  // Leave some space for top bar (~100px) and bottom bar (~90px)
  const maxHeight = height - 190;
  let finalWidth = guideWidth;
  let finalHeight = guideHeight;
  
  if (guideHeight > maxHeight) {
    finalHeight = maxHeight;
    finalWidth = finalHeight / 1.294;
  }

  const cornerSize = 30; // Length of corner bracket arms
  const lineThickness = 3;

  return (
    <View style={styles.guideContainer} pointerEvents="none">
      <View style={[styles.guideFrame, { width: finalWidth, height: finalHeight }]}>
        {/* Edge Lines */}
        <View style={[styles.edgeLine, styles.topEdge, { width: finalWidth }]} />
        <View style={[styles.edgeLine, styles.bottomEdge, { width: finalWidth }]} />
        <View style={[styles.edgeLine, styles.leftEdge, { height: finalHeight }]} />
        <View style={[styles.edgeLine, styles.rightEdge, { height: finalHeight }]} />
        
        {/* Top Left Corner */}
        <View style={[
          styles.cornerBracket, 
          styles.topLeft,
          { 
            width: cornerSize, 
            height: cornerSize,
            borderTopWidth: lineThickness,
            borderLeftWidth: lineThickness,
            borderColor: '#4CAF50',
          }
        ]} />
        
        {/* Top Right Corner */}
        <View style={[
          styles.cornerBracket, 
          styles.topRight,
          { 
            width: cornerSize, 
            height: cornerSize,
            borderTopWidth: lineThickness,
            borderRightWidth: lineThickness,
            borderColor: '#4CAF50',
          }
        ]} />
        
        {/* Bottom Left Corner */}
        <View style={[
          styles.cornerBracket, 
          styles.bottomLeft,
          { 
            width: cornerSize, 
            height: cornerSize,
            borderBottomWidth: lineThickness,
            borderLeftWidth: lineThickness,
            borderColor: '#4CAF50',
          }
        ]} />
        
        {/* Bottom Right Corner */}
        <View style={[
          styles.cornerBracket, 
          styles.bottomRight,
          { 
            width: cornerSize, 
            height: cornerSize,
            borderBottomWidth: lineThickness,
            borderRightWidth: lineThickness,
            borderColor: '#4CAF50',
          }
        ]} />
      </View>
      
      <View style={styles.guideTextContainer}>
        <Text style={styles.guideText}>Align document within frame</Text>
      </View>
    </View>
  );
}

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
  const [autoCrop, setAutoCrop] = useState(true);
  const [flashMode, setFlashMode] = useState('on'); // 'off', 'on', 'auto', 'torch'
  const [viewDimensions, setViewDimensions] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

  const driveStatusText = useMemo(() => {
    if (!googleAuth) return 'Not linked';
    if (googleAuth.expiresAt && googleAuth.expiresAt <= Date.now()) {
      return 'Expired';
    }
    return 'Linked';
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
      setError(`Limit reached — max ${maxPages} pages`);
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
      
      // Calculate crop scale based on guide overlay dimensions
      // This ensures the auto-crop matches the visual guide the user aligned to
      const { width: viewWidth, height: viewHeight } = viewDimensions;
      const horizontalPadding = 48;
      const guideWidth = viewWidth - horizontalPadding;
      const guideHeight = guideWidth * 1.294;
      const maxHeight = viewHeight - 190;
      
      let finalWidth = guideWidth;
      let finalHeight = guideHeight;
      if (guideHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = finalHeight / 1.294;
      }
      
      // Calculate centered position
      const guideX = (viewWidth - finalWidth) / 2;
      const guideY = (viewHeight - finalHeight) / 2;

      // Store pending capture for editing
      const captureData = {
        uri: photo?.uri,
        exifDate,
        thumbBase64,
        autoCropEnabled: autoCrop,
        guideFrame: {
          x: guideX,
          y: guideY,
          width: finalWidth,
          height: finalHeight,
          screenWidth: viewWidth,
          screenHeight: viewHeight
        }
      };
      
      setPendingCapture(captureData);
      setEditingImage(photo?.uri);
    } catch (err) {
      setError(err?.message || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  }, [capturing, captures.length, maxPages, onAddCapture, autoCrop]);

  const toggleFlash = useCallback(() => {
    setFlashMode(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      if (prev === 'auto') return 'torch';
      return 'off';
    });
  }, []);

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
    // Add original capture without editing if user cancels? 
    // Usually "Cancel" in this flow implies "Retake" or "Discard". 
    // But for now let's assume it means "Keep original".
    // Actually, let's make it discard to be safe, or just keep original.
    // Let's keep original for safety, but maybe without edits.
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
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.deniedWrap}>
        <TouchableOpacity style={styles.backBtnAbsolute} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.deniedTitle}>Camera Access Required</Text>
        <Text style={styles.deniedCopy}>
          Please enable camera access to scan documents.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleRequestPermission}>
          <Text style={styles.primaryButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View 
      style={styles.container} 
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setViewDimensions({ width, height });
      }}
    >
      <PlatformCamera
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableZoomGesture
        autofocus="on"
        flash={flashMode === 'torch' ? 'off' : flashMode}
        enableTorch={flashMode === 'torch'}
      />
      
      <BrightGuideOverlay width={viewDimensions.width} height={viewDimensions.height} />

      {/* Top Controls */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.topCenter}>
           <Text style={styles.pageCount}>{captures.length} / {maxPages}</Text>
        </View>

        <View style={styles.topRightGroup}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
            {flashMode === 'on' && <Ionicons name="flash" size={24} color="#FFD700" />}
            {flashMode === 'auto' && <MaterialIcons name="flash-auto" size={24} color="#fff" />}
            {flashMode === 'torch' && <Ionicons name="flashlight" size={24} color="#FFD700" />}
            {flashMode === 'off' && <Ionicons name="flash-off" size={24} color="#fff" />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={onTestGoogle}>
            <Ionicons 
              name={driveStatusText === 'Linked' ? "cloud-done" : "cloud-offline"} 
              size={24} 
              color={driveStatusText === 'Linked' ? "#4CAF50" : "#fff"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        {/* Auto Crop Toggle */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Auto Crop</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#0a8754" }}
            thumbColor={autoCrop ? "#fff" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={setAutoCrop}
            value={autoCrop}
          />
        </View>

        {/* Capture Button */}
        <View style={styles.captureContainer}>
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
        </View>

        {/* Review Button */}
        <View style={styles.reviewContainer}>
          {canReview && (
            <TouchableOpacity style={styles.reviewBtn} onPress={onRequestReview}>
              <Text style={styles.reviewText}>Review</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error Toast */}
      {error && (
        <View style={styles.errorToast}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Image Editor Modal */}
      {editingImage && lastEditingImage.current !== editingImage && (
        <ImageEditor
          visible={true}
          imageUri={editingImage}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
          initialEdits={{
            // If autoCrop is enabled, we don't pass a crop here, 
            // but we rely on ImageEditor to calculate it if we pass a flag.
            // Or we can pass a flag 'autoDetectCrop: true'
            autoDetectCrop: autoCrop,
            guideFrame: pendingCapture?.guideFrame
          }}
        />
      )}
      {editingImage && (lastEditingImage.current = editingImage, null)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  
  // Guide Overlay Styles
  guideContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  guideFrame: {
    position: 'relative',
  },
  
  // Edge Lines
  edgeLine: {
    position: 'absolute',
    backgroundColor: '#4CAF50',
  },
  topEdge: {
    top: 0,
    left: 0,
    height: 2,
  },
  bottomEdge: {
    bottom: 0,
    left: 0,
    height: 2,
  },
  leftEdge: {
    left: 0,
    top: 0,
    width: 2,
  },
  rightEdge: {
    right: 0,
    top: 0,
    width: 2,
  },
  
  // Corner Brackets
  cornerBracket: {
    position: 'absolute',
  },
  topLeft: {
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
  },
  
  guideTextContainer: {
    position: 'absolute',
    top: '15%',
    width: '100%',
    alignItems: 'center',
    zIndex: 20,
  },
  guideText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  // UI Controls
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 30,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topCenter: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pageCount: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 10 : 5,
    zIndex: 30,
  },
  toggleContainer: {
    alignItems: 'center',
    gap: 2,
    width: 70,
  },
  toggleLabel: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '500',
  },
  captureContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  captureInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff'
  },
  captureDisabled: { opacity: 0.5 },
  
  reviewContainer: {
    width: 70,
    alignItems: 'center',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  reviewText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

  errorToast: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,59,48,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 40,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Permission / Loading states
  centered: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  deniedWrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  deniedTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  deniedCopy: { color: '#ccc', fontSize: 16, textAlign: 'center' },
  primaryButton: { backgroundColor: '#0a8754', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtnAbsolute: { position: 'absolute', top: 50, left: 20, padding: 8 },
});
