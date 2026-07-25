import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { SERVER_BASE } from '../config'
import { useAuth } from '../context/AuthContext'
import { colors, font, radius, spacing } from '../theme'

const LOCATION_REPORT_MS = 30_000

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
})

export interface Mission {
  id: string
  incidentId: string
  teamId: string
  status: string
  medicalRequired: boolean | null
  createdAt: string
}

interface Incident {
  id: string
  type: string
  severity: string
  description: string
  lat: number
  lng: number
}

type IoniconName = keyof typeof Ionicons.glyphMap

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'New Dispatch', ACCEPTED: 'Accepted', DECLINED: 'Declined',
  EN_ROUTE: 'En Route', ON_SITE: 'On Site', TREATING: 'Treating', COMPLETED: 'Completed',
}
const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: colors.alert, ACCEPTED: colors.cyan, DECLINED: colors.textMuted,
  EN_ROUTE: colors.amber, ON_SITE: colors.emerald, TREATING: colors.orange, COMPLETED: colors.green,
}
const TYPE_LABEL: Record<string, string> = {
  VICTIM_DETECTED: 'Victim Detected', FLOOD: 'Flood Damage', FIRE: 'Fire Damage',
  STRUCTURAL: 'Structural Damage', UNKNOWN: 'Unknown Incident',
}
const TYPE_ICON: Record<string, IoniconName> = {
  VICTIM_DETECTED: 'body', FLOOD: 'water', FIRE: 'flame', STRUCTURAL: 'business', UNKNOWN: 'help-circle',
}
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: colors.alert, HIGH: colors.orange, MEDIUM: colors.amber, LOW: colors.textMuted,
}

const TERMINAL = ['COMPLETED', 'DECLINED']

async function requestNotifPermission() {
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

// Reports this device's position every LOCATION_REPORT_MS so verified
// incidents can be auto-dispatched to the nearest responder.
async function reportLocation(token: string | null) {
  if (!token) return
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    await fetch(`${SERVER_BASE}/me/location`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude }),
      signal:  AbortSignal.timeout(5000),
    })
  } catch {}
}

export default function MissionsScreen() {
  const { user, token } = useAuth()
  const navigation = useNavigation<any>()
  const [missions, setMissions]   = useState<Mission[]>([])
  const [incidents, setIncidents] = useState<Record<string, Incident>>({})
  const [loading, setLoading]     = useState(true)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => { requestNotifPermission() }, [])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const missionId = response.notification.request.content.data?.missionId
      if (missionId) navigation.navigate('MissionDetail', { missionId })
    })
    return () => sub.remove()
  }, [navigation])

  useEffect(() => {
    if (!user || user.role !== 'field_responder' || !token) return
    reportLocation(token)
    const t = setInterval(() => reportLocation(token), LOCATION_REPORT_MS)
    return () => clearInterval(t)
  }, [user, token])

  useEffect(() => {
    if (!user) return
    async function poll() {
      try {
        const [missionsRes, incidentsRes] = await Promise.all([
          fetch(`${SERVER_BASE}/missions?userId=${user!.uid}`, { signal: AbortSignal.timeout(4000) }),
          fetch(`${SERVER_BASE}/incidents`, { signal: AbortSignal.timeout(4000) }),
        ])
        if (missionsRes.ok) {
          const data: Mission[] = await missionsRes.json()
          const newOnes = data.filter(m => !seenIds.current.has(m.id) && m.status === 'ASSIGNED')
          newOnes.forEach(m => seenIds.current.add(m.id))
          data.forEach(m => seenIds.current.add(m.id))
          if (newOnes.length > 0) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🚨 New Mission Assigned',
                body:  `${newOnes.length} new mission${newOnes.length > 1 ? 's' : ''} dispatched to you`,
                data:  newOnes.length === 1 ? { missionId: newOnes[0].id } : undefined,
              },
              trigger: null,
            })
          }
          setMissions(data)
        }
        if (incidentsRes.ok) {
          const list: Incident[] = await incidentsRes.json()
          const byId: Record<string, Incident> = {}
          list.forEach(i => { byId[i.id] = i })
          setIncidents(byId)
        }
      } catch {} finally { setLoading(false) }
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => clearInterval(t)
  }, [user])

  const active    = missions.filter(m => !TERMINAL.includes(m.status))
  const completed = missions.filter(m => TERMINAL.includes(m.status))
  const sections  = [...active, ...completed]

  function renderCard(m: Mission) {
    const incident = incidents[m.incidentId]
    const statusColor = STATUS_COLOR[m.status] ?? colors.textMuted
    const isNew = m.status === 'ASSIGNED'
    const icon = incident ? (TYPE_ICON[incident.type] ?? 'help-circle') : 'help-circle'
    const sev = incident ? SEVERITY_COLOR[incident.severity] ?? colors.textMuted : colors.textMuted
    const done = TERMINAL.includes(m.status)

    return (
      <TouchableOpacity
        style={[s.card, isNew && s.cardNew, done && s.cardDone]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('MissionDetail', { missionId: m.id })}>
        {isNew && (
          <View style={s.newRibbon}>
            <View style={s.newDot} />
            <Text style={s.newRibbonText}>NEW DISPATCH · TAP TO RESPOND</Text>
          </View>
        )}
        <View style={s.cardBody}>
          <View style={[s.typeTile, { backgroundColor: sev + '18' }]}>
            <Ionicons name={icon} size={20} color={sev} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.cardTop}>
              <Text style={s.cardType} numberOfLines={1}>
                {incident ? (TYPE_LABEL[incident.type] ?? incident.type) : 'Loading…'}
              </Text>
              <View style={[s.statusPill, { backgroundColor: statusColor + '18' }]}>
                <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABEL[m.status] ?? m.status}</Text>
              </View>
            </View>
            {incident?.description ? <Text style={s.cardDesc} numberOfLines={1}>{incident.description}</Text> : null}
            <View style={s.cardMeta}>
              {incident && <Text style={[s.sevText, { color: sev }]}>{incident.severity}</Text>}
              <Text style={s.cardTime}>{new Date(m.createdAt).toLocaleTimeString('en-PH', { hour12: false })}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.root}>
      {/* Duty strip */}
      <View style={s.duty}>
        <View style={s.dutyLeft}>
          <View style={s.dutyDot} />
          <Text style={s.dutyText}>On duty · sharing location</Text>
        </View>
        <Text style={s.dutyCount}>{active.length} active</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.navy} /></View>
      ) : sections.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyTile}>
            <Ionicons name="navigate-outline" size={30} color={colors.navy} />
          </View>
          <Text style={s.emptyText}>No missions right now</Text>
          <Text style={s.emptyHint}>Stay on duty — you'll be notified the instant an incident is dispatched to you.</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }}
          renderItem={({ item }) => renderCard(item)}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  duty:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.panel,
              borderBottomWidth: 1, borderBottomColor: colors.border },
  dutyLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dutyDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
  dutyText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  dutyCount:{ fontSize: 12, fontWeight: '700', color: colors.navy },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: 40 },
  emptyTile: { width: 68, height: 68, borderRadius: 20, backgroundColor: colors.navyTint,
               alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptyHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

  card:     { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
              overflow: 'hidden' },
  cardNew:  { borderColor: colors.alert + '55',
              shadowColor: colors.alert, shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  cardDone: { opacity: 0.6 },

  newRibbon:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.alert,
                   paddingHorizontal: spacing.md, paddingVertical: 5 },
  newDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  newRibbonText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },

  cardBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  typeTile: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardType: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  statusPill:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  statusText:{ fontSize: 10, fontWeight: '700' },
  cardDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  sevText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardTime: { fontFamily: font.mono, fontSize: 11, color: colors.textMuted },
})
