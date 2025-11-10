import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function HomeScreen({ onStartCamera, onTestGoogle, googleAuth }) {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    const checkBackend = async () => {
      if (!API_BASE) {
        setBackendStatus('mocks');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/healthz`, { method: 'GET' });
        setBackendStatus(res.ok ? 'connected' : 'error');
      } catch (e) {
        console.warn('[Network] Backend unreachable', e.message);
        setBackendStatus('offline');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  const driveStatusText = useMemo(() => {
    if (!googleAuth) return 'Google OAuth not linked';
    if (googleAuth.expiresAt && googleAuth.expiresAt <= Date.now()) {
      return 'Drive scope expired — re-authorize';
    }
    return 'Drive scope ready';
  }, [googleAuth]);

  const backendStatusText = useMemo(() => {
    switch (backendStatus) {
      case 'checking': return 'Checking backend…';
      case 'connected': return `✓ Backend connected`;
      case 'offline': return 'Backend offline';
      case 'error': return 'Backend error';
      case 'mocks': return 'Running with mocks';
      default: return 'Status unknown';
    }
  }, [backendStatus]);

  const backendColor = {
    checking: '#999',
    connected: '#30bfa1',
    offline: '#ff6b6b',
    error: '#f59b23',
    mocks: '#7f9cf5'
  }[backendStatus] || '#999';

  const featureHighlights = [
    'Live capture and cleanup before conversion',
    'Gemini 2.0 suggests titles, categories, and folder paths',
    'PDFs uploaded securely to Documents/{Category}/{Year} on Drive'
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Doc AI Scanner</Text>
          <Text style={styles.subtitle}>Snap an invoice, receipt, or contract and let the backend auto-title, categorize, and archive it.</Text>
          <Text style={styles.helper}>You will confirm the auto-generated metadata before uploading to Drive.</Text>
        </View>

        <View style={styles.statusList}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Backend</Text>
            <Text style={[styles.statusText, { color: backendColor }]}>{backendStatusText}</Text>
            <Text style={styles.statusDetail}>{API_BASE ? API_BASE : 'No base URL configured'}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Drive</Text>
            <Text style={[styles.statusText, { color: googleAuth ? '#30bfa1' : '#ff6b6b' }]}>{driveStatusText}</Text>
            <Text style={styles.statusDetail}>Scope: drive.file</Text>
          </View>
        </View>

        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>What happens here</Text>
          {featureHighlights.map((item) => (
            <View key={item} style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}> 
          <TouchableOpacity
            style={[styles.primaryButton, backendStatus === 'offline' && styles.disabledButton]}
            onPress={onStartCamera}
            disabled={backendStatus === 'offline'}
          >
            <Text style={styles.primaryText}>Start capture sequence</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onTestGoogle}>
            <Text style={styles.secondaryText}>Configure Google OAuth</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060b'
  },
  scroll: {
    padding: 20,
    gap: 16
  },
  heroCard: {
    backgroundColor: '#101420',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20
      },
      android: {
        elevation: 8
      }
    })
  },
  title: {
    color: '#fdfefe',
    fontSize: 28,
    fontWeight: '700'
  },
  subtitle: {
    color: '#dfe6ff',
    fontSize: 16,
    marginTop: 8,
    lineHeight: 22
  },
  helper: {
    color: '#8ca3ff',
    marginTop: 12,
    fontSize: 13
  },
  statusList: {
    flexDirection: 'row',
    gap: 12
  },
  statusItem: {
    flex: 1,
    backgroundColor: '#0b0f1d',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  statusLabel: {
    color: '#7c8dbf',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 6
  },
  statusDetail: {
    fontSize: 12,
    color: '#a0b1db',
    marginTop: 6
  },
  featuresCard: {
    backgroundColor: '#0c1221',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  featuresTitle: {
    color: '#e7eeff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#30bfa1',
    marginRight: 10
  },
  featureText: {
    flex: 1,
    color: '#c9d3f2',
    fontSize: 13,
    lineHeight: 18
  },
  actions: {
    marginTop: 4,
    gap: 12
  },
  primaryButton: {
    backgroundColor: '#30bfa1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center'
  },
  primaryText: {
    color: '#04140d',
    fontSize: 16,
    fontWeight: '700'
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2e3b78',
    alignItems: 'center'
  },
  secondaryText: {
    color: '#cbd6ff',
    fontSize: 15,
    fontWeight: '600'
  },
  disabledButton: {
    opacity: 0.45
  }
});
