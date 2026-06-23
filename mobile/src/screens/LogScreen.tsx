import { useEffect, useRef, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { API_BASE } from '../config'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound:   true,
    shouldSetBadge:    true,
    shouldShowBanner:  true,
    shouldShowList:    true,
  }),
})

interface Detection {
  id:         string
  class:      string
  confidence: number
  lat?:       number
  lng?:       number
  timestamp:  string
}

const CLASS_COLOR: Record<string, string> = {
  person:            '#ff3b3b',
  life_sign:         '#ffdc00',
  fire_damage:       '#ff7700',
  flood_damage:      '#00d4ff',
  structural_damage: '#f97316',
}
const CLASS_LABEL: Record<string, string> = {
  person:            'CASUALTY',
  life_sign:         'CASUALTY · THERMAL',
  fire_damage:       'FIRE DAMAGE',
  flood_damage:      'FLOOD DAMAGE',
  structural_damage: 'STRUCTURAL DMG',
}

async function requestNotifPermission() {
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export default function LogScreen() {
  const [detections,  setDetections]  = useState<Detection[]>([])
  const [polling,     setPolling]     = useState(true)
  const [lastCount,   setLastCount]   = useState(0)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => { requestNotifPermission() }, [])

  useEffect(() => {
    if (!polling) return

    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/detections/recent`, { signal: AbortSignal.timeout(4000) })
        if (!r.ok) return
        const data: Detection[] = await r.json()
        if (!Array.isArray(data)) return

        // Find new detections not seen before
        const newOnes = data.filter(d => !seenIds.current.has(d.id) && d.class === 'person')
        newOnes.forEach(d => seenIds.current.add(d.id))

        if (newOnes.length > 0) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⚠️ Casualty Detected`,
              body:  `${newOnes.length} person${newOnes.length > 1 ? 's' : ''} detected — ${Math.round(newOnes[0].confidence * 100)}% confidence`,
              data:  { detections: newOnes },
            },
            trigger: null,
          })
        }

        setDetections(data)
        setLastCount(data.length)
      } catch {}
    }

    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [polling])

  const sorted = [...detections].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>DETECTION LOG</Text>
          <Text style={s.sub}>{lastCount} TOTAL DETECTIONS</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.pollBtn} onPress={() => setPolling(p => !p)}>
            <View style={[s.dot, { backgroundColor: polling ? '#22c55e' : '#666' }]} />
            <Text style={[s.pollText, { color: polling ? '#22c55e' : '#666' }]}>
              {polling ? 'LIVE' : 'PAUSED'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.clearBtn} onPress={() => { setDetections([]); seenIds.current.clear(); setLastCount(0) }}>
            <Text style={s.clearText}>CLEAR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {detections.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>◎</Text>
          <Text style={s.emptyText}>SCANNING FOR CASUALTIES</Text>
          <Text style={s.emptyHint}>Notifications will fire when a person is detected</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={d => d.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item: d }) => {
            const accent = CLASS_COLOR[d.class] ?? '#ffffff44'
            const label  = CLASS_LABEL[d.class] ?? d.class.toUpperCase()
            const conf   = Math.round(d.confidence * 100)
            const ts     = new Date(d.timestamp).toLocaleTimeString('en-PH', { hour12: false })
            return (
              <View style={[s.card, { borderLeftColor: accent }]}>
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    <Text style={[s.cardClass, { color: accent }]}>{label}</Text>
                    <Text style={s.cardConf}>{conf}% confidence</Text>
                  </View>
                  <Text style={s.cardTime}>{ts}</Text>
                </View>
                {/* Confidence bar */}
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${conf}%` as any, backgroundColor: accent }]} />
                </View>
                {d.lat != null && d.lng != null && (
                  <Text style={s.cardCoords}>{d.lat.toFixed(4)}, {d.lng.toFixed(4)}</Text>
                )}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#07090e' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 paddingHorizontal: 16, paddingVertical: 12,
                 borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
                 backgroundColor: '#0d1220' },
  title:       { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.7)', letterSpacing: 2 },
  sub:         { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pollBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5,
                 borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                 backgroundColor: 'rgba(0,0,0,0.3)' },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  pollText:    { fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold' },
  clearBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                 borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  clearText:   { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.4)' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:   { fontSize: 32, color: 'rgba(255,255,255,0.1)' },
  emptyText:   { fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 2 },
  emptyHint:   { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.15)', textAlign: 'center', paddingHorizontal: 32 },
  card:        { backgroundColor: '#0d1220', borderRadius: 8, padding: 12, gap: 8,
                 borderLeftWidth: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:    { gap: 2 },
  cardClass:   { fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  cardConf:    { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)' },
  cardTime:    { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)' },
  barBg:       { height: 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  barFill:     { height: 2, borderRadius: 2 },
  cardCoords:  { fontFamily: 'monospace', fontSize: 9, color: 'rgba(0,212,255,0.4)' },
})
