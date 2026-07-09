import React, { createContext, useContext, useState, useCallback } from 'react'

interface User {
  uid: string
  email: string
  role: 'system_admin' | 'agency_admin' | 'command_staff' | 'field_responder'
  displayName: string
  organization?: string
  agencyId?: string | null
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('rescueeye_user')
    return stored ? (JSON.parse(stored) as User) : null
  })
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('rescueeye_token'))

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/server/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error('Invalid credentials')
    const data = await res.json()
    if (data.user.role === 'field_responder') {
      throw new Error('Field Responder accounts are for the RescueEye mobile app.')
    }
    sessionStorage.setItem('rescueeye_user', JSON.stringify(data.user))
    sessionStorage.setItem('rescueeye_token', data.token)
    setUser(data.user)
    setToken(data.token)
  }, [])

  const logout = useCallback(() => {
    const storedToken = sessionStorage.getItem('rescueeye_token')
    fetch('/server/auth/logout', {
      method:  'POST',
      headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : undefined,
    }).catch(() => {})
    sessionStorage.removeItem('rescueeye_user')
    sessionStorage.removeItem('rescueeye_token')
    setUser(null)
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
