import { useState } from 'react'
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import { colors, radius, spacing } from '../theme'

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
    } catch (err) {
      // The server distinguishes bad credentials from a deactivated account,
      // a pending agency registration, and a lapsed subscription. Collapsing
      // all of those into "invalid credentials" sent responders hunting for a
      // password problem that didn't exist.
      setError(err instanceof ApiError
        ? err.message
        : 'Could not sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Navy brand header */}
      <View style={s.hero}>
        <View style={s.logoTile}>
          <Image source={require('../../assets/logo-mark.jpg')} style={{ width: 52, height: 52 }} resizeMode="contain" />
        </View>
        <Text style={s.brand}>RescueEye</Text>
        <Text style={s.tagline}>Field Responder</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.cardTitle}>Sign in to respond</Text>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={s.input}
                placeholder="responder@agency.ph"
                placeholderTextColor={colors.textFaint}
                value={email} onChangeText={setEmail}
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                editable={!loading}
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={s.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                value={password} onChangeText={setPassword}
                secureTextEntry editable={!loading}
              />
            </View>
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={15} color={colors.alert} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[s.submitBtn, loading && s.submitBtnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={s.submitText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={17} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>University of Cebu – Banilad Campus · Capstone 2025</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },

  hero:    { backgroundColor: colors.navy, alignItems: 'center', paddingTop: 72, paddingBottom: 40,
             borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoTile: { width: 76, height: 76, borderRadius: 20, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
              shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  brand:   { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
  tagline: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' },

  content: { padding: spacing.xl, gap: spacing.lg },
  card: {
    marginTop: -24, backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.lg,
    shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  field: { gap: spacing.xs },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.panelLight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 12 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)', backgroundColor: 'rgba(220,38,38,0.06)',
    borderRadius: radius.md, padding: spacing.md,
  },
  errorText: { flex: 1, fontSize: 12, color: colors.alert },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.xs, backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 15,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontWeight: '700', fontSize: 15, color: '#ffffff', letterSpacing: 0.3 },

  footer: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: spacing.md },
})
