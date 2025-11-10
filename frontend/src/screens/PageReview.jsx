import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import ImageEditor from '../components/ImageEditor';
import { imageEditor } from '../services/imageEditor';

export default function PageReviewScreen({
  captures = [],
  maxPages = 5,
  onRemove,
  onReorder,
  onAddMore,
  onStartOver,
  onContinue,
  onBack
}) {
  const [preview, setPreview] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  const canContinue = captures.length > 0;
  const remainingSlots = maxPages - captures.length;

  const title = useMemo(() => {
    if (!captures.length) return 'Add pages to begin processing';
    if (remainingSlots > 0) {
      return `You can add ${remainingSlots} more page${remainingSlots === 1 ? '' : 's'}`;
    }
    return 'Max pages captured';
  }, [captures.length, remainingSlots]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Review Pages</Text>
          <Text style={styles.headerSubtitle}>{title}</Text>
        </View>
        <Text style={styles.pageCount}>{captures.length}/{maxPages}</Text>
      </View>

      {captures.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No pages yet</Text>
          <Text style={styles.emptyCopy}>
            Capture up to {maxPages} pages straight from the camera. You can preview and reorder here before sending to AI.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onAddMore}>
            <Text style={styles.primaryText}>Open Camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {captures.map((cap, index) => (
            <View key={cap.id || index} style={styles.card}>
              <TouchableOpacity style={styles.thumbnailWrap} onPress={() => setPreview(cap)}>
                <Image
                  source={{ uri: cap.thumbBase64 || cap.uri }}
                  style={styles.thumbnail}
                />
                <Text style={styles.previewHint}>Tap to preview</Text>
              </TouchableOpacity>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Page {index + 1}</Text>
                <Text style={styles.cardMeta}>
                  Captured {new Date(cap.exifDate || Date.now()).toLocaleString()}
                </Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, index === 0 && styles.actionDisabled]}
                    disabled={index === 0}
                    onPress={() => onReorder?.(index, -1)}
                  >
                    <Text style={styles.actionText}>↑ Move Up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      index === captures.length - 1 && styles.actionDisabled
                    ]}
                    disabled={index === captures.length - 1}
                    onPress={() => onReorder?.(index, 1)}
                  >
                    <Text style={styles.actionText}>↓ Move Down</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => {
                      setEditingImage(cap.uri);
                      setEditingIndex(index);
                    }}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => onRemove?.(cap.id)}
                  >
                    <Text style={styles.deleteText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onStartOver}>
          <Text style={styles.secondaryText}>Start Over</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onAddMore}>
          <Text style={styles.secondaryText}>Add More Pages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, !canContinue && styles.primaryDisabled]}
          disabled={!canContinue}
          onPress={onContinue}
        >
          <Text style={styles.primaryText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!preview} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {preview ? (
              <>
                <Image source={{ uri: preview.uri }} style={styles.modalImage} />
                <TouchableOpacity style={styles.modalClose} onPress={() => setPreview(null)}>
                  <Text style={styles.modalCloseText}>Close Preview</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Image Editor Modal */}
      <ImageEditor
        visible={!!editingImage}
        imageUri={editingImage}
        initialEdits={captures[editingIndex]?.edits}
        onSave={async ({ uri, edits }) => {
          try {
            // Create new thumbnail from edited image
            const thumbBase64 = await imageEditor.createThumbnail(uri);
            
            // Update the capture with edited URI and new thumbnail
            const updatedCaptures = [...captures];
            updatedCaptures[editingIndex] = {
              ...updatedCaptures[editingIndex],
              uri,
              thumbBase64,
              edits
            };
            
            // This would require updating the parent component to handle capture updates
            // For now, we'll just close the editor
            setEditingImage(null);
            setEditingIndex(null);
            
            // You might want to add an onEditCapture prop to handle this properly
            console.log('Image edited:', { uri, edits, index: editingIndex });
          } catch (err) {
            console.error('Failed to save edited image:', err);
          }
        }}
        onCancel={() => {
          setEditingImage(null);
          setEditingIndex(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#f2f2f2'
  },
  backText: { color: '#333', fontSize: 12 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  headerSubtitle: { fontSize: 12, color: '#666' },
  pageCount: { fontWeight: '600', color: '#111' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24
  },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyCopy: { fontSize: 14, color: '#666', textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
    gap: 12
  },
  thumbnailWrap: {
    width: 90,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    position: 'relative'
  },
  thumbnail: { width: '100%', height: '100%' },
  previewHint: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardMeta: { fontSize: 12, color: '#666' },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff'
  },
  actionDisabled: { opacity: 0.4 },
  actionText: { fontSize: 12, color: '#333' },
  editBtn: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff'
  },
  editText: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
  deleteBtn: {
    borderColor: '#ffb4b4',
    backgroundColor: '#fff5f5'
  },
  deleteText: { fontSize: 12, color: '#b00020', fontWeight: '600' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
    flexDirection: 'row',
    gap: 12
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  secondaryText: { color: '#333', fontWeight: '500' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000'
  },
  modalImage: { width: '100%', height: 500, resizeMode: 'contain', backgroundColor: '#000' },
  modalClose: { padding: 12, alignItems: 'center', backgroundColor: '#111' },
  modalCloseText: { color: '#fff', fontWeight: '600' }
});
