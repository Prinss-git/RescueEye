import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { colors, font, radius, spacing, ROLE_COLORS, ROLE_LABELS } from '../theme'

export default function ProfileScreen() {
  const { user, logout } = useAuth()

  const roleColor = user ? (ROLE_COLORS[user.role] ?? colors.cyan) : colors.cyan
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role.toUpperCase()) : '—'
  const initials  = (user?.displayName ?? '?')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>PROFILE</Text>
      </View>

      <View style={s.content}>
        <View style={s.avatarBlock}>
          <View style={[s.avatar, { borderColor: roleColor }]}>
            <Text style={[s.avatarText, { color: roleColor }]}>{initials}</Text>
          </View>
          <Text style={s.name}>{user?.displayName ?? 'Unknown User'}</Text>
          <View style={[s.roleBadge, { borderColor: roleColor + '55', backgroundColor: roleColor + '18' }]}>
            <Text style={[s.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
        </View>

        <View style={s.infoCard}>
          <InfoRow label="EMAIL" value={user?.email ?? '—'} />
          <View style={s.divider} />
          <InfoRow label="ORGANIZATION" value={user?.organization ?? '—'} />
          <View style={s.divider} />
          <InfoRow label="USER ID" value={user?.uid ?? '—'} />
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>LOG OUT</Text>
        </TouchableOpacity>

        <Text style={s.footer}>RescueEye v1.0 · UC Banilad Capstone 2025</Text>
      </View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  header:      { paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                 borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.panel },
  headerTitle: { fontFamily: font.mono, fontSize: 13, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: 2 },

  content:     { padding: spacing.lg, gap: spacing.lg },

  avatarBlock: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  avatar:      { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
                 backgroundColor: colors.panel },
  avatarText:  { fontFamily: font.mono, fontSize: 22, fontWeight: 'bold' },
  name:        { fontFamily: font.mono, fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: 1 },
  roleBadge:   { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  roleText:    { fontFamily: font.mono, fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },

  infoCard:    { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
                 padding: spacing.lg, gap: spacing.md },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  infoLabel:   { fontFamily: font.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  infoValue:   { fontFamily: font.mono, fontSize: 12, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  divider:     { height: 1, backgroundColor: colors.border },

  logoutBtn:   { borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,59,59,0.4)',
                 backgroundColor: 'rgba(255,59,59,0.08)', paddingVertical: 12, alignItems: 'center' },
  logoutText:  { fontFamily: font.mono, fontSize: 13, fontWeight: 'bold', color: colors.alert, letterSpacing: 2 },

  footer:      { fontFamily: font.mono, fontSize: 9, color: colors.textFaint, textAlign: 'center', marginTop: spacing.sm },
})
