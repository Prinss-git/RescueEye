import { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { QueryClientProvider } from '@tanstack/react-query'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { queryClient, wireAppStateFocus } from './src/api/queryClient'
import WelcomeScreen from './src/screens/WelcomeScreen'
import LoginScreen from './src/screens/LoginScreen'
import MainTabs from './src/navigation/MainTabs'
import { colors } from './src/theme'

function RootNavigator() {
  const { user, loading } = useAuth()
  const [showWelcome, setShowWelcome] = useState(true)

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {user ? (
        <MainTabs />
      ) : showWelcome ? (
        <WelcomeScreen onGetStarted={() => setShowWelcome(false)} />
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  )
}

export default function App() {
  // Pauses all polling while the app is backgrounded — React Native has no
  // window focus events for TanStack Query to hook into on its own.
  useEffect(() => wireAppStateFocus(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  )
}
