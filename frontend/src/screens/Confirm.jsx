import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function ConfirmScreen({ initial, onConfirm, onBack }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'other');

  const inputTokens = initial?.inputTokens || 0;
  const outputTokens = initial?.outputTokens || 0;
  const estimatedCost = initial?.estimatedCost || 0;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Category</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} />

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
  costLabel: { fontSize: 11, color: '#666', fontWeight: '500', marginBottom: 4 },
  costDetail: { fontSize: 11, color: '#666' },
  costValue: { fontSize: 16, fontWeight: '700', color: '#0066cc', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  secondary: { backgroundColor: '#666' },
  btnText: { color: '#fff' }
});

