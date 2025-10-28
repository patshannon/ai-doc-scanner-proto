import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function HomeScreen({ onStartCamera, onTestGoogle, googleAuth }) {
  const driveStatusText = React.useMemo(() => {
    if (!googleAuth) return 'Google OAuth not linked';
    if (googleAuth.expiresAt && googleAuth.expiresAt <= Date.now()) {
      return 'Google Drive scope expired — re-authorize';
    }
    return 'Google Drive scope ready';
  }, [googleAuth]);

  const driveStatusColor = googleAuth && (!googleAuth.expiresAt || googleAuth.expiresAt > Date.now())
    ? '#0a8754'
    : '#cc6600';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>AI Document Scanner</Text>
        <Text style={styles.subtitle}>Scan, extract, and upload documents to Google Drive</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Drive Status</Text>
          <Text style={[styles.statusText, { color: driveStatusColor }]}>
            {driveStatusText}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onStartCamera}
        >
          <Text style={styles.primaryButtonText}>Start Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onTestGoogle}
        >
          <Text style={styles.secondaryButtonText}>Configure Google OAuth</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111'
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24
  },
  statusCard: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  statusLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500'
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600'
  },
  primaryButton: {
    backgroundColor: '#111',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  secondaryButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '500'
  }
});
