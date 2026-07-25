/**
 * Domain types shared across screens.
 *
 * These were previously redeclared per-screen — `Mission` and `Incident` each
 * existed twice with different fields, so the two screens disagreed about the
 * same server payload. One declaration each, mirroring what the server sends.
 */

export type MissionStatus =
  | 'ASSIGNED' | 'ACCEPTED' | 'DECLINED'
  | 'EN_ROUTE' | 'ON_SITE' | 'TREATING' | 'COMPLETED'

export type IncidentType =
  | 'VICTIM_DETECTED' | 'FLOOD' | 'FIRE' | 'STRUCTURAL' | 'UNKNOWN'

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export const MISSION_TERMINAL_STATUSES: MissionStatus[] = ['COMPLETED', 'DECLINED']

export interface Mission {
  id:               string
  incidentId:       string
  teamId:           string | null
  agencyId:         string | null
  status:           MissionStatus
  medicalRequired:  boolean | null
  notes:            string
  responderUserIds: string[]
  createdAt:        string
  acceptedAt:       string | null
  completedAt:      string | null
  updatedAt?:       string
}

export interface Incident {
  id:             string
  type:           IncidentType
  severity:       IncidentSeverity
  status:         string
  description:    string
  lat:            number
  lng:            number
  verified:       boolean
  droneCallsign?: string | null
  createdAt:      string
}

export interface Detection {
  id:         string
  class:      string
  confidence: number
  lat?:       number
  lng?:       number
  timestamp:  string
}
