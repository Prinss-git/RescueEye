import { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
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

export default function LoginScreen() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit() {
    setError('')
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
    } catch {
      setError('Invalid credentials. Try commander@rescueeye.ph / password123')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled">

        <View style={s.logoBlock}>
          <Emblem />
          <Text style={s.title}>RESCUEEYE</Text>
          <Text style={s.subtitle}>AI-ASSISTED COMMAND CENTER</Text>
        </View>

        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input}
              placeholder="commander@rescueeye.ph"
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.submitBtn, loading && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={s.submitText}>LOGIN</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>University of Cebu – Banilad Campus · Capstone 2025</Text>
      </ScrollView>
    </KeyboardAvoidingView>
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

  card: {
    width: '100%', maxWidth: 360, backgroundColor: colors.panel, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.15)', padding: spacing.xl, gap: spacing.lg,
  },
  field: { gap: spacing.xs },
  label: { fontFamily: font.mono, fontSize: 10, color: colors.textSecondary, letterSpacing: 2 },
  input: {
    fontFamily: font.mono, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.panelLight, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  errorBox: {
    borderWidth: 1, borderColor: 'rgba(255,59,59,0.3)', backgroundColor: 'rgba(255,59,59,0.1)',
    borderRadius: radius.sm, padding: spacing.sm,
  },
  errorText: { fontFamily: font.mono, fontSize: 11, color: colors.alert },
  submitBtn: {
    marginTop: spacing.xs, backgroundColor: colors.cyan, borderRadius: radius.sm,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontFamily: font.mono, fontWeight: 'bold', fontSize: 13, color: colors.bg, letterSpacing: 2 },

  footer: { fontFamily: font.mono, fontSize: 10, color: colors.textFaint, textAlign: 'center' },
})
