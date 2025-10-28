import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function DoneScreen({ result, onDone }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>✅ Uploaded</Text>
      <Text style={styles.small}>File ID: {result?.fileId || 'n/a'}</Text>
      <Text style={styles.small}>Link: {result?.webViewLink || 'n/a'}</Text>
      <TouchableOpacity style={styles.btn} onPress={onDone}>
        <Text style={styles.btnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  big: { fontSize: 18, fontWeight: '700' },
  small: { fontSize: 12, color: '#444' },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginTop: 8 },
  btnText: { color: '#fff' }
});

