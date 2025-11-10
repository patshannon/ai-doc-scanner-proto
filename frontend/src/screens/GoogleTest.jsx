import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// This tells the browser to return to the app after auth
WebBrowser.maybeCompleteAuthSession();

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';

export default function GoogleTestScreen({ onBack, onResult, initial }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [authInfo, setAuthInfo] = useState(initial || null);

  const ids = {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB
  };

  const readyForAuth = Boolean(ids.expoClientId);

  // Use the iOS reversed client ID as the redirect URI
  // This is the standard format for native iOS OAuth with Google
  const redirectUri = 'com.googleusercontent.apps.935524565569-6majtpkip3kn9qjk740lnj1sjai9lcd3:/';

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
      setAuthInfo(info);
      setStatus('success');
      setError(null);
      if (onResult) {
        onResult({
          ...info,
          expiresAt: info.expiresIn ? Date.now() + info.expiresIn * 1000 : null
        });
      }
    } else if (response.type === 'error') {
      setStatus('error');
      setError(response.error?.message || 'OAuth failed');
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setStatus('idle');
    }
  }, [response]);

  const handlePrompt = async () => {
    setError(null);
    setStatus('pending');
    try {
      await promptAsync({ showInRecents: true });
    } catch (err) {
      setError(err.message || 'Failed to start OAuth');
      setStatus('error');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Google OAuth Test</Text>
      <Text style={styles.copy}>
        Use this flow to confirm Drive access (`drive.file` and `drive.metadata.readonly` scopes) and capture an access token for uploads and folder scanning.
      </Text>
      {!readyForAuth ? (
        <Text style={styles.warning}>
          Missing `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`. Update `frontend/.env` with your Google OAuth client IDs first.
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.primary, (!request || !readyForAuth) && styles.disabled]}
        onPress={handlePrompt}
        disabled={!request || !readyForAuth}
      >
        <Text style={styles.primaryText}>
          {status === 'pending' ? 'Opening Google…' : 'Start Google Sign-In'}
        </Text>
      </TouchableOpacity>
      {status === 'error' && error ? (
        <Text style={styles.error}>Error: {error}</Text>
      ) : null}
      {authInfo ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Latest Grant</Text>
          <Text style={styles.resultRow}>
            Access Token: {authInfo.accessToken ? `${authInfo.accessToken.slice(0, 16)}…` : 'none'}
          </Text>
          <Text style={styles.resultRow}>
            Token Type: {authInfo.tokenType}
          </Text>
          <Text style={styles.resultRow}>
            Expires In: {authInfo.expiresIn ? `${authInfo.expiresIn}s` : 'n/a'}
          </Text>
          <Text style={styles.resultRow}>
            Scopes: {authInfo.scopes.join(', ')}
          </Text>
          <Text style={styles.resultRow}>
            Refresh Token: {authInfo.refreshToken ? 'received' : 'not provided'}
          </Text>
        </View>
      ) : (
        <Text style={styles.copy}>No token yet. Run the sign-in to generate one.</Text>
      )}
      <TouchableOpacity style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, gap: 16 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  copy: { fontSize: 14, color: '#555' },
  warning: { color: '#b00020', fontSize: 13 },
  primary: {
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  error: { color: '#b00020' },
  resultBox: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#fafafa',
    gap: 6
  },
  resultTitle: { fontWeight: '600' },
  resultRow: { fontSize: 13, color: '#333' },
  back: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  backText: { color: '#333' }
});
