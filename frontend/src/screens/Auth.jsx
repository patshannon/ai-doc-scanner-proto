import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Welcome</Text>
            <Text style={styles.title}>Doc AI Scanner</Text>
            <Text style={styles.subtitle}>
              {mode === 'signIn' ? 'Sign in to access your documents' : 'Create an account to get started'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#6b7a99" style={styles.inputIcon} />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email Address"
                placeholderTextColor="#6b7a99"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6b7a99" style={styles.inputIcon} />
              <TextInput
                autoCapitalize="none"
                secureTextEntry
                placeholder="Password"
                placeholderTextColor="#6b7a99"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#ff6b6b" />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.buttonContainer, busy && styles.disabled]}
              onPress={handleSubmit}
              disabled={busy}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#30bfa1', '#25a085']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>
                  {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Create Account'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleMode} style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {mode === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.switchHighlight}>
                  {mode === 'signIn' ? "Sign Up" : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {!hasConfig ? (
            <View style={styles.configHint}>
              <Ionicons name="information-circle-outline" size={16} color="#f59b23" />
              <Text style={styles.hintText}>
                Firebase config missing in .env
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060b',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 40,
  },
  greeting: {
    color: '#8ca3ff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    color: '#b0b8d1',
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c101b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    height: '100%',
  },
  buttonContainer: {
    marginTop: 8,
    borderRadius: 12,
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
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.7,
  },
  switchContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#6b7a99',
    fontSize: 14,
  },
  switchHighlight: {
    color: '#30bfa1',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    flex: 1,
  },
  configHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
    opacity: 0.7,
  },
  hintText: {
    color: '#f59b23',
    fontSize: 12,
  }
});
