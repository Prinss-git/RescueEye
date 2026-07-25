import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Eye, MapPin, Radio, Smartphone, ArrowRight, ScanLine,
  ShieldCheck, Navigation, ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getHomeRoute } from '../components/ProtectedRoute'

// ── Brand palette (from the logo) ─────────────────────────────────────────────
const NAVY = '#0b2a4a'

const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-70px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

const PIPELINE = [
  { icon: ScanLine,   step: '01', title: 'Detect',   desc: 'YOLOv8 scans the live drone feed frame-by-frame for victims and structural damage.' },
  { icon: ShieldCheck, step: '02', title: 'Verify',   desc: 'Command staff confirm each AI detection before it ever becomes an active incident.' },
  { icon: Radio,      step: '03', title: 'Dispatch', desc: 'The nearest available responder is auto-assigned from their live GPS location.' },
  { icon: Navigation, step: '04', title: 'Route',    desc: 'Responders get an instant alert and turn-by-turn navigation straight to the scene.' },
]

const FEATURES = [
  { icon: Eye,        title: 'AI Casualty Detection', desc: 'Dual custom-trained models flag victims and damage in real time, with confidence scoring on every frame.' },
  { icon: MapPin,     title: 'Geospatial Damage Map',  desc: 'Every verified detection is pinned to a live map with GPS coordinates the moment it is confirmed.' },
  { icon: Radio,      title: 'Command Coordination',   desc: 'A single console to verify detections, dispatch responders, and message across the whole incident.' },
  { icon: Smartphone, title: 'Field Responder App',    desc: 'Push alerts, mission details, and native maps routing — built for responders moving on the ground.' },
]

const STATS = [
  { value: '<3s',        label: 'Detection latency' },
  { value: 'AI-Verified', label: 'Human in the loop' },
  { value: 'Nearest-first', label: 'Automatic dispatch' },
  { value: 'Live',       label: 'Geospatial mapping' },
]

// ── Tactical radar scope (hero centerpiece) ──────────────────────────────────
function RadarScope() {
  const rings = [0.34, 0.56, 0.78, 1]
  const blips = [
    { top: '30%', left: '64%', delay: '0s' },
    { top: '62%', left: '38%', delay: '1.1s' },
    { top: '46%', left: '74%', delay: '2.3s' },
    { top: '70%', left: '58%', delay: '3.1s' },
  ]

  return (
    <div className="relative re-float" style={{ width: 420, height: 420 }}>
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.22) 0%, transparent 65%)' }}
      />

      {/* Rings */}
      {rings.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${s * 100}%`, height: `${s * 100}%`,
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            borderColor: 'rgba(148,197,255,0.16)',
          }}
        />
      ))}

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 w-full h-px" style={{ background: 'rgba(148,197,255,0.12)' }} />
      <div className="absolute left-1/2 top-0 h-full w-px" style={{ background: 'rgba(148,197,255,0.12)' }} />

      {/* Sweep */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden re-radar-sweep"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 285deg, rgba(34,211,238,0.10) 330deg, rgba(34,211,238,0.45) 360deg)',
          maskImage: 'radial-gradient(circle, #000 0%, #000 100%)',
        }}
      />

      {/* Blips */}
      {blips.map((b, i) => (
        <div key={i} className="absolute" style={{ top: b.top, left: b.left }}>
          <div className="absolute w-2 h-2 rounded-full" style={{ background: '#34d399', transform: 'translate(-50%,-50%)' }} />
          <div
            className="absolute w-2 h-2 rounded-full"
            style={{ background: 'rgba(52,211,153,0.55)', transform: 'translate(-50%,-50%)', animation: `blipPing 2.6s ease-out ${b.delay} infinite` }}
          />
        </div>
      ))}

      {/* Center brand disc — white tile keeps the navy-on-white logo crisp on dark */}
      <div
        className="absolute top-1/2 left-1/2 rounded-2xl bg-white flex items-center justify-center"
        style={{
          width: 116, height: 116, transform: 'translate(-50%, -50%)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.6)',
        }}
      >
        <img src="/logo-mark.jpg" alt="RescueEye" className="w-[86px] h-[86px] object-contain" />
      </div>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  if (user) return <Navigate to={getHomeRoute(user.role)} replace />

  return (
    <div className="min-h-screen bg-bg">
      {/* ═══ HERO (dark command-center) ═══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, #061829 0%, ${NAVY} 55%, #0e3663 100%)` }}
      >
        {/* Animated grid texture */}
        <div
          className="absolute inset-0 re-grid-drift"
          style={{
            opacity: 0.5,
            backgroundImage:
              'linear-gradient(rgba(148,197,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,197,255,0.06) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 100% 80% at 50% 0%, #000 30%, transparent 80%)',
          }}
        />
        {/* Ambient glows */}
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.14) 0%, transparent 70%)' }} />
        <div className="absolute top-20 right-0 w-[560px] h-[560px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />

        {/* Top bar */}
        <nav className="relative z-10 max-w-6xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
              <img src="/logo-mark.jpg" alt="" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-white font-bold tracking-tight text-lg">RescueEye</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 rounded-md text-sm font-medium text-white/80 hover:text-white transition-colors">
              Login
            </Link>
            <Link to="/register"
              className="px-4 py-2 rounded-md text-sm font-semibold text-[#0b2a4a] bg-white hover:bg-white/90 transition-colors shadow-sm">
              Register Agency
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-8 pt-10 pb-28 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
          {/* Left: copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm mb-7"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 re-live-dot" />
              <span className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase">
                AI-Assisted Disaster Response
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="text-white font-extrabold tracking-tight leading-[1.05] text-5xl sm:text-6xl"
            >
              Find survivors
              <br />
              <span
                className="re-shimmer"
                style={{ backgroundImage: 'linear-gradient(90deg, #ffffff, #7dd3fc, #34d399, #ffffff)' }}
              >
                faster than ever.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="text-white/65 text-lg mt-6 max-w-lg leading-relaxed"
            >
              RescueEye turns live drone feeds into AI-verified casualty detection,
              real-time damage maps, and automatic dispatch to the nearest responder —
              one command platform from sighting to rescue.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-9"
            >
              <Link to="/login"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold text-[#0b2a4a] bg-white hover:shadow-lg hover:shadow-cyan-500/10 transition-all">
                Enter Command Center
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link to="/register"
                className="inline-flex items-center justify-center px-7 py-3 rounded-lg text-sm font-semibold text-white border border-white/20 hover:bg-white/5 transition-colors">
                Register Your Agency
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-white/35 text-xs mt-8 tracking-wide"
            >
              Trusted workflow for CDRRMO · BFP · EMS field operations
            </motion.p>
          </div>

          {/* Right: radar scope */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:flex items-center justify-center"
          >
            <RadarScope />
          </motion.div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          <ChevronDown size={18} className="text-white/40 re-scroll-nudge" />
        </div>

        {/* Bottom fade into light body */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-b from-transparent to-[#f7f8fa]" />
      </section>

      {/* ═══ STAT BAND ════════════════════════════════════════════════════════ */}
      <section className="relative -mt-4 z-10">
        <div className="max-w-5xl mx-auto px-8">
          <motion.div {...reveal}
            className="panel grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-200 overflow-hidden">
            {STATS.map((s) => (
              <div key={s.label} className="px-6 py-7 text-center">
                <p className="text-2xl font-extrabold" style={{ color: NAVY }}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1.5 tracking-wide">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ PIPELINE ═════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-8 pt-24 pb-8">
        <motion.div {...reveal} className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: `${NAVY}99` }}>
            From sighting to rescue
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
            One continuous response pipeline
          </h2>
          <p className="text-slate-500 mt-4 leading-relaxed">
            Every stage is connected — a detection never sits idle, and a confirmed
            casualty reaches a responder in seconds, not minutes.
          </p>
        </motion.div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-5 mt-14">
          {/* connecting line */}
          <div className="hidden md:block absolute top-9 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          {PIPELINE.map((p, i) => (
            <motion.div key={p.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative text-center"
            >
              <div className="relative mx-auto w-[72px] h-[72px] rounded-2xl bg-white border border-slate-200 shadow-card flex items-center justify-center"
                style={{ color: NAVY }}>
                <p.icon size={26} strokeWidth={1.9} />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                  style={{ background: NAVY }}>
                  {p.step}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 mt-5">{p.title}</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-8 pt-20 pb-24">
        <motion.h2 {...reveal} className="text-3xl font-extrabold tracking-tight text-slate-800 text-center mb-14">
          Built for the moments that matter
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group panel p-6 flex items-start gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: `${NAVY}0f`, color: NAVY }}>
                <f.icon size={22} strokeWidth={2} />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">{f.title}</p>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ CTA BAND ═════════════════════════════════════════════════════════ */}
      <section className="px-8 pb-24">
        <motion.div {...reveal}
          className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden px-10 py-16 text-center"
          style={{ background: `linear-gradient(135deg, #061829 0%, ${NAVY} 60%, #0e3663 100%)` }}
        >
          <div className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(rgba(148,197,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,197,255,0.07) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
              maskImage: 'radial-gradient(ellipse 80% 100% at 50% 0%, #000, transparent 75%)',
            }} />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 70%)' }} />

          <div className="relative">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Ready to deploy RescueEye?
            </h2>
            <p className="text-white/60 mt-4 max-w-md mx-auto leading-relaxed">
              Register your agency in minutes and put AI-assisted disaster response
              in the hands of your command team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
              <Link to="/register"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold text-[#0b2a4a] bg-white hover:shadow-lg hover:shadow-cyan-500/10 transition-all">
                Register Your Agency
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link to="/login"
                className="inline-flex items-center justify-center px-8 py-3 rounded-lg text-sm font-semibold text-white border border-white/20 hover:bg-white/5 transition-colors">
                Login
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
              <img src="/logo-mark.jpg" alt="" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: NAVY }}>RescueEye</p>
              <p className="text-[11px] text-slate-400 tracking-wide">AI-Assisted Disaster Response</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">
            University of Cebu – Banilad Campus · Capstone 2025
          </p>
        </div>
      </footer>
    </div>
  )
}
