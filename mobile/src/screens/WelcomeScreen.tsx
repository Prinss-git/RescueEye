import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, font, radius, spacing } from '../theme'

function Emblem() {
  return (
    <View style={s.emblemOuter}>
      <View style={s.emblemInner} />
      <View style={[s.tick, s.tickTop]} />
      <View style={[s.tick, s.tickBottom]} />
      <View style={[s.tick, s.tickLeft]} />
      <View style={[s.tick, s.tickRight]} />
      <Text style={s.emblemText}>RE</Text>
    </View>
  )
}

const FEATURES = [
  { label: 'CASUALTY ALERTS',    desc: 'Real-time mission alerts when a victim is detected.' },
  { label: 'GPS NAVIGATION',     desc: 'Turn-by-turn routing straight to the incident site.' },
  { label: 'MISSION TRACKING',   desc: 'Accept, update, and report missions from the field.' },
]

export default function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.logoBlock}>
        <Emblem />
        <Text style={s.title}>RESCUEEYE</Text>
        <Text style={s.subtitle}>FIELD RESPONDER APP</Text>
      </View>

      <Text style={s.tagline}>
        AI-assisted disaster response — mission alerts, geolocation, and
        real-time coordination for responders in the field.
      </Text>

      <View style={s.featureList}>
        {FEATURES.map((f) => (
          <View key={f.label} style={s.featureRow}>
            <View style={s.featureDot} />
            <View style={s.featureText}>
              <Text style={s.featureLabel}>{f.label}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.submitBtn} onPress={onGetStarted}>
        <Text style={s.submitText}>GET STARTED</Text>
      </TouchableOpacity>

      <Text style={s.footer}>University of Cebu – Banilad Campus · Capstone 2025</Text>
    </ScrollView>
  )
}

const EMBLEM_SIZE = 80

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },

  logoBlock: { alignItems: 'center', gap: spacing.sm },
  emblemOuter: {
    width: EMBLEM_SIZE, height: EMBLEM_SIZE, borderRadius: EMBLEM_SIZE / 2,
    borderWidth: 2, borderColor: colors.cyan, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emblemInner: {
    position: 'absolute', width: EMBLEM_SIZE - 16, height: EMBLEM_SIZE - 16,
    borderRadius: (EMBLEM_SIZE - 16) / 2, borderWidth: 0.5, borderColor: 'rgba(0,212,255,0.4)',
  },
  tick: { position: 'absolute', backgroundColor: colors.cyan },
  tickTop:    { top: -10, width: 2, height: 12 },
  tickBottom: { bottom: -10, width: 2, height: 12 },
  tickLeft:   { left: -10, width: 12, height: 2 },
  tickRight:  { right: -10, width: 12, height: 2 },
  emblemText: { fontFamily: font.mono, fontWeight: 'bold', fontSize: 14, color: colors.cyan },

  title:    { fontFamily: font.mono, fontWeight: 'bold', fontSize: 20, color: colors.cyan, letterSpacing: 4 },
  subtitle: { fontFamily: font.mono, fontSize: 11, color: colors.textMuted, letterSpacing: 2 },

  tagline: {
    fontFamily: font.mono, fontSize: 12, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 18, maxWidth: 320,
  },

  featureList: { width: '100%', maxWidth: 360, gap: spacing.md },
  featureRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  featureDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cyan, marginTop: 6 },
  featureText: { flex: 1 },
  featureLabel: { fontFamily: font.mono, fontWeight: 'bold', fontSize: 11, color: colors.textPrimary, letterSpacing: 1 },
  featureDesc:  { fontFamily: font.mono, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  submitBtn: {
    width: '100%', maxWidth: 360, backgroundColor: colors.cyan, borderRadius: radius.sm,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontFamily: font.mono, fontWeight: 'bold', fontSize: 13, color: colors.bg, letterSpacing: 2 },

  footer: { fontFamily: font.mono, fontSize: 10, color: colors.textFaint, textAlign: 'center' },
})
