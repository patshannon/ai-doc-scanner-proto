import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function HomeScreen({ onStartCamera, onTestGoogle, googleAuth }) {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    const checkBackend = async () => {
      if (!API_BASE) {
        console.log('[Network] No API_BASE configured, using mocks');
        setBackendStatus('mocks');
        return;
      }

      try {
        console.log(`[Network] Checking backend at ${API_BASE}/healthz`);
        const res = await fetch(`${API_BASE}/healthz`, { method: 'GET' });
        if (res.ok) {
          console.log('[Network] ✓ Backend is reachable');
          setBackendStatus('connected');
        } else {
          console.warn(`[Network] Backend returned ${res.status}`);
          setBackendStatus('error');
        }
      } catch (e) {
        console.error('[Network] Backend unreachable:', e.message);
        setBackendStatus('offline');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

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

  const backendStatusText = useMemo(() => {
    switch (backendStatus) {
      case 'checking': return 'Checking backend…';
      case 'connected': return `✓ Backend connected (${API_BASE})`;
      case 'offline': return `✗ Backend offline (${API_BASE})`;
      case 'error': return 'Backend error';
      case 'mocks': return 'Using mock responses';
      default: return 'Unknown';
    }
  }, [backendStatus]);

  const backendColor = {
    checking: '#999',
    connected: '#0a8754',
    offline: '#b00020',
    error: '#cc6600',
    mocks: '#0066cc'
  }[backendStatus] || '#999';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>AI Document Scanner</Text>
        <Text style={styles.subtitle}>Scan, extract, and upload documents to Google Drive</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Backend Status</Text>
          <Text style={[styles.statusText, { color: backendColor }]}>
            {backendStatusText}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Drive Status</Text>
          <Text style={[styles.statusText, { color: driveStatusColor }]}>
            {driveStatusText}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onStartCamera}
          disabled={backendStatus === 'offline'}
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
