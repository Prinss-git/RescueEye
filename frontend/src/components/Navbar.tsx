import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  incident_commander: 'Incident Commander',
  drone_operator:      'Drone Operator',
  coordinator:         'Coordinator',
  sar_responder:       'Search & Rescue',
  ems_responder:       'Emergency Medical',
  system_admin:        'System Admin',
  agency_admin:        'Agency Admin',
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

  return (
    <header className="flex items-center justify-between px-5 h-14 flex-shrink-0 border-b border-slate-200 bg-surface">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-accent flex items-center justify-center">
          <span className="text-accent font-semibold text-xs">RE</span>
        </div>
        <span className="font-semibold text-slate-800 tracking-tight text-sm">RescueEye</span>
        {drillActive && (
          <span className="badge border-amber-200 bg-amber-50 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Drill Active
          </span>
        )}
      </div>

      {/* User info */}
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-slate-700">{user?.displayName}</p>
          <p className="text-xs text-accent">{user?.role ? ROLE_LABELS[user.role] : ''}</p>
        </div>
        <div className="text-right border-l border-slate-200 pl-4 hidden md:block">
          <p className="text-xs font-mono text-slate-600 tabular-nums">
            {now.toLocaleTimeString('en-PH', { hour12: false })}
          </p>
          <p className="text-[10px] text-slate-400">
            {now.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })}
          </p>
        </div>
        <button onClick={handleLogout} className="btn-ghost text-xs flex items-center gap-1.5">
          <LogOut size={14} /> Logout
        </button>
      </div>
    </header>
  )
}
