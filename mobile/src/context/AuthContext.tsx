import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiFetch, setAuthToken, setUnauthorizedHandler } from '../api/client'
import {
  registerForPushNotifications,
  unregisterPushToken,
  describeRegistrationFailure,
} from '../notifications/push'

const STORAGE_KEY = 'rescueeye_auth'

export interface RescueEyeUser {
  uid:          string
  email:        string
  displayName:  string
  role:         string
  organization?: string
  agencyId?:    string | null
}

interface LoginResponse {
  token: string
  user:  RescueEyeUser
}

interface AuthState {
  user:    RescueEyeUser | null
  token:   string | null
  loading: boolean
  /** Non-null when push registration failed — surfaced in Profile so a
   *  responder is never silently unreachable. */
  pushWarning: string | null
  login:  (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<RescueEyeUser | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pushWarning, setPushWarning] = useState<string | null>(null)

  // logout is referenced by the 401 handler, which is registered once on
  // mount — a ref keeps that handler pointing at the current implementation
  // without re-registering on every render.
  const logoutRef = useRef<() => Promise<void>>(async () => {})

  // Applies a session to both React state and the API client. The client
  // holds the token separately because query functions and push registration
  // run outside the React tree.
  const applySession = useCallback((next: LoginResponse | null) => {
    setUser(next?.user ?? null)
    setToken(next?.token ?? null)
    setAuthToken(next?.token ?? null)
  }, [])

  const clearSession = useCallback(async () => {
    applySession(null)
    setPushWarning(null)
    await AsyncStorage.removeItem(STORAGE_KEY)
  }, [applySession])

  // Registering the device is what makes dispatch reach a responder whose
  // phone is locked. Only field responders are dispatched to, so nobody else
  // needs a token — and a failure must never block signing in.
  const registerPush = useCallback(async (u: RescueEyeUser) => {
    if (u.role !== 'field_responder') return
    const result = await registerForPushNotifications()
    setPushWarning(describeRegistrationFailure(result))
  }, [])

  const logout = useCallback(async () => {
    // Drop the push token first — while we still have a valid session to
    // authenticate the call. Otherwise this device keeps receiving the
    // previous user's dispatches.
    await unregisterPushToken()
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Best-effort — always clear the local session regardless.
    }
    await clearSession()
  }, [clearSession])

  logoutRef.current = logout

  // A 401 from any request means the session is gone server-side. Without
  // this the app sat in a state where every call failed silently forever.
  useEffect(() => {
    setUnauthorizedHandler(() => { void logoutRef.current() })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved: LoginResponse = JSON.parse(raw)
          applySession(saved)
          // Push tokens rotate, so re-register on every launch rather than
          // trusting whatever was stored on the server previously.
          void registerPush(saved.user)
        }
      } catch {
        // corrupt/unavailable storage — fall through to logged-out state
      } finally {
        setLoading(false)
      }
    })()
  }, [applySession, registerPush])

  async function login(email: string, password: string) {
    const data = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    })
    applySession(data)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    void registerPush(data.user)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, pushWarning, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
