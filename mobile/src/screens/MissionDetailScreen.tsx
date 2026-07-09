import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { SERVER_BASE } from '../config'
import { colors, font, radius, spacing } from '../theme'

interface Mission {
  id: string
  incidentId: string
  teamId: string
  status: string
  medicalRequired: boolean | null
  notes: string
  createdAt: string
  acceptedAt: string | null
  completedAt: string | null
}

interface Incident {
  id: string
  type: string
  severity: string
  description: string
  lat: number
  lng: number
}

const TYPE_LABEL: Record<string, string> = {
  VICTIM_DETECTED: 'Victim Detected',
  FLOOD:           'Flood Damage',
  FIRE:            'Fire Damage',
  STRUCTURAL:      'Structural Damage',
  UNKNOWN:         'Unknown',
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: colors.alert,
  HIGH:     colors.orange,
  MEDIUM:   colors.amber,
  LOW:      colors.textMuted,
}

export default function MissionDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { missionId } = route.params

  const [mission, setMission]   = useState<Mission | null>(null)
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)

  const load = useCallback(async () => {
    try {
      const missionRes = await fetch(`${SERVER_BASE}/missions/${missionId}`)
      if (!missionRes.ok) return
      const missionData: Mission = await missionRes.json()
      setMission(missionData)

      const incidentRes = await fetch(`${SERVER_BASE}/incidents/${missionData.incidentId}`)
      if (incidentRes.ok) setIncident(await incidentRes.json())
    } finally {
      setLoading(false)
    }
  }, [missionId])

  useEffect(() => { load() }, [load])

  async function updateStatus(status: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      await fetch(`${SERVER_BASE}/missions/${missionId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status, ...extra }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function accept() {
    setBusy(true)
    try {
      await fetch(`${SERVER_BASE}/missions/${missionId}/accept`, { method: 'PATCH' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function decline() {
    setBusy(true)
    try {
      await fetch(`${SERVER_BASE}/missions/${missionId}/decline`, { method: 'PATCH' })
      await load()
      navigation.goBack()
    } finally {
      setBusy(false)
    }
  }

  function openMaps() {
    if (!incident) return
    const url = `https://www.google.com/maps/dir/?api=1&destination=${incident.lat},${incident.lng}`
    Linking.openURL(url)
  }

  if (loading || !mission) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    )
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.incidentType}>{incident ? (TYPE_LABEL[incident.type] ?? incident.type) : '—'}</Text>
        {incident && (
          <View style={[s.severityBadge, { borderColor: (SEVERITY_COLOR[incident.severity] ?? colors.textMuted) + '55' }]}>
            <Text style={{ color: SEVERITY_COLOR[incident.severity] ?? colors.textMuted, fontFamily: font.mono, fontSize: 10, fontWeight: 'bold' }}>
              {incident.severity}
            </Text>
          </View>
        )}
        {incident?.description ? <Text style={s.desc}>{incident.description}</Text> : null}
        {incident && (
          <Text style={s.coords}>{incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</Text>
        )}

        <TouchableOpacity style={s.mapBtn} onPress={openMaps} disabled={!incident}>
          <Text style={s.mapBtnText}>📍 OPEN IN MAPS</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.statusLabel}>MISSION STATUS</Text>
        <Text style={s.statusValue}>{mission.status}</Text>

        {mission.status === 'ASSIGNED' && (
          <View style={s.row}>
            <TouchableOpacity style={[s.actionBtn, s.acceptBtn]} onPress={accept} disabled={busy}>
              <Text style={s.acceptBtnText}>ACCEPT MISSION</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.declineBtn]} onPress={decline} disabled={busy}>
              <Text style={s.declineBtnText}>DECLINE</Text>
            </TouchableOpacity>
          </View>
        )}

        {mission.status === 'ACCEPTED' && (
          <TouchableOpacity style={s.primaryBtn} onPress={() => { updateStatus('EN_ROUTE'); openMaps() }} disabled={busy}>
            <Text style={s.primaryBtnText}>START NAVIGATION</Text>
          </TouchableOpacity>
        )}

        {mission.status === 'EN_ROUTE' && (
          <TouchableOpacity style={s.primaryBtn} onPress={() => updateStatus('ON_SITE')} disabled={busy}>
            <Text style={s.primaryBtnText}>ARRIVED ON-SITE</Text>
          </TouchableOpacity>
        )}

        {mission.status === 'ON_SITE' && (
          <TouchableOpacity style={s.primaryBtn} onPress={() => updateStatus('COMPLETED')} disabled={busy}>
            <Text style={s.primaryBtnText}>REPORT RESCUE COMPLETE</Text>
          </TouchableOpacity>
        )}

        {mission.status === 'TREATING' && (
          <TouchableOpacity style={s.primaryBtn} onPress={() => updateStatus('COMPLETED')} disabled={busy}>
            <Text style={s.primaryBtnText}>REPORT MISSION COMPLETION</Text>
          </TouchableOpacity>
        )}

        {(mission.status === 'COMPLETED' || mission.status === 'DECLINED') && (
          <Text style={s.doneText}>
            {mission.status === 'COMPLETED' ? '✓ Mission completed' : '✗ Mission declined'}
          </Text>
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
          padding: spacing.lg, gap: spacing.sm },

  incidentType:  { fontFamily: font.mono, fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  severityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  desc:          { fontFamily: font.mono, fontSize: 12, color: colors.textSecondary },
  coords:        { fontFamily: font.mono, fontSize: 11, color: colors.cyan },

  mapBtn:      { marginTop: spacing.sm, backgroundColor: colors.panelLight, borderRadius: radius.md,
                 borderWidth: 1, borderColor: colors.borderCyan, paddingVertical: 10, alignItems: 'center' },
  mapBtnText:  { fontFamily: font.mono, fontSize: 12, fontWeight: 'bold', color: colors.cyan, letterSpacing: 1 },

  statusLabel: { fontFamily: font.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  statusValue: { fontFamily: font.mono, fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.xs },

  row:         { flexDirection: 'row', gap: spacing.sm },
  actionBtn:   { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  acceptBtn:   { backgroundColor: colors.cyan, borderColor: colors.cyan },
  acceptBtnText: { fontFamily: font.mono, fontSize: 11, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  declineBtn:  { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  declineBtnText: { fontFamily: font.mono, fontSize: 11, fontWeight: 'bold', color: colors.alert, textAlign: 'center' },

  primaryBtn:     { backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { fontFamily: font.mono, fontSize: 12, fontWeight: 'bold', color: '#ffffff', letterSpacing: 1 },

  doneText: { fontFamily: font.mono, fontSize: 13, fontWeight: 'bold', color: colors.green, textAlign: 'center', paddingVertical: spacing.sm },
})
