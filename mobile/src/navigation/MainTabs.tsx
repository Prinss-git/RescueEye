import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import FeedScreen from '../screens/FeedScreen'
import LogScreen from '../screens/LogScreen'
import ProfileScreen from '../screens/ProfileScreen'
import { colors, font } from '../theme'

const Tab = createBottomTabNavigator()

const ICONS: Record<string, string> = { FEED: '▶', LOG: '≡', PROFILE: '⚉' }

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 16, color: focused ? colors.cyan : colors.textMuted }}>
      {ICONS[label] ?? '○'}
    </Text>
  )
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   colors.cyan,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: font.mono, fontSize: 9, letterSpacing: 1, marginTop: 2 },
        headerStyle: { backgroundColor: colors.panel, borderBottomWidth: 1,
          borderBottomColor: colors.borderCyan } as any,
        headerTitleStyle: { fontFamily: font.mono, color: colors.cyan, fontSize: 13,
          fontWeight: 'bold', letterSpacing: 3 },
        headerTintColor: colors.cyan,
      })}>
      <Tab.Screen name="FEED" component={FeedScreen}
        options={{ title: 'RESCUEEYE · FEED' }} />
      <Tab.Screen name="LOG" component={LogScreen}
        options={{ title: 'RESCUEEYE · LOG' }} />
      <Tab.Screen name="PROFILE" component={ProfileScreen}
        options={{ title: 'RESCUEEYE · PROFILE' }} />
    </Tab.Navigator>
  )
}
