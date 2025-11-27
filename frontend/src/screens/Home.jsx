import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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
        const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
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
    if (!googleAuth) return 'Not Linked';
    if (googleAuth.expiresAt && googleAuth.expiresAt <= Date.now()) {
      return 'Expired';
    }
    return 'Connected';
  }, [googleAuth]);

  const backendStatusText = useMemo(() => {
    switch (backendStatus) {
      case 'checking': return 'Checking...';
      case 'connected': return 'Online';
      case 'offline': return 'Offline';
      case 'error': return 'Error';
      case 'mocks': return 'Mock Mode';
      default: return 'Unknown';
    }
  }, [backendStatus]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#30bfa1';
      case 'online': return '#30bfa1';
      case 'offline': return '#ff6b6b';
      case 'error': return '#f59b23';
      case 'mocks': return '#7f9cf5';
      default: return '#999';
    }
  };

  const featureHighlights = [
    { title: 'Smart Capture', desc: 'Live capture with auto-cleanup', icon: 'camera-outline' },
    { title: 'AI Processing', desc: 'Auto-titles & categorizes docs', icon: 'sparkles-outline' },
    { title: 'Drive Sync', desc: 'Seamless upload to Google Drive', icon: 'cloud-upload-outline' }
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Hero Section */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome Back</Text>
          <Text style={styles.title}>Doc AI Scanner</Text>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#1a2133', '#101420']}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Scan. Process. Archive.</Text>
              <Text style={styles.heroSubtitle}>
                Transform physical documents into organized digital assets with AI-powered intelligence.
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Status Section */}
        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(backendStatus) }]} />
            <View>
              <Text style={styles.statusLabel}>Backend</Text>
              <Text style={styles.statusValue}>{backendStatusText}</Text>
            </View>
          </View>
          <View style={styles.statusCard}>
            <View style={[styles.statusDot, { backgroundColor: googleAuth ? '#30bfa1' : '#ff6b6b' }]} />
            <View>
              <Text style={styles.statusLabel}>Google Drive</Text>
              <Text style={styles.statusValue}>{driveStatusText}</Text>
            </View>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capabilities</Text>
          <View style={styles.featuresGrid}>
            {featureHighlights.map((item, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Ionicons name={item.icon} size={24} color="#30bfa1" />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.actions}> 
          <TouchableOpacity
            style={[styles.primaryButton, backendStatus === 'offline' && styles.disabledButton]}
            onPress={onStartCamera}
            disabled={backendStatus === 'offline'}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#30bfa1', '#25a085']}
              style={styles.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryText}>Start New Scan</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={onTestGoogle}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>Configure Settings</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060b',
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
    gap: 32,
  },
  header: {
    marginBottom: 8,
  },
  greeting: {
    color: '#8ca3ff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  heroGradient: {
    padding: 24,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  heroSubtitle: {
    color: '#b0b8d1',
    fontSize: 16,
    lineHeight: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c101b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    color: '#6b7a99',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusValue: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  featuresGrid: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(48, 191, 161, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDesc: {
    color: '#94a3b8',
    fontSize: 14,
  },
  actions: {
    gap: 16,
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#30bfa1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  primaryGradient: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryText: {
    color: '#cbd6ff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
