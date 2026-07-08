import { useEffect, useRef, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useNavigation } from '@react-navigation/native'
import { SERVER_BASE } from '../config'
import { useAuth } from '../context/AuthContext'
import { colors, font, radius, spacing } from '../theme'

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

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED:  'New Dispatch',
  ACCEPTED:  'Accepted',
  DECLINED:  'Declined',
  EN_ROUTE:  'En Route',
  ON_SITE:   'On Site',
  TREATING:  'Treating Patient',
  COMPLETED: 'Completed',
}

const STATUS_COLOR: Record<string, string> = {
  ASSIGNED:  colors.alert,
  ACCEPTED:  colors.cyan,
  DECLINED:  colors.textMuted,
  EN_ROUTE:  colors.amber,
  ON_SITE:   colors.amber,
  TREATING:  colors.orange,
  COMPLETED: colors.green,
}

const TYPE_LABEL: Record<string, string> = {
  VICTIM_DETECTED: 'Victim Detected',
  FLOOD:           'Flood Damage',
  FIRE:            'Fire Damage',
  STRUCTURAL:      'Structural Damage',
  UNKNOWN:         'Unknown',
}

const TERMINAL = ['COMPLETED', 'DECLINED']

async function requestNotifPermission() {
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export default function MissionsScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<any>()
  const [missions, setMissions]   = useState<Mission[]>([])
  const [incidents, setIncidents] = useState<Record<string, Incident>>({})
  const [loading, setLoading]     = useState(true)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => { requestNotifPermission() }, [])

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
                body:  `${newOnes.length} new mission${newOnes.length > 1 ? 's' : ''} dispatched to your team`,
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
      } catch {} finally {
        setLoading(false)
      }
    }

    poll()
    const t = setInterval(poll, 4000)
    return () => clearInterval(t)
  }, [user])

  const active    = missions.filter(m => !TERMINAL.includes(m.status))
  const completed = missions.filter(m => TERMINAL.includes(m.status))
  const sections  = [...active, ...completed]

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>MISSIONS</Text>
        <Text style={s.sub}>{active.length} ACTIVE · {completed.length} COMPLETED</Text>
      </View>

      {loading ? null : sections.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>◎</Text>
          <Text style={s.emptyText}>NO MISSIONS ASSIGNED</Text>
          <Text style={s.emptyHint}>You'll be notified the moment a mission is dispatched to your team</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item: m }) => {
            const incident = incidents[m.incidentId]
            const color = STATUS_COLOR[m.status] ?? colors.textMuted
            return (
              <TouchableOpacity
                style={[s.card, { borderLeftColor: color }]}
                onPress={() => navigation.navigate('MissionDetail', { missionId: m.id })}>
                <View style={s.cardTop}>
                  <Text style={s.cardType}>
                    {incident ? (TYPE_LABEL[incident.type] ?? incident.type) : 'Loading…'}
                  </Text>
                  <Text style={[s.statusBadge, { color }]}>{STATUS_LABEL[m.status] ?? m.status}</Text>
                </View>
                {incident && (
                  <Text style={s.cardDesc} numberOfLines={1}>{incident.description || 'No description'}</Text>
                )}
                <Text style={s.cardTime}>
                  {new Date(m.createdAt).toLocaleTimeString('en-PH', { hour12: false })}
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  header:      { paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                 borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.panel },
  title:       { fontFamily: font.mono, fontSize: 13, fontWeight: 'bold', color: colors.textSecondary, letterSpacing: 2 },
  sub:         { fontFamily: font.mono, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: 32 },
  emptyIcon:   { fontSize: 32, color: colors.textFaint },
  emptyText:   { fontFamily: font.mono, fontSize: 11, color: colors.textFaint, letterSpacing: 2 },
  emptyHint:   { fontFamily: font.mono, fontSize: 9, color: colors.textFaint, textAlign: 'center' },
  card:        { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, gap: 4,
                 borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardType:    { fontFamily: font.mono, fontSize: 12, fontWeight: 'bold', color: colors.textPrimary },
  statusBadge: { fontFamily: font.mono, fontSize: 9, fontWeight: 'bold' },
  cardDesc:    { fontFamily: font.mono, fontSize: 10, color: colors.textSecondary },
  cardTime:    { fontFamily: font.mono, fontSize: 9, color: colors.textMuted },
})
