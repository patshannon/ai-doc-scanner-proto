import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { imageEditor } from '../services/imageEditor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Document aspect ratios for cropping
const ASPECT_RATIOS = {
  free: null,
  a4: { width: 210, height: 297 },
  letter: { width: 8.5, height: 11 },
  legal: { width: 8.5, height: 14 },
  square: { width: 1, height: 1 }
};
const ASPECT_RATIO_KEYS = ['letter', 'a4', 'legal', 'square', 'free'];

export default function ImageEditor({
  visible,
  imageUri,
  onSave,
  onCancel,
  initialEdits = {}
}) {
  const [editing, setEditing] = useState({
    rotation: 0,
    crop: null,
    scanMode: true,
    ...initialEdits
  });
  
  const [processing, setProcessing] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('letter');
  const [currentImageUri, setCurrentImageUri] = useState(imageUri);
  const [previewUri, setPreviewUri] = useState(imageUri);
  
  const imageRef = useRef(null);
  const imageDimensionsRef = useRef({ width: 0, height: 0 });
  const lastImageUri = useRef(null);

  // Helper to calculate crop based on dimensions and current edits
  const calculateAutoCrop = (dims, currentEdits) => {
    if (currentEdits.autoDetectCrop === false) return null;

    let effectiveDims = dims;
    // Account for initial rotation if any
    if (currentEdits.rotation % 180 !== 0) {
      effectiveDims = { width: dims.height, height: dims.width };
    }

    if (currentEdits.guideFrame) {
      // Precise crop based on camera guide frame
      const { x, y, width, height, screenWidth, screenHeight } = currentEdits.guideFrame;
      const { width: imgW, height: imgH } = effectiveDims;
      
      // Determine how image is fitted to screen (Aspect Fill / Cover)
      const imageAspect = imgW / imgH;
      const screenAspect = screenWidth / screenHeight;
      
      let scale, offsetX, offsetY;
      
      if (imageAspect > screenAspect) {
        // Image is wider than screen
        scale = imgH / screenHeight;
        const visibleImgWidth = screenWidth * scale;
        offsetX = (imgW - visibleImgWidth) / 2;
        offsetY = 0;
      } else {
        // Image is taller than screen
        scale = imgW / screenWidth;
        const visibleImgHeight = screenHeight * scale;
        offsetX = 0;
        offsetY = (imgH - visibleImgHeight) / 2;
      }
      
      // Map guide frame to image coordinates
      let cropWidth = width * scale;
      let cropHeight = height * scale;
      let cropX = offsetX + (x * scale);
      let cropY = offsetY + (y * scale);
      
      // Add a 10% safety buffer
      const bufferScale = 1.1;
      const newWidth = cropWidth * bufferScale;
      const newHeight = cropHeight * bufferScale;
      
      // Adjust X/Y to keep centered
      cropX -= (newWidth - cropWidth) / 2;
      cropY -= (newHeight - cropHeight) / 2;
      
      cropWidth = newWidth;
      cropHeight = newHeight;
      
      // Clamp to image bounds
      if (cropX < 0) cropX = 0;
      if (cropY < 0) cropY = 0;
      if (cropX + cropWidth > imgW) cropWidth = imgW - cropX;
      if (cropY + cropHeight > imgH) cropHeight = imgH - cropY;

      return {
        originX: cropX,
        originY: cropY,
        width: cropWidth,
        height: cropHeight
      };
    } else {
      // Fallback to simple center crop if no guide frame
      return imageEditor.calculateCropDimensions(effectiveDims, 'letter');
    }
  };

  useEffect(() => {
    if (visible && imageUri && lastImageUri.current !== imageUri) {
      lastImageUri.current = imageUri;
      setProcessing(true);
      
      const init = async () => {
        console.log('[ImageEditor] Initializing with URI:', imageUri);
        const startEdits = {
          rotation: 0,
          crop: null,
          scanMode: true,
          ...initialEdits
        };

        // If we already have a crop (editing existing), just proceed
        if (initialEdits.crop) {
          setEditing(startEdits);
          setSelectedAspectRatio('letter');
          setCurrentImageUri(imageUri);
          return;
        }

        // If no crop (new image), calculate it FIRST
        try {
          const dims = await imageEditor.getImageDimensions(imageUri);
          console.log('[ImageEditor] Got dimensions:', dims);
          imageDimensionsRef.current = dims;
          
          const autoCrop = calculateAutoCrop(dims, startEdits);
          if (autoCrop) {
            console.log('[ImageEditor] Calculated auto-crop:', autoCrop);
            startEdits.crop = autoCrop;
          }
        } catch (err) {
          console.error('[ImageEditor] Failed to load image dimensions:', err);
        }

        // Apply initial state with calculated crop
        setEditing(startEdits);
        setSelectedAspectRatio(startEdits.crop ? 'letter' : 'free');
        setCurrentImageUri(imageUri);
      };

      init();
    }
  }, [visible, imageUri]);

  const handleImageLoad = useCallback((event) => {
    // Web vs Native have different event structures
    let width, height;
    
    if (event.nativeEvent?.source) {
      // React Native
      ({ width, height } = event.nativeEvent.source);
    } else if (event.target) {
      // Web
      width = event.target.naturalWidth || event.target.width;
      height = event.target.naturalHeight || event.target.height;
    }
    
    if (width && height) {
      console.log('[ImageEditor] Image loaded via onLoad:', width, height);
      imageDimensionsRef.current = { width, height };

      // Fallback: If we don't have a crop yet, and auto-crop is enabled, try to calculate it now
      // This handles cases where getImageDimensions failed or was too slow
      setEditing(prev => {
        if (prev.crop || prev.autoDetectCrop === false) return prev;
        
        console.log('[ImageEditor] Attempting fallback auto-crop from onLoad');
        const autoCrop = calculateAutoCrop({ width, height }, prev);
        
        if (autoCrop) {
          console.log('[ImageEditor] Fallback auto-crop successful');
          // Also update selectedAspectRatio if we found a crop
          setSelectedAspectRatio('letter');
          return { ...prev, crop: autoCrop };
        }
        return prev;
      });
    }
  }, []);

  const applyEdits = async () => {
    if (!currentImageUri) return;
    
    setProcessing(true);
    try {
      // Apply edits with the scan filter so users can see the effect in real-time
      const finalUri = await imageEditor.applyEdits(currentImageUri, editing, { skipFilter: false });
      setPreviewUri(finalUri);
      return finalUri;
    } catch (error) {
      console.error('Error applying edits:', error);
      return currentImageUri;
    } finally {
      setProcessing(false);
    }
  };

  // Apply edits in real-time when editing state changes
  useEffect(() => {
    if (visible && currentImageUri) {
      applyEdits();
    }
  }, [editing.rotation, editing.crop, editing.scanMode]);

  const handleSave = async () => {
    if (onSave) {
      setProcessing(true);
      try {
        // Apply the edits WITH the scan filter for the final output
        const finalUri = await imageEditor.applyEdits(currentImageUri, editing, { skipFilter: false });
        onSave({
          uri: finalUri,
          edits: editing
        });
      } catch (error) {
        console.error('Error saving image:', error);
        setProcessing(false);
      }
    }
  };

  const handleReset = () => {
    setEditing({
      rotation: 0,
      crop: null,
      scanMode: true
    });
    setCurrentImageUri(imageUri);
    setSelectedAspectRatio('letter');
    
    // Re-apply default crop on reset
    if (imageDimensionsRef.current.width > 0) {
      const cropDimensions = imageEditor.calculateCropDimensions(imageDimensionsRef.current, 'letter');
      if (cropDimensions) {
        setEditing(prev => ({
          ...prev,
          crop: cropDimensions
        }));
      }
    }
  };

  const rotateImage = useCallback((degrees) => {
    setEditing(prev => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360
    }));
  }, []);

  const setAspectRatio = useCallback((ratio) => {
    setSelectedAspectRatio(ratio);
    if (ratio === 'free') {
      setEditing(prev => ({ ...prev, crop: null }));
    } else {
      // Calculate crop dimensions based on aspect ratio
      const aspectRatio = ASPECT_RATIOS[ratio];
      let dimensions = imageDimensionsRef.current;
      
      // Adjust dimensions for current rotation
      if (editing.rotation % 180 !== 0) {
        dimensions = { width: dimensions.height, height: dimensions.width };
      }

      if (aspectRatio && dimensions.width > 0) {
        const cropDimensions = imageEditor.calculateCropDimensions(dimensions, ratio);
        if (cropDimensions) {
          setEditing(prev => ({
            ...prev,
            crop: cropDimensions
          }));
        }
      }
    }
  }, [editing.rotation]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onCancel}
          >
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Image</Text>
          <TouchableOpacity
            style={[styles.headerButton, processing && styles.disabledButton]}
            onPress={handleSave}
            disabled={processing}
          >
            <Text style={styles.headerButtonText}>
              {processing ? 'Processing...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Image Preview */}
        <View style={styles.imageContainer}>
          {processing ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          ) : null}
          
          <Image
            ref={imageRef}
            source={{ uri: previewUri }}
            style={styles.image}
            onLoad={handleImageLoad}
            resizeMode="contain"
          />
        </View>

        {/* Editing Controls */}
        <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false}>
          {/* Rotation Controls */}
          <View style={styles.controlSection}>
            <Text style={styles.sectionTitle}>Rotate</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => rotateImage(-90)}
              >
                <Text style={styles.buttonText}>↺ 90°</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => rotateImage(90)}
              >
                <Text style={styles.buttonText}>↻ 90°</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Crop Controls */}
          <View style={styles.controlSection}>
            <Text style={styles.sectionTitle}>Crop</Text>
            <View style={styles.buttonRow}>
                {ASPECT_RATIO_KEYS.map(ratio => (
                <TouchableOpacity
                  key={ratio}
                  style={[
                    styles.controlButton,
                    selectedAspectRatio === ratio && styles.selectedButton
                  ]}
                  onPress={() => setAspectRatio(ratio)}
                >
                  <Text style={styles.buttonText}>
                    {ratio === 'free' ? 'NONE' : ratio.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Document Scan Mode */}
          <View style={styles.controlSection}>
            <Text style={styles.sectionTitle}>Document Enhancement</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  editing.scanMode && styles.selectedButton
                ]}
                onPress={() => setEditing(prev => ({ ...prev, scanMode: true }))}
              >
                <Text style={styles.buttonText}>Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  !editing.scanMode && styles.selectedButton
                ]}
                onPress={() => setEditing(prev => ({ ...prev, scanMode: false }))}
              >
                <Text style={styles.buttonText}>Photo</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              Scan mode optimizes the image for document text readability
            </Text>
          </View>

          {/* Reset Button */}
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset All</Text>
          </TouchableOpacity>
          
          {/* Bottom padding for safe areas */}
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 0 // Let the modal handle its own safe areas
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Math.max(12, 44), // Ensure minimum height for notches
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44, // Minimum touch target size
    justifyContent: 'center'
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600'
  },
  disabledButton: {
    opacity: 0.5
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center'
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.5,
    backgroundColor: '#000'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16
  },
  controlsContainer: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: screenHeight * 0.4
  },
  controlSection: {
    marginBottom: 20
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  controlButton: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#48484A',
    minHeight: 44, // Minimum touch target size
    justifyContent: 'center',
    alignItems: 'center'
  },
  selectedButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF'
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500'
  },
  slider: {
    width: '100%',
    height: 40
  },
  sliderThumb: {
    backgroundColor: '#007AFF',
    width: 20,
    height: 20
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 44, // Minimum touch target size
    justifyContent: 'center'
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  helpText: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16
  }
});
