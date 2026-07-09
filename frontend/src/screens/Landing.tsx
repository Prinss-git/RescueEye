import { Link, Navigate } from 'react-router-dom'
import { Eye, MapPin, Radio, Smartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getHomeRoute } from '../components/ProtectedRoute'

const FEATURES = [
  { icon: Eye,        title: 'AI Casualty Detection',   desc: 'Real-time victim and damage detection from live drone feeds.' },
  { icon: MapPin,      title: 'Geospatial Damage Map',   desc: 'Every detection plotted with GPS coordinates as it happens.' },
  { icon: Radio,       title: 'Team Coordination',       desc: 'Dispatch teams, track missions, and message across the incident.' },
  { icon: Smartphone,  title: 'Field Responder App',     desc: 'Mission alerts and navigation for responders on the ground.' },
]

export default function Landing() {
  const { user } = useAuth()

  if (user) return <Navigate to={getHomeRoute(user.role)} replace />

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-3xl text-center">
          <svg width="72" height="72" viewBox="0 0 80 80" className="mx-auto mb-6">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#0e7490" strokeWidth="2" />
            <circle cx="40" cy="40" r="28" fill="none" stroke="#0e7490" strokeWidth="0.5" strokeOpacity="0.4" />
            <line x1="40" y1="8"  x2="40" y2="20" stroke="#0e7490" strokeWidth="2" />
            <line x1="40" y1="60" x2="40" y2="72" stroke="#0e7490" strokeWidth="2" />
            <line x1="8"  y1="40" x2="20" y2="40" stroke="#0e7490" strokeWidth="2" />
            <line x1="60" y1="40" x2="72" y2="40" stroke="#0e7490" strokeWidth="2" />
            <text x="40" y="46" textAnchor="middle" fill="#0e7490" fontSize="14" fontFamily="Inter, sans-serif" fontWeight="700">RE</text>
          </svg>

          <h1 className="font-semibold text-slate-800 tracking-tight text-3xl">RescueEye</h1>
          <p className="text-slate-500 text-base mt-3 max-w-xl mx-auto">
            An AI-assisted disaster response platform that turns drone footage into
            real-time casualty detection, damage mapping, and coordinated field response.
          </p>

          <Link to="/login" className="btn-primary inline-flex items-center justify-center mt-8 px-8 py-2.5">
            Login
          </Link>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-14 text-left">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="panel p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-accent-tint text-accent flex items-center justify-center flex-shrink-0">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-slate-400 text-xs pb-6">
        University of Cebu – Banilad Campus · Capstone 2025
      </p>
    </div>
  )
}
