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
const ASPECT_RATIO_KEYS = ['a4', 'letter', 'legal', 'square', 'free'];

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
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('a4');
  const [currentImageUri, setCurrentImageUri] = useState(imageUri);
  const [previewUri, setPreviewUri] = useState(imageUri);
  
  const imageRef = useRef(null);
  const imageDimensionsRef = useRef({ width: 0, height: 0 });
  const lastImageUri = useRef(null);

  useEffect(() => {
    if (visible && imageUri && lastImageUri.current !== imageUri) {
      lastImageUri.current = imageUri;
      setCurrentImageUri(imageUri);
      setEditing({
        rotation: 0,
        crop: null,
        scanMode: true,
        ...initialEdits
      });
      setSelectedAspectRatio('a4');
    }
  }, [visible, imageUri]);

  const handleImageLoad = useCallback((event) => {
    const { width, height } = event.nativeEvent.source;
    // Update the ref instead of state to avoid re-renders
    imageDimensionsRef.current = { width, height };
  }, []);

  const applyEdits = async () => {
    if (!currentImageUri) return;
    
    setProcessing(true);
    try {
      // Use the imageEditor service to apply edits
      const finalUri = await imageEditor.applyEdits(currentImageUri, editing);
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
    if (onSave && previewUri) {
      onSave({
        uri: previewUri,
        edits: editing
      });
    }
  };

  const handleReset = () => {
    setEditing({
      rotation: 0,
      crop: null,
      scanMode: true
    });
    setCurrentImageUri(imageUri);
    setSelectedAspectRatio('a4');
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
      const dimensions = imageDimensionsRef.current;
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
  }, []);

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
                    {ratio === 'free' ? 'Free' : ratio.toUpperCase()}
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
