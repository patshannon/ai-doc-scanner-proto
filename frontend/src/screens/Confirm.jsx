import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function ConfirmScreen({ initial, onConfirm, onBack }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'other');

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Category</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} />

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
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  secondary: { backgroundColor: '#666' },
  btnText: { color: '#fff' }
});

