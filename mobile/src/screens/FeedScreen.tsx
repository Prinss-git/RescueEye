import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { API_BASE, STREAM_URL } from '../config'

const CLASSIFY_INTERVAL_MS = 3000

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ff3b3b',
  MODERATE: '#f59e0b',
  MINOR:    '#ffdc00',
}
const DAMAGE_LABEL: Record<string, string> = {
  flood_damage:      'FLOOD DAMAGE',
  fire_damage:       'FIRE DAMAGE',
  structural_damage: 'STRUCTURAL DMG',
}
const DAMAGE_COLOR: Record<string, string> = {
  flood_damage:      '#00d4ff',
  fire_damage:       '#ff7700',
  structural_damage: '#f97316',
}

interface DamageResult {
  label: string
  confidence: number
  severity?: string
  suggested_action?: string
}

interface StreamStatus {
  active: boolean
  source: string
  active_source: string
}

export default function FeedScreen() {
  const [streamOk,    setStreamOk]    = useState(false)
  const [status,      setStatus]      = useState<StreamStatus | null>(null)
  const [damage,      setDamage]      = useState<DamageResult | null>(null)
  const [detecting,   setDetecting]   = useState(false)
  const [casualties,  setCasualties]  = useState(0)
  const detectingRef = useRef(false)

  // Stream status poll
  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/stream/status`, { signal: AbortSignal.timeout(3000) })
        if (r.ok) setStatus(await r.json())
      } catch {}
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])

  // Damage classification — runs every 3s via snapshot endpoint
  useEffect(() => {
    detectingRef.current = detecting
    if (!detecting) { setDamage(null); return }

    async function classify() {
      if (!detectingRef.current) return
      try {
        // Fetch a JPEG snapshot and base64-encode it
        const snap = await fetch(`${API_BASE}/stream/snapshot`, { signal: AbortSignal.timeout(4000) })
        if (!snap.ok) return
        const blob   = await snap.blob()
        const reader = new FileReader()
        reader.onloadend = async () => {
          const b64 = reader.result as string
          const res = await fetch(`${API_BASE}/classify`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ frame: b64 }),
          })
          if (!res.ok) return
          const data = await res.json()
          if (data.label && data.label !== 'no_damage' && data.confidence > 0.40) {
            setDamage({ label: data.label, confidence: data.confidence,
              severity: data.severity, suggested_action: data.suggested_action })
          } else {
            setDamage(null)
          }
        }
        reader.readAsDataURL(blob)
      } catch {}
    }

    const t = setInterval(classify, CLASSIFY_INTERVAL_MS)
    classify()
    return () => clearInterval(t)
  }, [detecting])

  // Casualty count poll
  useEffect(() => {
    if (!detecting) return
    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/detections/recent`, { signal: AbortSignal.timeout(3000) })
        if (r.ok) { const d = await r.json(); setCasualties(Array.isArray(d) ? d.length : 0) }
      } catch {}
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => clearInterval(t)
  }, [detecting])

  const dmgColor = damage ? (DAMAGE_COLOR[damage.label] ?? '#fff') : '#00d4ff'
  const sevColor = damage?.severity ? (SEVERITY_COLOR[damage.severity] ?? '#fff') : '#fff'

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.appTitle}>RESCUEEYE</Text>
          <Text style={s.appSub}>PORTABLE SAR · AERIAL FEED</Text>
        </View>
        <View style={[s.pill, { borderColor: status?.active ? '#22c55e44' : '#ff3b3b44' }]}>
          <View style={[s.dot, { backgroundColor: status?.active ? '#22c55e' : '#ff3b3b' }]} />
          <Text style={[s.pillText, { color: status?.active ? '#22c55e' : '#ff3b3b' }]}>
            {status?.active ? 'ACTIVE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Live feed */}
      <View style={s.feedBox}>
        {!streamOk && (
          <View style={s.feedPlaceholder}>
            <ActivityIndicator color="#00d4ff" />
            <Text style={s.feedWait}>Connecting to drone feed…</Text>
            <Text style={s.feedHint}>Make sure phone and PC are on the same WiFi</Text>
          </View>
        )}
        <WebView
          source={{ uri: STREAM_URL }}
          style={[s.webview, !streamOk && { opacity: 0, height: 0 }]}
          onLoad={() => setStreamOk(true)}
          onError={() => setStreamOk(false)}
          scrollEnabled={false}
          bounces={false}
          mediaPlaybackRequiresUserAction={false}
        />

        {/* Damage badge */}
        {damage && detecting && (
          <View style={[s.damageBadge, { borderColor: dmgColor + '55' }]}>
            <View style={[s.damageDot, { backgroundColor: dmgColor }]} />
            <View style={{ flex: 1 }}>
              <View style={s.damageRow}>
                <Text style={[s.damageLabel, { color: dmgColor }]}>
                  {DAMAGE_LABEL[damage.label] ?? damage.label.toUpperCase()}
                </Text>
                {damage.severity && damage.severity !== 'CLEAR' && (
                  <View style={[s.severityBadge, { borderColor: sevColor + '44', backgroundColor: sevColor + '18' }]}>
                    <Text style={[s.severityText, { color: sevColor }]}>{damage.severity}</Text>
                  </View>
                )}
                <Text style={s.damageConf}>{Math.round(damage.confidence * 100)}%</Text>
              </View>
              {damage.suggested_action && (
                <Text style={s.damageAction}>{damage.suggested_action}</Text>
              )}
            </View>
          </View>
        )}

        {/* Night mode badge */}
        {detecting && (
          <View style={s.nightBadge}>
            <View style={[s.dot, { backgroundColor: detecting ? '#22c55e' : '#666' }]} />
            <Text style={[s.nightText, { color: detecting ? '#22c55e' : '#666' }]}>
              {detecting ? 'SCANNING' : 'STANDBY'}
            </Text>
          </View>
        )}
      </View>

      {/* Scan button */}
      <TouchableOpacity
        style={[s.scanBtn, detecting && s.scanBtnStop]}
        onPress={() => { setDetecting(d => !d); if (detecting) { setDamage(null); setCasualties(0) } }}>
        <Text style={[s.scanBtnText, detecting && { color: '#ff3b3b' }]}>
          {detecting ? '■  STOP SCAN' : '▶  BEGIN SCAN'}
        </Text>
      </TouchableOpacity>

      {/* Stats row */}
      <View style={s.statsRow}>
        <StatBox label="CASUALTIES" value={String(casualties)} accent={casualties > 0 ? '#ff3b3b' : undefined} />
        <StatBox label="FEED" value={status?.source?.toUpperCase() ?? '—'} />
        <StatBox label="DAMAGE" value={damage ? (DAMAGE_LABEL[damage.label] ?? '—') : '—'} accent={damage ? dmgColor : undefined} />
      </View>

      {/* Source info */}
      {status?.active_source ? (
        <View style={s.sourceBox}>
          <Text style={s.sourceLabel}>ACTIVE SOURCE</Text>
          <Text style={s.sourceValue} numberOfLines={1}>{status.active_source}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, accent ? { color: accent } : {}]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#07090e' },
  content:         { padding: 16, gap: 12 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  appTitle:        { fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold', color: '#00d4ff', letterSpacing: 3 },
  appSub:          { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginTop: 2 },
  pill:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4,
                     borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pillText:        { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  dot:             { width: 6, height: 6, borderRadius: 3 },
  feedBox:         { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)',
                     backgroundColor: '#000', minHeight: 240, position: 'relative' },
  feedPlaceholder: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
                     gap: 8, padding: 24, zIndex: 1 } as any,
  feedWait:        { fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  feedHint:        { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center' },
  webview:         { width: '100%', height: 240, backgroundColor: '#000' },
  damageBadge:     { position: 'absolute', bottom: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'flex-start',
                     gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
                     backgroundColor: 'rgba(7,9,14,0.92)' },
  damageDot:       { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  damageRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  damageLabel:     { fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  damageConf:      { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' },
  damageAction:    { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 3 },
  severityBadge:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  severityText:    { fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold' },
  nightBadge:      { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 5,
                     paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                     backgroundColor: 'rgba(7,9,14,0.7)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  nightText:       { fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  scanBtn:         { paddingVertical: 14, borderRadius: 8, alignItems: 'center',
                     backgroundColor: 'rgba(0,212,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.5)' },
  scanBtnStop:     { backgroundColor: 'rgba(255,59,59,0.08)', borderColor: 'rgba(255,59,59,0.5)' },
  scanBtnText:     { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', color: '#00d4ff', letterSpacing: 2 },
  statsRow:        { flexDirection: 'row', gap: 8 },
  statBox:         { flex: 1, backgroundColor: '#0d1220', borderRadius: 8, padding: 10, alignItems: 'center',
                     borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statLabel:       { fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 4 },
  statValue:       { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.7)' },
  sourceBox:       { backgroundColor: '#0d1220', borderRadius: 8, padding: 10,
                     borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sourceLabel:     { fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 4 },
  sourceValue:     { fontFamily: 'monospace', fontSize: 10, color: 'rgba(0,212,255,0.7)' },
})
