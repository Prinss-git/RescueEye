/**
 * TanStack Query hooks — one definition per server resource.
 *
 * Replaces the four hand-rolled `setInterval` loops that each screen used to
 * own. Beyond deduplication, this buys three things the old loops couldn't do:
 * polling pauses when the app is backgrounded (see the AppState wiring in
 * queryClient.ts), failures retry with backoff instead of vanishing into
 * `catch {}`, and every screen gets real loading/error/stale state.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Detection, Incident, Mission, MissionStatus } from '../types'

export const queryKeys = {
  missions:   ['missions'] as const,
  mission:    (id: string) => ['missions', id] as const,
  incidents:  ['incidents'] as const,
  incident:   (id: string) => ['incidents', id] as const,
  verifiedIncidents: ['incidents', { verified: true }] as const,
  detections: ['detections'] as const,
}

// The server now scopes /missions to the authenticated user, so no userId
// param — passing one was how the old code leaked other responders' missions.
export function useMissions() {
  return useQuery({
    queryKey: queryKeys.missions,
    queryFn:  () => apiFetch<Mission[]>('/missions'),
    refetchInterval: 15_000,
  })
}

export function useMission(missionId: string) {
  return useQuery({
    queryKey: queryKeys.mission(missionId),
    queryFn:  () => apiFetch<Mission>(`/missions/${missionId}`),
    enabled:  !!missionId,
  })
}

export function useIncident(incidentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.incident(incidentId ?? ''),
    queryFn:  () => apiFetch<Incident>(`/incidents/${incidentId}`),
    enabled:  !!incidentId,
  })
}

export function useIncidents() {
  return useQuery({
    queryKey: queryKeys.incidents,
    queryFn:  () => apiFetch<Incident[]>('/incidents'),
    refetchInterval: 30_000,
  })
}

export function useVerifiedIncidents() {
  return useQuery({
    queryKey: queryKeys.verifiedIncidents,
    queryFn:  () => apiFetch<Incident[]>('/incidents?verified=true'),
    refetchInterval: 20_000,
  })
}

/** `live` is the Activity screen's pause toggle — pausing stops the refetch
 *  timer entirely rather than throwing away responses. */
export function useRecentDetections(live = true) {
  return useQuery({
    queryKey: queryKeys.detections,
    queryFn:  () => apiFetch<Detection[]>('/detections/recent', { target: 'api' }),
    refetchInterval: live ? 10_000 : false,
  })
}

/**
 * Mission status writes. All three actions invalidate both the list and the
 * detail so the Missions tab reflects the change the moment the responder
 * taps, without either screen re-polling.
 */
export function useMissionStatusMutation(missionId: string) {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.mission(missionId) })
    qc.invalidateQueries({ queryKey: queryKeys.missions })
  }

  const accept = useMutation({
    mutationFn: () => apiFetch<Mission>(`/missions/${missionId}/accept`, { method: 'PATCH' }),
    onSuccess: invalidate,
  })

  const decline = useMutation({
    mutationFn: () => apiFetch<Mission>(`/missions/${missionId}/decline`, { method: 'PATCH' }),
    onSuccess: invalidate,
  })

  const setStatus = useMutation({
    mutationFn: (vars: { status: MissionStatus; notes?: string; medicalRequired?: boolean }) =>
      apiFetch<Mission>(`/missions/${missionId}/status`, { method: 'PATCH', body: vars }),
    onSuccess: invalidate,
  })

  return { accept, decline, setStatus }
}

/** Reports this device's position so dispatch can find the nearest responder. */
export function reportLocation(lat: number, lng: number) {
  return apiFetch<unknown>('/me/location', { method: 'PATCH', body: { lat, lng } })
}
