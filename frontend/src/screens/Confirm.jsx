import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function ConfirmScreen({ initial, onConfirm, onBack }) {
  const [docType, setDocType] = useState(initial?.docType || 'other');
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || '');
  const [folderPath, setFolderPath] = useState(initial?.folderPath || '');

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.label}>Type</Text>
      <TextInput style={styles.input} value={docType} onChangeText={setDocType} />
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} />
      <Text style={styles.label}>Folder Path</Text>
      <TextInput style={styles.input} value={folderPath} onChangeText={setFolderPath} />

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onConfirm({ ...initial, docType, title, date, folderPath })}
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

