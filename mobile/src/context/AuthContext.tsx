import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SERVER_BASE } from '../config'

const STORAGE_KEY = 'rescueeye_auth'

export interface RescueEyeUser {
  uid:          string
  email:        string
  displayName:  string
  role:         string
  organization?: string
}

interface AuthState {
  user:    RescueEyeUser | null
  token:   string | null
  loading: boolean
  login:  (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<RescueEyeUser | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          setUser(saved.user)
          setToken(saved.token)
        }
      } catch {
        // corrupt/unavailable storage — fall through to logged-out state
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function login(email: string, password: string) {
    const res = await fetch(`${SERVER_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      throw new Error('Invalid credentials')
    }
    const data = await res.json()
    setUser(data.user)
    setToken(data.token)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async function logout() {
    try {
      await fetch(`${SERVER_BASE}/auth/logout`, { method: 'POST' })
    } catch {
      // best-effort — always clear local session regardless
    }
    setUser(null)
    setToken(null)
    await AsyncStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
