import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
  droneCallsign?: string | null
}

type IoniconName = keyof typeof Ionicons.glyphMap

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

const STEPS: { key: string; label: string }[] = [
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'EN_ROUTE',   label: 'En Route' },
  { key: 'ON_SITE',    label: 'On Site' },
  { key: 'COMPLETED',  label: 'Complete' },
]
function stepIndex(status: string) {
  if (status === 'EN_ROUTE') return 1
  if (status === 'ON_SITE' || status === 'TREATING') return 2
  if (status === 'COMPLETED') return 3
  return 0 // ASSIGNED / ACCEPTED
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
    } finally { setLoading(false) }
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
    } finally { setBusy(false) }
  }

  async function decline() {
    setBusy(true)
    try {
      await fetch(`${SERVER_BASE}/missions/${missionId}/decline`, { method: 'PATCH' })
      await load()
      navigation.goBack()
    } finally { setBusy(false) }
  }

  function openMaps() {
    if (!incident) return
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${incident.lat},${incident.lng}`)
  }

  // One-press dispatch response: accept, mark en route, and launch navigation.
  async function routeToVictim() {
    if (!incident) return
    setBusy(true)
    try {
      if (mission?.status === 'ASSIGNED') {
        await fetch(`${SERVER_BASE}/missions/${missionId}/accept`, { method: 'PATCH' })
      }
      await fetch(`${SERVER_BASE}/missions/${missionId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'EN_ROUTE' }),
      })
      await load()
      openMaps()
    } finally { setBusy(false) }
  }

  if (loading || !mission) {
    return <View style={s.centered}><ActivityIndicator color={colors.navy} /></View>
  }

  const sev  = incident ? SEVERITY_COLOR[incident.severity] ?? colors.textMuted : colors.textMuted
  const icon = incident ? (TYPE_ICON[incident.type] ?? 'help-circle') : 'help-circle'
  const curStep = stepIndex(mission.status)
  const declined = mission.status === 'DECLINED'

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Incident hero */}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View style={[s.typeTile, { backgroundColor: sev + '18' }]}>
            <Ionicons name={icon} size={26} color={sev} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroType}>{incident ? (TYPE_LABEL[incident.type] ?? incident.type) : '—'}</Text>
            {incident && (
              <View style={[s.sevBadge, { backgroundColor: sev + '18' }]}>
                <Text style={[s.sevText, { color: sev }]}>{incident.severity}</Text>
              </View>
            )}
          </View>
        </View>

        {incident?.description ? <Text style={s.heroDesc}>{incident.description}</Text> : null}

        {incident && (
          <View style={s.locRow}>
            <Ionicons name="location" size={15} color={colors.navy} />
            <Text style={s.coords}>{incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}</Text>
            {incident.droneCallsign ? <Text style={s.drone}>· spotted by {incident.droneCallsign}</Text> : null}
          </View>
        )}

        <TouchableOpacity style={s.mapBtn} onPress={openMaps} disabled={!incident} activeOpacity={0.8}>
          <Ionicons name="map-outline" size={16} color={colors.navy} />
          <Text style={s.mapBtnText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>

      {/* Status timeline */}
      {!declined && (
        <View style={s.stepper}>
          {STEPS.map((step, i) => {
            const doneStep = i < curStep
            const activeStep = i === curStep
            const on = doneStep || activeStep
            return (
              <View key={step.key} style={s.step}>
                <View style={s.stepRow}>
                  {i > 0 && <View style={[s.stepLine, doneStep || activeStep ? { backgroundColor: colors.navy } : null]} />}
                  <View style={[s.stepDot, on ? s.stepDotOn : null, activeStep ? s.stepDotActive : null]}>
                    {doneStep
                      ? <Ionicons name="checkmark" size={12} color="#fff" />
                      : <Text style={[s.stepNum, on ? { color: '#fff' } : null]}>{i + 1}</Text>}
                  </View>
                  {i < STEPS.length - 1 && <View style={[s.stepLine, doneStep ? { backgroundColor: colors.navy } : null]} />}
                </View>
                <Text style={[s.stepLabel, on ? s.stepLabelOn : null]}>{step.label}</Text>
              </View>
            )
          })}
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        {(mission.status === 'ASSIGNED' || mission.status === 'ACCEPTED') && (
          <>
            <TouchableOpacity style={s.routeBtn} onPress={routeToVictim} disabled={busy || !incident} activeOpacity={0.85}>
              <Ionicons name="navigate" size={20} color="#fff" />
              <View>
                <Text style={s.routeBtnText}>Route to Victim</Text>
                <Text style={s.routeBtnSub}>Accept & start navigation</Text>
              </View>
            </TouchableOpacity>
            {mission.status === 'ASSIGNED' && (
              <TouchableOpacity style={s.declineBtn} onPress={decline} disabled={busy} activeOpacity={0.8}>
                <Text style={s.declineText}>Decline</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {mission.status === 'EN_ROUTE' && (
          <>
            <TouchableOpacity style={s.primaryBtn} onPress={() => updateStatus('ON_SITE')} disabled={busy} activeOpacity={0.85}>
              <Ionicons name="flag" size={18} color="#fff" />
              <Text style={s.primaryText}>Arrived On-Site</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.mapBtn} onPress={openMaps} disabled={!incident} activeOpacity={0.8}>
              <Ionicons name="navigate-outline" size={16} color={colors.navy} />
              <Text style={s.mapBtnText}>Re-open Navigation</Text>
            </TouchableOpacity>
          </>
        )}

        {mission.status === 'ON_SITE' && (
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.emerald }]} onPress={() => updateStatus('COMPLETED')} disabled={busy} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={s.primaryText}>Report Rescue Complete</Text>
          </TouchableOpacity>
        )}

        {mission.status === 'TREATING' && (
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.emerald }]} onPress={() => updateStatus('COMPLETED')} disabled={busy} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={s.primaryText}>Report Mission Complete</Text>
          </TouchableOpacity>
        )}

        {(mission.status === 'COMPLETED' || declined) && (
          <View style={[s.doneBox, declined ? s.doneBoxDeclined : null]}>
            <Ionicons name={declined ? 'close-circle' : 'checkmark-circle'} size={22}
              color={declined ? colors.textMuted : colors.emerald} />
            <Text style={[s.doneText, { color: declined ? colors.textSecondary : colors.emerald }]}>
              {declined ? 'Mission declined' : 'Mission completed'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.bg },
  content:  { padding: spacing.lg, gap: spacing.md },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  hero:     { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  heroTop:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  typeTile: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  heroType: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sevBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginTop: 4 },
  sevText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  heroDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  locRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  coords:   { fontFamily: font.mono, fontSize: 12, color: colors.navy, fontWeight: '600' },
  drone:    { fontSize: 11, color: colors.textMuted },

  mapBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: colors.navyTint, borderRadius: radius.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  mapBtnText: { fontSize: 13, fontWeight: '700', color: colors.navy },

  stepper:  { flexDirection: 'row', backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  step:     { flex: 1, alignItems: 'center', gap: 6 },
  stepRow:  { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border },
  stepDot:  { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.panelLight, borderWidth: 1, borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center' },
  stepDotOn:     { backgroundColor: colors.navy, borderColor: colors.navy },
  stepDotActive: { shadowColor: colors.navy, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  stepNum:   { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  stepLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  stepLabelOn: { color: colors.navy },

  actions: { gap: spacing.sm },
  routeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md,
    backgroundColor: colors.navy, borderRadius: radius.lg, paddingVertical: 18,
    shadowColor: colors.navy, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  routeBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  routeBtnSub:  { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  declineBtn:  { alignItems: 'center', paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  declineText: { fontSize: 13, fontWeight: '700', color: colors.alert },

  primaryBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                 backgroundColor: colors.navy, borderRadius: radius.lg, paddingVertical: 16 },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  doneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
             backgroundColor: '#ecfdf5', borderRadius: radius.lg, borderWidth: 1, borderColor: '#a7f3d0', paddingVertical: 18 },
  doneBoxDeclined: { backgroundColor: colors.panelLight, borderColor: colors.border },
  doneText: { fontSize: 15, fontWeight: '800' },
})
