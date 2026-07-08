import { useState, FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getHomeRoute } from '../components/ProtectedRoute'

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  if (user) return <Navigate to={getHomeRoute(user.role)} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      // Navigation to the right home route happens via the `if (user)` redirect above,
      // triggered by the context re-render — nothing else needed here.
    } catch {
      setError('Invalid credentials. Try commander@rescueeye.ph / password123')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo block */}
        <div className="text-center mb-8">
          <svg width="64" height="64" viewBox="0 0 80 80" className="mx-auto mb-4">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#0e7490" strokeWidth="2" />
            <circle cx="40" cy="40" r="28" fill="none" stroke="#0e7490" strokeWidth="0.5" strokeOpacity="0.4" />
            <line x1="40" y1="8"  x2="40" y2="20" stroke="#0e7490" strokeWidth="2" />
            <line x1="40" y1="60" x2="40" y2="72" stroke="#0e7490" strokeWidth="2" />
            <line x1="8"  y1="40" x2="20" y2="40" stroke="#0e7490" strokeWidth="2" />
            <line x1="60" y1="40" x2="72" y2="40" stroke="#0e7490" strokeWidth="2" />
            <text x="40" y="46" textAnchor="middle" fill="#0e7490" fontSize="14" fontFamily="Inter, sans-serif" fontWeight="700">RE</text>
          </svg>
          <h1 className="font-semibold text-slate-800 tracking-tight text-xl">RescueEye</h1>
          <p className="text-slate-500 text-sm mt-1">AI-Assisted Command Center</p>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} className="panel p-8 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="commander@rescueeye.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-alert text-xs border border-red-200 bg-red-50 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full mt-2 flex items-center justify-center gap-2" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                Authenticating…
              </>
            ) : 'Login'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-6">
          University of Cebu – Banilad Campus · Capstone 2025
        </p>
      </div>

      <div className="fixed bottom-4 right-4 text-xs text-slate-400 pointer-events-none">
        RescueEye v1.0
      </div>
    </div>
  )
}
