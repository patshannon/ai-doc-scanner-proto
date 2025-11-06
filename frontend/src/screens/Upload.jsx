import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function UploadScreen({ analysis, onDone, onBack }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>✅ Processing Complete</Text>
      <Text style={styles.label}>Title:</Text>
      <Text style={styles.value}>{analysis?.title || 'n/a'}</Text>
      <Text style={styles.label}>Category:</Text>
      <Text style={styles.value}>{analysis?.category || 'n/a'}</Text>
      
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
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  btn: { flex: 1, backgroundColor: '#111', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondary: { backgroundColor: '#666' },
  btnText: { color: '#fff', fontWeight: '600' }
});
