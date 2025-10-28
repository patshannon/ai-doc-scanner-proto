import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, hasConfig } from '../services/firebase.js';

export default function AuthScreen() {
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggleMode = () => {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!hasConfig) {
      setError('Firebase config missing. Update your .env file.');
      return;
    }
    if (!email || !password) {
      setError('Email and password required.');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      if (mode === 'signUp') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) {
      setError(e.message || 'Auth failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Doc AI Prototype</Text>
      <Text style={styles.subtitle}>{mode === 'signIn' ? 'Sign In' : 'Create Account'}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        autoCapitalize="none"
        secureTextEntry
        placeholder="Password"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, busy && styles.disabled]}
        onPress={handleSubmit}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Sign Up'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={toggleMode}>
        <Text style={styles.switchText}>
          {mode === 'signIn' ? "Need an account? Sign Up" : 'Already registered? Sign In'}
        </Text>
      </TouchableOpacity>
      {!hasConfig ? (
        <Text style={styles.hint}>
          Provide Firebase web config variables in `frontend/.env` to enable authentication.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#555' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12
  },
  button: {
    width: '100%',
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
  switchText: { color: '#0066cc', marginTop: 8 },
  error: { color: '#b00020' },
  hint: { fontSize: 12, color: '#777', textAlign: 'center', marginTop: 12 }
});

