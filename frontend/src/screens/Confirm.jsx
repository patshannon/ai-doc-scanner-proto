import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';

export default function ConfirmScreen({ initial, onConfirm, onBack }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'other');
  const [year, setYear] = useState(String(initial?.year || new Date().getFullYear()));
  const [selectedParentFolderId, setSelectedParentFolderId] = useState(
    initial?.suggestedParentFolderId || null
  );
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const pageCount = initial?.pageCount || 1;

  const inputTokens = initial?.inputTokens || 0;
  const outputTokens = initial?.outputTokens || 0;
  const estimatedCost = initial?.estimatedCost || 0;
  const availableFolders = initial?.availableParentFolders || [];
  const suggestedFolder = initial?.suggestedParentFolder;

  // Build final folder path preview
  const getFolderPath = () => {
    const categoryCapitalized = category.charAt(0).toUpperCase() + category.slice(1);
    if (selectedParentFolderId && selectedParentFolderId !== 'root') {
      const folder = availableFolders.find(f => f.id === selectedParentFolderId);
      const parentName = folder?.name || '';
      return `${parentName}/${categoryCapitalized}/${year}/`;
    }
    return `${categoryCapitalized}/${year}/`;
  };

  const getSelectedFolderName = () => {
    if (!selectedParentFolderId || selectedParentFolderId === 'root') {
      return 'None (root)';
    }
    const folder = availableFolders.find(f => f.id === selectedParentFolderId);
    return folder?.name || 'Unknown';
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Category</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} />
      <Text style={styles.label}>Year</Text>
      <TextInput
        style={styles.input}
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
        maxLength={4}
      />
      <Text style={styles.meta}>Pages: {pageCount}</Text>

      {availableFolders.length > 0 && (
        <View style={styles.folderSection}>
          <Text style={styles.label}>
            Parent Folder
            {suggestedFolder && <Text style={styles.suggested}> (AI suggested: {suggestedFolder})</Text>}
          </Text>
          <TouchableOpacity
            style={styles.folderButton}
            onPress={() => setShowFolderPicker(true)}
          >
            <Text style={styles.folderButtonText}>{getSelectedFolderName()}</Text>
            <Text style={styles.folderButtonArrow}>▼</Text>
          </TouchableOpacity>
          <View style={styles.pathPreview}>
            <Text style={styles.pathLabel}>📁 Upload path:</Text>
            <Text style={styles.pathValue}>{getFolderPath()}</Text>
          </View>
        </View>
      )}

      <Modal
        visible={showFolderPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFolderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowFolderPicker(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Parent Folder</Text>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[
                  styles.folderOption,
                  (!selectedParentFolderId || selectedParentFolderId === 'root') && styles.folderOptionSelected
                ]}
                onPress={() => {
                  setSelectedParentFolderId(null);
                  setShowFolderPicker(false);
                }}
              >
                <Text style={styles.folderOptionText}>None (root)</Text>
                {(!selectedParentFolderId || selectedParentFolderId === 'root') && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
              {availableFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={[
                    styles.folderOption,
                    selectedParentFolderId === folder.id && styles.folderOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedParentFolderId(folder.id);
                    setShowFolderPicker(false);
                  }}
                >
                  <Text style={styles.folderOptionText}>{folder.name}</Text>
                  {selectedParentFolderId === folder.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowFolderPicker(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.costCard}>
        <Text style={styles.costLabel}>API Cost Breakdown</Text>
        <Text style={styles.costDetail}>Input: {inputTokens} tokens</Text>
        <Text style={styles.costDetail}>Output: {outputTokens} tokens</Text>
        <Text style={styles.costValue}>${estimatedCost.toFixed(6)}</Text>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onConfirm({
            ...initial,
            title,
            category,
            year: parseInt(year) || new Date().getFullYear(),
            selectedParentFolderId
          })}
        >
          <Text style={styles.btnText}>Confirm & Upload</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8 },
  label: { fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  folderSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  suggested: {
    fontWeight: '400',
    fontSize: 12,
    color: '#0a8754',
    fontStyle: 'italic'
  },
  folderButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  folderButtonText: {
    fontSize: 14,
    color: '#333'
  },
  folderButtonArrow: {
    fontSize: 12,
    color: '#666'
  },
  pathPreview: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#0066cc'
  },
  pathLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4
  },
  pathValue: {
    fontSize: 13,
    color: '#0066cc',
    fontWeight: '500',
    fontFamily: 'monospace'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center'
  },
  modalScroll: {
    maxHeight: 400
  },
  folderOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  folderOptionSelected: {
    backgroundColor: '#f0f8ff'
  },
  folderOptionText: {
    fontSize: 16,
    color: '#333'
  },
  checkmark: {
    fontSize: 18,
    color: '#0066cc',
    fontWeight: '600'
  },
  modalCloseBtn: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center'
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600'
  },
  costCard: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc'
  },
  costLabel: { fontSize: 11, color: '#666', fontWeight: '500', marginBottom: 4 },
  costDetail: { fontSize: 11, color: '#666' },
  costValue: { fontSize: 16, fontWeight: '700', color: '#0066cc', marginTop: 4 },
  meta: { fontSize: 12, color: '#666', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  secondary: { backgroundColor: '#666' },
  btnText: { color: '#fff' }
});
