// Shared design tokens for the RescueEye mobile app.
// Mirrors the light, professional identity used by the web frontend
// (see frontend/tailwind.config.ts) so both clients feel like one product.

export const colors = {
  bg:          '#f7f8fa',
  panel:       '#ffffff',
  panelLight:  '#f1f5f9',
  border:      '#e2e8f0',
  borderCyan:  '#a5f3fc',

  // Primary brand — matches the web redesign (frontend logo navy).
  navy:        '#0b2a4a',
  navyDim:     '#0e3663',
  navyDeep:    '#061829',
  navyTint:    'rgba(11,42,74,0.06)',

  cyan:        '#0e7490',
  cyanDim:     '#155e75',
  alert:       '#dc2626',
  amber:       '#d97706',
  yellow:      '#ca8a04',
  green:       '#16a34a',
  emerald:     '#059669',
  orange:      '#ea580c',
  orangeAlt:   '#f97316',

  textPrimary:   '#1e293b',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  textFaint:     '#cbd5e1',
}

export const severityColors: Record<string, string> = {
  CRITICAL: colors.alert,
  MODERATE: colors.amber,
  MINOR:    colors.yellow,
}

export const font = {
  mono: 'monospace',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
}

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
}

// Role labels/colors for the 4 RescueEye account roles.
export const ROLE_LABELS: Record<string, string> = {
  system_admin:     'SYSTEM ADMIN',
  agency_admin:     'AGENCY ADMIN',
  command_staff:    'COMMAND STAFF',
  field_responder:  'FIELD RESPONDER',
}

export const ROLE_COLORS: Record<string, string> = {
  system_admin:     colors.cyanDim,
  agency_admin:     colors.amber,
  command_staff:    colors.cyan,
  field_responder:  colors.green,
}
