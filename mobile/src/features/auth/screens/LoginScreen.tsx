import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { login } from '@/features/auth/api/login'
import { useSessionStore } from '@/store/useSessionStore'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const setSession = useSessionStore((state) => state.setSession)

  const mutation = useMutation({
    mutationFn: () => login({ identifier: email.trim().toLowerCase(), identifierType: 'email', password }),
    onSuccess: (response) => {
      if (response.blocked) {
        Alert.alert('Account blocked', 'Contact support to regain access.')
        return
      }

      if (!response.success || !response.token) {
        Alert.alert('Login failed', response.error || 'Unable to sign in with those credentials.')
        return
      }

      setSession(response.token, response.user)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      Alert.alert('Network error', message)
    }
  })

  const disabled = !email || !password || mutation.isPending

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in to Crypto Mine</Text>
        <Text style={styles.subtitle}>Use the same credentials as the web dashboard.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#475569"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={[styles.button, disabled && styles.buttonDisabled]} onPress={() => mutation.mutate()} disabled={disabled}>
          <Text style={styles.buttonLabel}>{mutation.isPending ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>

        {mutation.isPending && <Text style={styles.helper}>Validating your credentials…</Text>}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    gap: 12
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16
  },
  button: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonLabel: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600'
  },
  helper: {
    textAlign: 'center',
    color: '#94a3b8'
  }
})
