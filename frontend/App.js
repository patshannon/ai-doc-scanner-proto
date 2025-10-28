import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import HomeScreen from './src/screens/Home.jsx';
import CameraScreen from './src/screens/Camera.jsx';
import ProcessingScreen from './src/screens/Processing.jsx';
import ConfirmScreen from './src/screens/Confirm.jsx';
import UploadScreen from './src/screens/Upload.jsx';
import DoneScreen from './src/screens/Done.jsx';
import AuthScreen from './src/screens/Auth.jsx';
import GoogleTestScreen from './src/screens/GoogleTest.jsx';
import { auth } from './src/services/firebase.js';

export default function App() {
  const [screen, setScreen] = useState('Home');
  const [capture, setCapture] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [upload, setUpload] = useState(null);
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
      setCapture(null);
      setAnalysis(null);
      setUpload(null);
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
            onCaptured={(cap) => {
              setCapture(cap);
              go('Processing');
            }}
            onTestGoogle={() => go('GoogleTest')}
            googleAuth={googleAuth}
            onBack={() => go('Home')}
          />
        )}
        {screen === 'Processing' && (
          <ProcessingScreen
            capture={capture}
            onAnalyzed={(res) => {
              setAnalysis(res);
              go('Confirm');
            }}
            onBack={() => go('Camera')}
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
            capture={capture}
            analysis={analysis}
            googleAuth={googleAuth}
            onUploaded={(res) => {
              setUpload(res);
              go('Done');
            }}
            onBack={() => go('Confirm')}
          />
        )}
        {screen === 'Done' && (
          <DoneScreen
            result={upload}
            onDone={() => {
              setCapture(null);
              setAnalysis(null);
              setUpload(null);
              go('Home');
            }}
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
