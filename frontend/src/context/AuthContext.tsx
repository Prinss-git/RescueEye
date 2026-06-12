import React, { createContext, useContext, useState, useCallback } from 'react'

interface User {
  uid: string
  email: string
  role: 'incident_commander' | 'drone_operator' | 'coordinator'
  displayName: string
}

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('rescueeye_user')
    return stored ? (JSON.parse(stored) as User) : null
  })

  const login = useCallback(async (email: string, _password: string) => {
    // Phase 1 stub — replace with real Firebase call in Phase 2
    const mockUser: User = {
      uid: 'mock-uid-001',
      email,
      role: 'incident_commander',
      displayName: email.split('@')[0],
    }
    sessionStorage.setItem('rescueeye_user', JSON.stringify(mockUser))
    setUser(mockUser)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem('rescueeye_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
