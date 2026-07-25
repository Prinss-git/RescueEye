/**
 * The single place the mobile app talks to the network.
 *
 * Before this existed, every screen hand-rolled its own `fetch` — which meant
 * only one call in the whole app ever sent an auth token, timeouts were
 * inconsistent, and failures were swallowed by bare `catch {}` blocks so a
 * dead server and an empty result looked identical to the user.
 */
import { API_BASE, SERVER_BASE } from '../config'

const DEFAULT_TIMEOUT_MS = 8000

/**
 * The session token lives here as well as in AuthContext because non-React
 * code (query functions, the push registration flow) needs it too. AuthContext
 * owns it and calls setAuthToken on login/logout/restore; nothing else writes.
 */
let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

/** AuthContext registers a handler so a 401 forces a logout instead of leaving
 *  the app in a state where every request silently fails forever. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

export class ApiError extends Error {
  status: number
  /** True when the request never reached the server (offline, DNS, timeout). */
  isNetworkError: boolean

  constructor(message: string, status: number, isNetworkError = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.isNetworkError = isNetworkError
  }

  /** Distinguishes "we can't reach the server" from "the server said no" so
   *  screens can show an offline banner rather than a hard error. */
  get isOffline() {
    return this.isNetworkError
  }
}

/** Which backend a path belongs to — the Node coordination server (default)
 *  or the Python inference API. */
export type ApiTarget = 'server' | 'api'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  target?: ApiTarget
  timeoutMs?: number
  /** Set for endpoints that are legitimately public (e.g. login). */
  skipAuth?: boolean
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    target = 'server',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuth = false,
  } = options

  const base = target === 'api' ? API_BASE : SERVER_BASE
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!skipAuth && authToken) headers.Authorization = `Bearer ${authToken}`

  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    // Timeouts surface as TimeoutError/AbortError; everything else here is a
    // genuine transport failure. Both mean the same thing to a responder in
    // the field: no signal.
    const message = (err as Error)?.name === 'TimeoutError'
      ? 'The server took too long to respond'
      : 'Cannot reach the server — check your connection'
    throw new ApiError(message, 0, true)
  }

  if (res.status === 401) {
    onUnauthorized?.()
    throw new ApiError('Your session has expired — please sign in again', 401)
  }

  if (!res.ok) {
    // The server returns { error } on every failure path; fall back to the
    // status text if we got something unexpected (e.g. an HTML error page).
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // non-JSON body — keep the generic message
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}
