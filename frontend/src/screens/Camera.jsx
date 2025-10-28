import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Minimal prototype: simulate capture without camera wiring.
export default function CameraScreen({ onCaptured, onTestGoogle, googleAuth }) {
  const handleSimulate = () => {
    const now = new Date();
    onCaptured({
      uri: 'placeholder://image.jpg',
      exifDate: now.toISOString(),
      thumbBase64: null
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.help}>Prototype: tap to simulate capture</Text>
      <TouchableOpacity style={styles.btn} onPress={handleSimulate}>
        <Text style={styles.btnText}>Simulate Capture</Text>
      </TouchableOpacity>
      <Text style={styles.oauthStatus}>
        {googleAuth && (!googleAuth.expiresAt || googleAuth.expiresAt > Date.now())
          ? 'Google Drive scope granted'
          : 'Google OAuth not linked'}
      </Text>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onTestGoogle}>
        <Text style={styles.secondaryText}>Test Google OAuth</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  help: { color: '#444', marginBottom: 16 },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  oauthStatus: { marginTop: 20, color: '#333' },
  secondaryBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  secondaryText: { color: '#333', fontWeight: '500' }
});
