import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen'
import { WithdrawalsScreen } from '@/features/withdrawals/screens/WithdrawalsScreen'
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen'
import { LoginScreen } from '@/features/auth/screens/LoginScreen'
import { useBootstrapSession } from '@/features/auth/hooks/useBootstrapSession'
import { useSessionStore } from '@/store/useSessionStore'
import { ActivityIndicator, View } from 'react-native'

const Tab = createBottomTabNavigator()

function AuthenticatedTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#020617', borderTopColor: '#1e293b' },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#94a3b8'
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Withdrawals" component={WithdrawalsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

export function AppNavigator() {
  const token = useSessionStore((state) => state.token)
  const { isLoading } = useBootstrapSession()

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
            <ActivityIndicator size="large" color="#38bdf8" />
          </View>
        ) : token ? (
          <AuthenticatedTabs />
        ) : (
          <LoginScreen />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
