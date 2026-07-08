import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Text } from 'react-native'
import MissionsScreen from '../screens/MissionsScreen'
import MissionDetailScreen from '../screens/MissionDetailScreen'
import FeedScreen from '../screens/FeedScreen'
import LogScreen from '../screens/LogScreen'
import ProfileScreen from '../screens/ProfileScreen'
import { colors, font } from '../theme'

const Tab = createBottomTabNavigator()
const MissionsStack = createNativeStackNavigator()

const ICONS: Record<string, string> = { MISSIONS: '☑', FEED: '▶', LOG: '≡', PROFILE: '⚉' }

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 16, color: focused ? colors.cyan : colors.textMuted }}>
      {ICONS[label] ?? '○'}
    </Text>
  )
}

function MissionsStackScreen() {
  return (
    <MissionsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.panel },
        headerTitleStyle: { fontFamily: font.mono, color: colors.cyan, fontSize: 13, fontWeight: 'bold', letterSpacing: 3 },
        headerTintColor: colors.cyan,
      }}>
      <MissionsStack.Screen name="MissionsList" component={MissionsScreen}
        options={{ title: 'RESCUEEYE · MISSIONS' }} />
      <MissionsStack.Screen name="MissionDetail" component={MissionDetailScreen}
        options={{ title: 'MISSION DETAIL' }} />
    </MissionsStack.Navigator>
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
      <Tab.Screen name="MISSIONS" component={MissionsStackScreen}
        options={{ title: 'RESCUEEYE · MISSIONS', headerShown: false }} />
      <Tab.Screen name="FEED" component={FeedScreen}
        options={{ title: 'RESCUEEYE · FEED' }} />
      <Tab.Screen name="LOG" component={LogScreen}
        options={{ title: 'RESCUEEYE · LOG' }} />
      <Tab.Screen name="PROFILE" component={ProfileScreen}
        options={{ title: 'RESCUEEYE · PROFILE' }} />
    </Tab.Navigator>
  )
}
