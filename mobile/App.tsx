import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Text } from 'react-native'
import FeedScreen from './src/screens/FeedScreen'
import LogScreen  from './src/screens/LogScreen'

const Tab = createBottomTabNavigator()

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { FEED: '▶', LOG: '≡' }
  return (
    <Text style={{ fontSize: 16, color: focused ? '#00d4ff' : 'rgba(255,255,255,0.3)' }}>
      {icons[label] ?? '○'}
    </Text>
  )
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
          tabBarStyle: {
            backgroundColor: '#0d1220',
            borderTopColor: 'rgba(255,255,255,0.07)',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
          },
          tabBarActiveTintColor:   '#00d4ff',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
          tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginTop: 2 },
          headerStyle: { backgroundColor: '#0d1220', borderBottomWidth: 1,
            borderBottomColor: 'rgba(0,212,255,0.15)' } as any,
          headerTitleStyle: { fontFamily: 'monospace', color: '#00d4ff', fontSize: 13,
            fontWeight: 'bold', letterSpacing: 3 },
          headerTintColor: '#00d4ff',
        })}>
        <Tab.Screen name="FEED" component={FeedScreen}
          options={{ title: 'RESCUEEYE · FEED' }} />
        <Tab.Screen name="LOG"  component={LogScreen}
          options={{ title: 'RESCUEEYE · LOG' }} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}
