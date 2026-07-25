import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRecentDetections } from '../api/queries'
import { colors, font, radius, spacing } from '../theme'

const CLASS_COLOR: Record<string, string> = {
  person:            colors.alert,
  life_sign:         colors.yellow,
  fire_damage:       colors.orange,
  flood_damage:      colors.cyan,
  structural_damage: colors.orangeAlt,
}
const CLASS_LABEL: Record<string, string> = {
  person:            'CASUALTY',
  life_sign:         'CASUALTY · THERMAL',
  fire_damage:       'FIRE DAMAGE',
  flood_damage:      'FLOOD DAMAGE',
  structural_damage: 'STRUCTURAL DMG',
}

export default function LogScreen() {
  const [polling, setPolling] = useState(true)
  // The feed is server-owned, so "clear" hides what's on screen now rather
  // than deleting anything; later detections still come through.
  const [clearedAt, setClearedAt] = useState<number | null>(null)

  // This is an ambient awareness feed of raw AI detections, not dispatch.
  // It deliberately no longer raises a local notification per detection:
  // unverified detections anywhere in the AOI aren't this responder's
  // business, and the noise would bury the dispatch pushes that are.
  const { data, isLoading, error } = useRecentDetections(polling)

  const detections = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    if (clearedAt === null) return list
    return list.filter(d => new Date(d.timestamp).getTime() > clearedAt)
  }, [data, clearedAt])

  const lastCount = detections.length

  const sorted = useMemo(
    () => [...detections].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [detections],
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
            <View style={[s.dot, { backgroundColor: polling ? colors.green : '#666' }]} />
            <Text style={[s.pollText, { color: polling ? colors.green : '#666' }]}>
              {polling ? 'LIVE' : 'PAUSED'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.clearBtn} onPress={() => setClearedAt(Date.now())}>
            <Text style={s.clearText}>CLEAR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && detections.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>⚠</Text>
          <Text style={s.emptyText}>DETECTION FEED UNREACHABLE</Text>
          <Text style={s.emptyHint}>{(error as Error).message}</Text>
        </View>
      ) : isLoading ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>◎</Text>
          <Text style={s.emptyText}>CONNECTING TO FEED</Text>
        </View>
      ) : detections.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>◎</Text>
          <Text style={s.emptyText}>SCANNING FOR CASUALTIES</Text>
          <Text style={s.emptyHint}>Verified detections are dispatched to you as missions</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={d => d.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item: d }) => {
            const accent = CLASS_COLOR[d.class] ?? colors.textFaint
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
  root:        { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                 borderBottomWidth: 1, borderBottomColor: colors.border,
                 backgroundColor: colors.panel },
  title:       { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  sub:         { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pollBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5,
                 borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
                 backgroundColor: colors.panelLight },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  pollText:    { fontFamily: font.mono, fontSize: 9, fontWeight: 'bold' },
  clearBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm,
                 borderWidth: 1, borderColor: colors.border },
  clearText:   { fontFamily: font.mono, fontSize: 9, color: colors.textSecondary },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyIcon:   { fontSize: 32, color: colors.textFaint },
  emptyText:   { fontFamily: font.mono, fontSize: 11, color: colors.textFaint, letterSpacing: 2 },
  emptyHint:   { fontFamily: font.mono, fontSize: 9, color: colors.textFaint, textAlign: 'center', paddingHorizontal: 32 },
  card:        { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
                 borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:    { gap: 2 },
  cardClass:   { fontFamily: font.mono, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  cardConf:    { fontFamily: font.mono, fontSize: 9, color: colors.textSecondary },
  cardTime:    { fontFamily: font.mono, fontSize: 9, color: colors.textMuted },
  barBg:       { height: 2, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  barFill:     { height: 2, borderRadius: 2 },
  cardCoords:  { fontFamily: font.mono, fontSize: 9, color: colors.navy },
})
