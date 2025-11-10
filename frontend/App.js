import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import HomeScreen from './src/screens/Home.jsx';
import CameraScreen from './src/screens/Camera.jsx';
import PageReviewScreen from './src/screens/PageReview.jsx';
import ProcessingScreen from './src/screens/Processing.jsx';
import ConfirmScreen from './src/screens/Confirm.jsx';
import UploadScreen from './src/screens/Upload.jsx';
import AuthScreen from './src/screens/Auth.jsx';
import GoogleTestScreen from './src/screens/GoogleTest.jsx';
import { auth } from './src/services/firebase.js';

const MAX_PAGES = 5;

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
      setGoogleAuth(null);
    }
  }, [user]);

  const driveStatus = useMemo(() => {
    if (!googleAuth) return 'Drive scope not linked';
    if (googleAuth.expiresAt && googleAuth.expiresAt <= Date.now()) {
      return 'Drive scope expired — re-run Google test';
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
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Doc AI Prototype</Text>
            <Text style={styles.subtitle}>{screen}</Text>
            <Text style={[styles.status, googleAuth ? styles.ready : styles.warn]}>{driveStatus}</Text>
          </View>
          {user && auth ? (
            <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {screen === 'Home' && (
          <HomeScreen
            onStartCamera={() => go('Camera')}
            onTestGoogle={() => go('GoogleTest')}
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
            onTestGoogle={() => go('GoogleTest')}
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
        {screen === 'GoogleTest' && (
          <GoogleTestScreen
            initial={googleAuth}
            onResult={(info) => setGoogleAuth(info)}
            onBack={() => go('Home')}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTextWrap: { gap: 2 },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 4 },
  signOut: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#f2f2f2' },
  signOutText: { color: '#333', fontSize: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { fontSize: 11 },
  ready: { color: '#0a8754' },
  warn: { color: '#cc6600' }
});
