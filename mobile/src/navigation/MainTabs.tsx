import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Image, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MissionsScreen from '../screens/MissionsScreen'
import MissionDetailScreen from '../screens/MissionDetailScreen'
import MapScreen from '../screens/MapScreen'
import LogScreen from '../screens/LogScreen'
import ProfileScreen from '../screens/ProfileScreen'
import { colors } from '../theme'

const Tab = createBottomTabNavigator()
const MissionsStack = createNativeStackNavigator()

type IoniconName = keyof typeof Ionicons.glyphMap
const TAB_ICON: Record<string, [IoniconName, IoniconName]> = {
  MISSIONS: ['navigate-outline', 'navigate'],
  MAP:      ['map-outline', 'map'],
  LOG:      ['pulse-outline', 'pulse'],
  PROFILE:  ['person-circle-outline', 'person-circle'],
}

// Small white-tiled logo used as the stack header brand.
function HeaderLogo() {
  return (
    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: '#fff',
      alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
      <Image source={require('../../assets/logo-mark.jpg')} style={{ width: 20, height: 20 }} resizeMode="contain" />
    </View>
  )
}

const headerBase = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: '#ffffff',
  headerTitleStyle: { color: '#ffffff', fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.3 },
  headerShadowVisible: false,
}

function MissionsStackScreen() {
  return (
    <MissionsStack.Navigator screenOptions={headerBase}>
      <MissionsStack.Screen name="MissionsList" component={MissionsScreen}
        options={{ title: 'Missions', headerLeft: () => <HeaderLogo /> }} />
      <MissionsStack.Screen name="MissionDetail" component={MissionDetailScreen}
        options={{ title: 'Mission' }} />
    </MissionsStack.Navigator>
  )
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerBase,
        headerLeft: () => <HeaderLogo />,
        tabBarIcon: ({ focused, color, size }) => {
          const [outline, filled] = TAB_ICON[route.name] ?? ['ellipse-outline', 'ellipse']
          return <Ionicons name={focused ? filled : outline} size={size ?? 22} color={color} />
        },
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor:   colors.navy,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginTop: 1 },
      })}>
      <Tab.Screen name="MISSIONS" component={MissionsStackScreen}
        options={{ title: 'Missions', headerShown: false }} />
      <Tab.Screen name="MAP" component={MapScreen} options={{ title: 'Map' }} />
      <Tab.Screen name="LOG" component={LogScreen} options={{ title: 'Activity' }} />
      <Tab.Screen name="PROFILE" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  )
}
