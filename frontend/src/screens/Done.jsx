import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function DoneScreen({ result, onDone }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>✅ Processing Complete</Text>
      <Text style={styles.label}>Title:</Text>
      <Text style={styles.value}>{result?.title || 'n/a'}</Text>
      <Text style={styles.label}>Category:</Text>
      <Text style={styles.value}>{result?.category || 'n/a'}</Text>
      <TouchableOpacity style={styles.btn} onPress={onDone}>
        <Text style={styles.btnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  big: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 12 },
  value: { fontSize: 14, color: '#111' },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginTop: 16 },
  btnText: { color: '#fff' }
});

