import { useState, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

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
      navigate('/dashboard')
    } catch {
      setError('Invalid credentials. Try commander@rescueeye.ph / password123')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center">

      {/* Animated grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.07) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          animation: 'gridScroll 20s linear infinite',
        }}
      />
      <style>{`
        @keyframes gridScroll {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
      `}</style>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo block */}
        <div className="text-center mb-10">
          {/* SVG tactical logo */}
          <svg
            width="80" height="80"
            viewBox="0 0 80 80"
            className="mx-auto mb-4"
            style={{ filter: 'drop-shadow(0 0 16px rgba(0,212,255,0.5))' }}
          >
            <circle cx="40" cy="40" r="36" fill="none" stroke="#00d4ff" strokeWidth="2" />
            <circle cx="40" cy="40" r="28" fill="none" stroke="#00d4ff" strokeWidth="0.5" strokeOpacity="0.4" />
            {/* Crosshair lines */}
            <line x1="40" y1="8"  x2="40" y2="20" stroke="#00d4ff" strokeWidth="2" />
            <line x1="40" y1="60" x2="40" y2="72" stroke="#00d4ff" strokeWidth="2" />
            <line x1="8"  y1="40" x2="20" y2="40" stroke="#00d4ff" strokeWidth="2" />
            <line x1="60" y1="40" x2="72" y2="40" stroke="#00d4ff" strokeWidth="2" />
            {/* RE text */}
            <text x="40" y="46" textAnchor="middle" fill="#00d4ff" fontSize="14" fontFamily="JetBrains Mono, monospace" fontWeight="bold">RE</text>
          </svg>
          <h1 className="font-mono font-bold text-cyan tracking-widest text-xl">RESCUEEYE</h1>
          <p className="text-white/40 font-mono text-xs tracking-widest mt-1">AI-ASSISTED COMMAND CENTER</p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className="panel p-8 flex flex-col gap-5"
          style={{ boxShadow: '0 0 32px rgba(0,212,255,0.15)' }}
        >
          <div>
            <label className="block text-xs font-mono text-white/50 tracking-widest mb-2">EMAIL</label>
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
            <label className="block text-xs font-mono text-white/50 tracking-widest mb-2">PASSWORD</label>
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
            <p className="text-alert text-xs font-mono border border-alert/30 bg-alert/10 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full mt-2 flex items-center justify-center gap-2" disabled={loading}>
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-cyan" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                AUTHENTICATING...
              </>
            ) : 'LOGIN'}
          </button>
        </form>

        <p className="text-center text-white/20 font-mono text-xs mt-6">
          University of Cebu – Banilad Campus · Capstone 2025
        </p>
      </div>

      {/* Version tag bottom-right */}
      <div className="fixed bottom-4 right-4 font-mono text-xs text-white/20 pointer-events-none">
        RescueEye v1.0 — UC Banilad Capstone 2025
      </div>
    </div>
  )
}
