import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';

export default function ConfirmScreen({ initial, onConfirm, onBack }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'other');
  const [year, setYear] = useState(String(initial?.year || new Date().getFullYear()));
  const [folderPath, setFolderPath] = useState(initial?.suggestedPath || '');
  const pageCount = initial?.pageCount || 1;

  const inputTokens = initial?.inputTokens || 0;
  const outputTokens = initial?.outputTokens || 0;
  const estimatedCost = initial?.estimatedCost || 0;
  const pathReason = initial?.pathReason || '';
  const isExistingPath = initial?.isExistingPath || false;

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

      <Text style={styles.label}>
        Folder Path
        <Text style={styles.pathBadge}> {isExistingPath ? '✓ Existing' : '+ New'}</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={folderPath}
        onChangeText={setFolderPath}
        placeholder="/Work/Resumes/2025"
      />

      {pathReason && (
        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>💡 AI Reasoning</Text>
          <Text style={styles.reasonText}>{pathReason}</Text>
        </View>
      )}

      <View style={styles.pathPreview}>
        <Text style={styles.pathLabel}>📁 Full upload path:</Text>
        <Text style={styles.pathValue}>{folderPath || '/'}  › {title || 'untitled'}.pdf</Text>
        <Text style={styles.meta}>Pages: {pageCount}</Text>
      </View>

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
            confirmedPath: folderPath
          })}
        >
          <Text style={styles.btnText}>Confirm & Upload</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16, backgroundColor: '#05060b', flexGrow: 1 },
  label: { fontWeight: '600', marginTop: 8, color: '#e2e8f0', fontSize: 14 },
  input: { 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 12, 
    padding: 14, 
    color: '#fff', 
    backgroundColor: '#0c101b',
    fontSize: 16
  },
  pathBadge: {
    fontWeight: '600',
    fontSize: 11,
    color: '#30bfa1',
    backgroundColor: 'rgba(48, 191, 161, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    overflow: 'hidden'
  },
  reasonCard: {
    marginTop: 8,
    padding: 16,
    backgroundColor: 'rgba(245, 155, 35, 0.1)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59b23'
  },
  reasonLabel: {
    fontSize: 12,
    color: '#f59b23',
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  reasonText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontStyle: 'italic',
    lineHeight: 20
  },
  pathPreview: {
    marginTop: 12,
    padding: 16,
    backgroundColor: 'rgba(48, 191, 161, 0.05)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#30bfa1'
  },
  pathLabel: {
    fontSize: 12,
    color: '#30bfa1',
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  pathValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6
  },
  costCard: {
    backgroundColor: '#0c101b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  costLabel: { fontSize: 12, color: '#6b7a99', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  costDetail: { fontSize: 12, color: '#94a3b8' },
  costValue: { fontSize: 18, fontWeight: '700', color: '#30bfa1', marginTop: 4 },
  meta: { fontSize: 12, color: '#6b7a99', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  btn: { 
    flex: 1,
    backgroundColor: '#30bfa1', 
    paddingVertical: 16, 
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondary: { 
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 }
});
