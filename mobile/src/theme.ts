// Shared design tokens for the RescueEye mobile app.
// Mirrors the light, professional identity used by the web frontend
// (see frontend/tailwind.config.ts) so both clients feel like one product.

export const colors = {
  bg:          '#f7f8fa',
  panel:       '#ffffff',
  panelLight:  '#f1f5f9',
  border:      '#e2e8f0',
  borderCyan:  '#a5f3fc',

  cyan:        '#0e7490',
  cyanDim:     '#155e75',
  alert:       '#dc2626',
  amber:       '#d97706',
  yellow:      '#ca8a04',
  green:       '#16a34a',
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
  md: 8,
  lg: 10,
  pill: 20,
}

// Role labels/colors for the 5 RescueEye account roles.
export const ROLE_LABELS: Record<string, string> = {
  incident_commander: 'INCIDENT COMMANDER',
  drone_operator:      'DRONE OPERATOR',
  coordinator:         'COORDINATOR',
  sar_responder:       'SEARCH & RESCUE',
  ems_responder:       'EMERGENCY MEDICAL',
}

export const ROLE_COLORS: Record<string, string> = {
  incident_commander: colors.cyan,
  drone_operator:      colors.orangeAlt,
  coordinator:         colors.amber,
  sar_responder:       colors.green,
  ems_responder:       colors.alert,
}
