import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function UploadScreen({ analysis, onDone, onBack }) {
  // Rough cost estimate for Gemini 2.5 Flash Vision API
  // Input tokens (image + prompt): ~500-1000 tokens avg (~$0.075 per 1M)
  // Output tokens (title + category): ~50 tokens avg (~$0.30 per 1M)
  const estimatedCost = (
    (750 * 0.075 / 1000000) + 
    (50 * 0.30 / 1000000)
  ).toFixed(6);

  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>✅ Processing Complete</Text>
      <Text style={styles.label}>Title:</Text>
      <Text style={styles.value}>{analysis?.title || 'n/a'}</Text>
      <Text style={styles.label}>Category:</Text>
      <Text style={styles.value}>{analysis?.category || 'n/a'}</Text>
      
      <View style={styles.costCard}>
        <Text style={styles.costLabel}>Est. API Cost:</Text>
        <Text style={styles.costValue}>${estimatedCost}</Text>
      </View>
      
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
  big: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 12 },
  value: { fontSize: 14, color: '#111' },
  costCard: { 
    backgroundColor: '#f5f5f5', 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc'
  },
  costLabel: { fontSize: 11, color: '#666', fontWeight: '500' },
  costValue: { fontSize: 16, fontWeight: '700', color: '#0066cc' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  btn: { flex: 1, backgroundColor: '#111', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondary: { backgroundColor: '#666' },
  btnText: { color: '#fff', fontWeight: '600' }
});
