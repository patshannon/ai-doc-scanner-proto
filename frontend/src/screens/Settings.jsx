import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';

// This tells the browser to return to the app after auth
WebBrowser.maybeCompleteAuthSession();

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const STORAGE_KEY = 'google_auth_token';

export default function SettingsScreen({ onBack, onUpdateAuth, initialAuth }) {
  const [status, setStatus] = useState('idle');
  const [authInfo, setAuthInfo] = useState(initialAuth || null);

  const ids = {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB
  };

  const readyForAuth = Boolean(ids.expoClientId);

  // Use the iOS reversed client ID as the redirect URI for native, let SDK handle web
  const redirectUri = Platform.select({
    web: undefined,
    default: 'com.googleusercontent.apps.935524565569-6majtpkip3kn9qjk740lnj1sjai9lcd3:/'
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: ids.expoClientId,
    iosClientId: ids.iosClientId || ids.expoClientId,
    androidClientId: ids.androidClientId || ids.expoClientId,
    webClientId: ids.webClientId,
    scopes: ['openid', 'profile', 'email', DRIVE_FILE_SCOPE, DRIVE_METADATA_SCOPE],
    redirectUri
  });

  useEffect(() => {
    if (!response) return;

    const handleResponse = async () => {
      if (response.type === 'success') {
        const { authentication } = response;
        const info = {
          accessToken: authentication?.accessToken || null,
          tokenType: authentication?.tokenType || 'Bearer',
          expiresIn: authentication?.expiresIn || null,
          issuedAt: Date.now(),
          scopes: request?.scopes || [],
          refreshToken: authentication?.refreshToken || null
        };
        
        // Calculate expiration time
        const expiresAt = info.expiresIn ? Date.now() + info.expiresIn * 1000 : null;
        const authData = { ...info, expiresAt };

        setAuthInfo(authData);
        setStatus('success');
        
        // Persist token
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
          if (onUpdateAuth) onUpdateAuth(authData);
        } catch (e) {
          console.error('Failed to save token', e);
        }

      } else if (response.type === 'error') {
        setStatus('error');
        Alert.alert('Authentication Failed', response.error?.message || 'Something went wrong');
      } else if (response.type === 'dismiss' || response.type === 'cancel') {
        setStatus('idle');
      }
    };

    handleResponse();
  }, [response]);

  const handleConnect = async () => {
    setStatus('pending');
    try {
      await promptAsync({ showInRecents: true });
    } catch (err) {
      setStatus('error');
      Alert.alert('Error', err.message || 'Failed to start OAuth');
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Google Drive',
      'Are you sure you want to disconnect? You will need to sign in again to upload documents.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              setAuthInfo(null);
              if (onUpdateAuth) onUpdateAuth(null);
            } catch (e) {
              console.error('Failed to remove token', e);
            }
          }
        }
      ]
    );
  };

  const isConnected = authInfo && (!authInfo.expiresAt || authInfo.expiresAt > Date.now());

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Connection Card */}
        <View style={styles.card}>
          <LinearGradient
            colors={['#1a2133', '#101420']}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="logo-google" size={28} color="#fff" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Google Drive</Text>
                <Text style={styles.cardSubtitle}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </Text>
              </View>
              {isConnected && (
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#30bfa1" />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              )}
            </View>

            <Text style={styles.description}>
              Connect your Google Drive to automatically save scanned documents to your cloud storage. 
              We require access to create files and read folder metadata.
            </Text>

            {!readyForAuth && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={20} color="#ff6b6b" />
                <Text style={styles.warningText}>
                  Missing Client IDs. Please check your configuration.
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              {isConnected ? (
                <TouchableOpacity 
                  style={styles.disconnectButton}
                  onPress={handleDisconnect}
                >
                  <Text style={styles.disconnectText}>Disconnect Account</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.connectButton, (!request || !readyForAuth) && styles.disabledButton]}
                  onPress={handleConnect}
                  disabled={!request || !readyForAuth}
                >
                  <LinearGradient
                    colors={['#30bfa1', '#25a085']}
                    style={styles.connectGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.connectText}>
                      {status === 'pending' ? 'Connecting...' : 'Connect Google Drive'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <View style={styles.permissionItem}>
            <Ionicons name="folder-open-outline" size={24} color="#8ca3ff" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>View Metadata</Text>
              <Text style={styles.permissionDesc}>Read folder names to organize your files.</Text>
            </View>
          </View>
          <View style={styles.permissionItem}>
            <Ionicons name="document-text-outline" size={24} color="#8ca3ff" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Create Files</Text>
              <Text style={styles.permissionDesc}>Upload new PDFs to your Drive.</Text>
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#05060b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    padding: 24,
    gap: 32,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardGradient: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#b0b8d1',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 191, 161, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    color: '#30bfa1',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  warningText: {
    color: '#ff6b6b',
    fontSize: 13,
    flex: 1,
  },
  actions: {
    gap: 12,
  },
  connectButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  connectGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  connectText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  disconnectText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  infoSection: {
    gap: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 16,
    borderRadius: 16,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionDesc: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
