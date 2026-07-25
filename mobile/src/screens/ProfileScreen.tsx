import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { colors, radius, spacing, ROLE_LABELS } from '../theme'

export default function ProfileScreen() {
  const { user, logout } = useAuth()

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role.toUpperCase()) : '—'
  const initials  = (user?.displayName ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <View style={s.root}>
      {/* Navy identity header */}
      <View style={s.hero}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.name}>{user?.displayName ?? 'Unknown User'}</Text>
        <View style={s.roleBadge}>
          <Ionicons name="shield-checkmark" size={12} color="#fff" />
          <Text style={s.roleText}>{roleLabel}</Text>
        </View>
      </View>

      <View style={s.content}>
        <View style={s.infoCard}>
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} />
          <View style={s.divider} />
          <InfoRow icon="business-outline" label="Organization" value={user?.organization ?? '—'} />
          <View style={s.divider} />
          <InfoRow icon="finger-print-outline" label="User ID" value={user?.uid ?? '—'} />
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={colors.alert} />
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={s.brandRow}>
          <View style={s.brandTile}>
            <Image source={require('../../assets/logo-mark.jpg')} style={{ width: 18, height: 18 }} resizeMode="contain" />
          </View>
          <Text style={s.footer}>RescueEye v1.0 · UC Banilad Capstone 2025</Text>
        </View>
      </View>
    </View>
  )
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}><Ionicons name={icon} size={16} color={colors.navy} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  hero:   { backgroundColor: colors.navy, alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.xl,
            borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: spacing.sm },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  name:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 5,
               borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' },
  roleText:  { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  content: { padding: spacing.lg, gap: spacing.lg },

  infoCard: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  infoIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.navyTint, alignItems: 'center', justifyContent: 'center' },
  infoLabel:{ fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  infoValue:{ fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginTop: 1 },
  divider:  { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                borderRadius: radius.md, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', paddingVertical: 14 },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.alert },

  brandRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  brandTile: { width: 26, height: 26, borderRadius: 7, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
               alignItems: 'center', justifyContent: 'center' },
  footer:    { fontSize: 11, color: colors.textMuted },
})
