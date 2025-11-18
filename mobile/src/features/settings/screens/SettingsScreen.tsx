import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSessionStore } from '@/store/useSessionStore'

export function SettingsScreen() {
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)

  const handleLogout = () => {
    clearSession()
    Alert.alert('Signed out', 'You have been signed out on this device.')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Account</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name ?? '—'}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>
        <Text style={styles.label}>Referral Code</Text>
        <Text style={[styles.value, styles.monospace]}>{user?.referralCode ?? '—'}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonLabel}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617'
  },
  content: {
    padding: 16,
    gap: 20
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase'
  },
  value: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '500'
  },
  monospace: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })
  },
  button: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  buttonLabel: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600'
  }
})
