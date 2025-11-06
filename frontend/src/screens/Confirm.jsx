import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function ConfirmScreen({ initial, onConfirm, onBack }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'other');

  // Rough cost estimate for Gemini 2.5 Flash Vision API
  // Input tokens (image + prompt): ~500-1000 tokens avg (~$0.075 per 1M)
  // Output tokens (title + category): ~50 tokens avg (~$0.30 per 1M)
  const estimatedCost = (
    (750 * 0.075 / 1000000) + 
    (50 * 0.30 / 1000000)
  ).toFixed(6);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Category</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} />

      <View style={styles.costCard}>
        <Text style={styles.costLabel}>Est. API Cost:</Text>
        <Text style={styles.costValue}>${estimatedCost}</Text>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onConfirm({ ...initial, title, category })}
        >
          <Text style={styles.btnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8 },
  label: { fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  costCard: { 
    backgroundColor: '#f5f5f5', 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc'
  },
  costLabel: { fontSize: 11, color: '#666', fontWeight: '500' },
  costValue: { fontSize: 16, fontWeight: '700', color: '#0066cc' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  secondary: { backgroundColor: '#666' },
  btnText: { color: '#fff' }
});

