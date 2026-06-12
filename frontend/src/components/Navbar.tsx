import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  incident_commander: 'INC. COMMANDER',
  drone_operator:     'DRONE OPERATOR',
  coordinator:        'COORDINATOR',
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [drillActive, setDrillActive] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/server/drill/active')
        if (!res.ok) return
        const data = await res.json()
        setDrillActive(!!data?.active)
      } catch {}
    }
    check()
    const t = setInterval(check, 5000)
    return () => clearInterval(t)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `font-mono text-xs tracking-widest px-4 py-2 rounded transition-colors ${
      isActive
        ? 'bg-cyan/20 text-cyan border border-cyan/40'
        : 'text-white/60 hover:text-cyan hover:bg-cyan/10'
    }`

  return (
    <header
      className="flex items-center justify-between px-4 py-2 border-b border-cyan/20 bg-panel"
      style={{ boxShadow: '0 2px 12px rgba(0,212,255,0.15)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-cyan flex items-center justify-center shadow-cyan">
          <span className="text-cyan font-mono font-bold text-xs">RE</span>
        </div>
        <span className="font-mono font-bold text-cyan tracking-widest text-sm">RESCUEEYE</span>
        <span className="text-white/20 font-mono text-xs ml-2 border border-white/10 px-2 py-0.5 rounded">
          CMD CENTER
        </span>
        {drillActive && (
          <span className="font-mono text-xs px-2 py-0.5 rounded border border-orange-500/50 bg-orange-500/10 text-orange-300 animate-pulse">
            ● DRILL ACTIVE
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-2">
        <NavLink to="/dashboard"    className={navLinkClass}>LIVE FEED</NavLink>
        <NavLink to="/map"          className={navLinkClass}>DAMAGE MAP</NavLink>
        <NavLink to="/coordination" className={navLinkClass}>COORDINATION</NavLink>
        <NavLink to="/evaluation"   className={navLinkClass}>EVALUATION</NavLink>
      </nav>

      {/* User info */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-mono text-white/80">{user?.displayName?.toUpperCase()}</p>
          <p className="text-xs font-mono text-cyan/70">
            {user?.role ? ROLE_LABELS[user.role] : ''}
          </p>
        </div>
        <div className="text-right border-l border-white/10 pl-4">
          <p className="font-mono text-xs text-white/80 tabular-nums">
            {now.toLocaleTimeString('en-PH', { hour12: false })}
          </p>
          <p className="font-mono text-[10px] text-white/40">
            {now.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
          </p>
        </div>
        <button onClick={handleLogout} className="btn-ghost text-xs">LOGOUT</button>
      </div>
    </header>
  )
}
