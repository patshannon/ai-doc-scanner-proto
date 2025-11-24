import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/Home.jsx';
import CameraScreen from './src/screens/Camera.jsx';
import PageReviewScreen from './src/screens/PageReview.jsx';
import ProcessingScreen from './src/screens/Processing.jsx';
import ConfirmScreen from './src/screens/Confirm.jsx';
import UploadScreen from './src/screens/Upload.jsx';
import AuthScreen from './src/screens/Auth.jsx';
import SettingsScreen from './src/screens/Settings.jsx';
import { auth } from './src/services/firebase.js';
import { Header } from './src/components/Header.jsx';

const MAX_PAGES = 5;
const STORAGE_KEY = 'google_auth_token';

export default function App() {
  const [screen, setScreen] = useState('Home');
  const [captures, setCaptures] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [googleAuth, setGoogleAuth] = useState(null);

  const go = (name) => setScreen(name);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Load persisted Google Auth token
  useEffect(() => {
    const loadToken = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Optional: Check if expired here, but we also check in useMemo
          setGoogleAuth(parsed);
        }
      } catch (e) {
        console.error('Failed to load google token', e);
      }
    };
    loadToken();
  }, []);

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (e) {
      // Ignore sign-out errors in prototype.
    }
  };

  useEffect(() => {
    if (!user) {
      setScreen('Home');
      setCaptures([]);
      setAnalysis(null);
      // Don't clear googleAuth on sign out, as it's a separate integration
      // But if you wanted to, you could: setGoogleAuth(null);
    }
  }, [user]);

  const driveStatus = useMemo(() => {
    if (!googleAuth) return 'Drive scope not linked';
    if (googleAuth.expiresAt && googleAuth.expiresAt <= Date.now()) {
      return 'Drive scope expired — reconnect in Settings';
    }
    return 'Drive scope ready';
  }, [googleAuth]);

  if (!authReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!user && auth) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <AuthScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Header
          title="Doc AI"
          subtitle={screen}
          driveStatus={driveStatus}
          onSignOut={handleSignOut}
          showSignOut={!!(user && auth)}
          googleAuth={googleAuth}
        />
        {screen === 'Home' && (
          <HomeScreen
            onStartCamera={() => go('Camera')}
            onTestGoogle={() => go('Settings')}
            googleAuth={googleAuth}
          />
        )}
        {screen === 'Camera' && (
          <CameraScreen
            captures={captures}
            maxPages={MAX_PAGES}
            onAddCapture={(cap) => {
              setCaptures((prev) => {
                if (prev.length >= MAX_PAGES) return prev;
                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                return [...prev, { ...cap, id }];
              });
            }}
            onRemoveCapture={(id) => {
              setCaptures((prev) => prev.filter((c) => c.id !== id));
            }}
            onRequestReview={() => go('PageReview')}
            onTestGoogle={() => go('Settings')}
            googleAuth={googleAuth}
            onBack={() => go('Home')}
          />
        )}
        {screen === 'PageReview' && (
          <PageReviewScreen
            captures={captures}
            maxPages={MAX_PAGES}
            onRemove={(id) => setCaptures((prev) => prev.filter((c) => c.id !== id))}
            onReorder={(fromIndex, direction) => {
              setCaptures((prev) => {
                const targetIndex = fromIndex + direction;
                if (targetIndex < 0 || targetIndex >= prev.length) {
                  return prev;
                }
                const clone = [...prev];
                const [moved] = clone.splice(fromIndex, 1);
                clone.splice(targetIndex, 0, moved);
                return clone;
              });
            }}
            onAddMore={() => go('Camera')}
            onStartOver={() => {
              setCaptures([]);
              setAnalysis(null);
              go('Camera');
            }}
            onContinue={() => {
              if (captures.length === 0) return;
              go('Processing');
            }}
            onBack={() => go('Camera')}
          />
        )}
        {screen === 'Processing' && (
          <ProcessingScreen
            captures={captures}
            googleAuth={googleAuth}
            onAnalyzed={(res) => {
              setAnalysis(res);
              go('Confirm');
            }}
            onBack={() => go('PageReview')}
          />
        )}
        {screen === 'Confirm' && (
          <ConfirmScreen
            initial={analysis}
            onConfirm={(edited) => {
              setAnalysis(edited);
              go('Upload');
            }}
            onBack={() => go('Processing')}
          />
        )}
        {screen === 'Upload' && (
          <UploadScreen
            analysis={analysis}
            googleAuth={googleAuth}
            onDone={() => {
              setCaptures([]);
              setAnalysis(null);
              go('Home');
            }}
            onBack={() => go('Confirm')}
          />
        )}
        {screen === 'Settings' && (
          <SettingsScreen
            initialAuth={googleAuth}
            onUpdateAuth={(info) => setGoogleAuth(info)}
            onBack={() => go('Home')}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060b' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05060b' },
});
