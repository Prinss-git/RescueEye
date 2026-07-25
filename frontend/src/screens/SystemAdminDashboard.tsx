import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Search, X, CheckCircle2, XCircle, PauseCircle, PlayCircle, Clock,
  Building2, Inbox, Mail, User, Eye, ShieldCheck, Download,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAVY = '#0b2a4a'

interface VerificationDocument {
  fileName: string
  storedName: string
  uploadedAt: string
}

interface Agency {
  id: string
  name: string
  registrationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED' | string
  createdAt: string
  rejectionReason: string | null
  admin: { displayName: string; email: string } | null
  userCount: number
  verificationDocuments: VerificationDocument[]
}

interface AdminAction {
  id: string
  type: string
  agencyId: string | null
  agencyName: string | null
  adminId: string | null
  detail: string | null
  at: string
}

type View = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED'

const ACTION_ICON: Record<string, { Icon: typeof CheckCircle2; color: string; ring: string }> = {
  AGENCY_APPROVED:  { Icon: CheckCircle2, color: 'text-emerald-600', ring: 'bg-emerald-50' },
  AGENCY_REJECTED:  { Icon: XCircle,      color: 'text-red-600',     ring: 'bg-red-50' },
  AGENCY_SUSPENDED: { Icon: PauseCircle,  color: 'text-amber-600',   ring: 'bg-amber-50' },
  AGENCY_ACTIVE:    { Icon: PlayCircle,   color: 'text-emerald-600', ring: 'bg-emerald-50' },
}

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function isImage(fileName: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(fileName)
}

// ── Status pill ──────────────────────────────────────────────────────────────

function StatusBadge({ agency }: { agency: Agency }) {
  let label = 'Pending Review'
  let cls = 'text-amber-700 bg-amber-50 border-amber-200'
  if (agency.registrationStatus === 'REJECTED') {
    label = 'Rejected'; cls = 'text-slate-600 bg-slate-100 border-slate-200'
  } else if (agency.registrationStatus === 'APPROVED') {
    if (agency.subscriptionStatus === 'ACTIVE') { label = 'Active'; cls = 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    else { label = 'Suspended'; cls = 'text-red-700 bg-red-50 border-red-200' }
  }
  return <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${cls}`}>{label}</span>
}

// ── Stat card (filter) ───────────────────────────────────────────────────────

const TONE: Record<string, { dot: string; icon: string; ring: string }> = {
  amber:   { dot: 'bg-amber-500',   icon: 'text-amber-600 bg-amber-50',     ring: 'ring-amber-400/40' },
  emerald: { dot: 'bg-emerald-500', icon: 'text-emerald-600 bg-emerald-50', ring: 'ring-emerald-400/40' },
  red:     { dot: 'bg-red-500',     icon: 'text-red-600 bg-red-50',         ring: 'ring-red-400/40' },
  slate:   { dot: 'bg-slate-400',   icon: 'text-slate-500 bg-slate-100',    ring: 'ring-slate-400/40' },
}

function StatCard({ label, count, tone, Icon, active, onClick }: {
  label: string; count: number; tone: keyof typeof TONE; Icon: typeof CheckCircle2; active: boolean; onClick: () => void
}) {
  const t = TONE[tone]
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={`relative flex-1 text-left bg-surface border rounded-xl p-4 shadow-card transition-shadow hover:shadow-md ${
        active ? 'border-transparent ring-2' : 'border-slate-200'
      } ${active ? t.ring : ''}`}
    >
      {active && <span className="absolute top-0 left-4 right-4 h-0.5 rounded-full" style={{ background: NAVY }} />}
      <div className="flex items-start justify-between">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.icon}`}>
          <Icon size={15} strokeWidth={2.2} />
        </span>
      </div>
      <p className="text-3xl font-extrabold mt-2 tabular-nums" style={{ color: NAVY }}>{count}</p>
    </motion.button>
  )
}

// ── Document preview modal ──────────────────────────────────────────────────

function DocumentPreviewModal({ agencyId, doc, token, onClose }: {
  agencyId: string; doc: VerificationDocument; token: string | null; onClose: () => void
}) {
  const [url, setUrl]     = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    ;(async () => {
      try {
        const res = await fetch(`/server/admin/agencies/${agencyId}/documents/${doc.storedName}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) throw new Error()
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } catch { setError(true) }
    })()
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [agencyId, doc.storedName, token])

  function download() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = doc.fileName; a.click()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate">{doc.fileName}</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={download} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900" disabled={!url}>
              <Download size={13} /> Download
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 flex items-center justify-center min-h-[320px]">
          {error && <p className="text-sm text-red-600 p-6">Couldn't load this document.</p>}
          {!error && !url && <p className="text-sm text-slate-400 p-6">Loading…</p>}
          {url && isImage(doc.fileName) && <img src={url} alt={doc.fileName} className="max-w-full max-h-[70vh] object-contain" />}
          {url && !isImage(doc.fileName) && <iframe src={url} title={doc.fileName} className="w-full h-[70vh]" />}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Agency list row ──────────────────────────────────────────────────────────

function AgencyRow({ agency, selected, onClick }: {
  agency: Agency; selected: boolean; onClick: () => void
}) {
  const dot = agency.registrationStatus === 'REJECTED' ? 'bg-slate-400'
    : agency.registrationStatus === 'PENDING' ? 'bg-amber-500'
    : agency.subscriptionStatus === 'SUSPENDED' ? 'bg-red-500' : 'bg-emerald-500'

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left p-3 pl-4 rounded-lg border transition-all ${
        selected ? 'bg-white shadow-card border-transparent' : 'border-slate-200 bg-surface-alt hover:border-slate-300 hover:bg-white'
      }`}
    >
      {selected && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ background: NAVY }} />}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        <span className="text-sm font-semibold text-slate-800 truncate">{agency.name}</span>
      </div>
      <p className="text-xs text-slate-400 truncate mt-1 ml-3.5">{agency.admin?.email ?? 'No admin'}</p>
      <p className="text-[11px] text-slate-400 mt-0.5 ml-3.5 flex items-center gap-1">
        <Clock size={10} /> {daysAgo(agency.createdAt)}
      </p>
    </button>
  )
}

// ── Document card ────────────────────────────────────────────────────────────

function DocCard({ doc, onClick }: { doc: VerificationDocument; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-surface-alt hover:bg-white hover:border-slate-300 hover:shadow-card transition-all text-left"
    >
      <span className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${NAVY}0f`, color: NAVY }}>
        <FileText size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-700 truncate max-w-[160px]">{doc.fileName}</span>
        <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 group-hover:text-slate-600">
          <Eye size={10} /> Preview
        </span>
      </span>
    </button>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ agency, onApprove, onReject, onToggleStatus, onPreviewDocument }: {
  agency: Agency
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reason: string) => Promise<void>
  onToggleStatus: (agency: Agency) => Promise<void>
  onPreviewDocument: (doc: VerificationDocument) => void
}) {
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy]     = useState(false)

  async function approve() { setBusy(true); try { await onApprove(agency.id) } finally { setBusy(false) } }
  async function reject()  { setBusy(true); try { await onReject(agency.id, reason) } finally { setBusy(false); setReason(''); setRejecting(false) } }
  async function toggle()  { setBusy(true); try { await onToggleStatus(agency) } finally { setBusy(false) } }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${NAVY}0f`, color: NAVY }}>
              <Building2 size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">{agency.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Submitted {new Date(agency.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <StatusBadge agency={agency} />
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><User size={12} className="text-slate-400" />{agency.admin?.displayName ?? 'No admin'}</span>
          <span className="inline-flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{agency.admin?.email ?? '—'}</span>
          {agency.registrationStatus === 'APPROVED' && (
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} className="text-slate-400" />{agency.userCount} user{agency.userCount === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Verification Documents</p>
          {agency.verificationDocuments.length === 0 ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">No verification documents submitted</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {agency.verificationDocuments.map((doc) => (
                <DocCard key={doc.storedName} doc={doc} onClick={() => onPreviewDocument(doc)} />
              ))}
            </div>
          )}
        </div>

        {agency.registrationStatus === 'REJECTED' && agency.rejectionReason && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Rejection Reason</p>
            <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">"{agency.rejectionReason}"</p>
          </div>
        )}
      </div>

      {/* Action bar */}
      {agency.registrationStatus === 'PENDING' && (
        <div className="p-5 border-t border-slate-100 space-y-3">
          <AnimatePresence mode="wait">
            {rejecting ? (
              <motion.div key="reject" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                <input className="input-field text-sm" placeholder="Reason for rejection (e.g. missing accreditation)…"
                  value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} autoFocus />
                <div className="flex gap-2">
                  <button onClick={reject} disabled={busy || !reason.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40">
                    Confirm Rejection
                  </button>
                  <button onClick={() => { setRejecting(false); setReason('') }} disabled={busy} className="btn-ghost text-sm">Cancel</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
                <button onClick={approve} disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-40"
                  style={{ background: NAVY }}>
                  <CheckCircle2 size={16} /> {busy ? 'Saving…' : 'Approve Agency'}
                </button>
                <button onClick={() => setRejecting(true)} disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                  <XCircle size={16} /> Reject
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {agency.registrationStatus === 'APPROVED' && (
        <div className="p-5 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Subscription</p>
            <p className={`text-sm font-bold mt-0.5 ${agency.subscriptionStatus === 'ACTIVE' ? 'text-emerald-700' : 'text-red-600'}`}>
              {agency.subscriptionStatus}
            </p>
          </div>
          <button onClick={toggle} disabled={busy}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              agency.subscriptionStatus === 'ACTIVE'
                ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
                : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
            }`}>
            {agency.subscriptionStatus === 'ACTIVE' ? <><PauseCircle size={15} /> Suspend</> : <><PlayCircle size={15} /> Reactivate</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Action timeline ──────────────────────────────────────────────────────────

function ActionTimeline({ actions }: { actions: AdminAction[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-header flex items-center gap-2"><Clock size={13} /> Activity Log</div>
      <div className="p-4 max-h-64 overflow-y-auto">
        {actions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">— no actions yet —</p>
        ) : (
          <div className="relative pl-2">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-100" />
            <div className="space-y-3">
              {actions.map((a) => {
                const meta = ACTION_ICON[a.type] ?? { Icon: Clock, color: 'text-slate-400', ring: 'bg-slate-100' }
                const { Icon } = meta
                return (
                  <div key={a.id} className="relative flex items-start gap-3">
                    <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.ring}`}>
                      <Icon size={14} className={meta.color} />
                    </span>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{a.type.replace(/AGENCY_/, '').replace(/_/g, ' ').toLowerCase()}</span>
                        {a.agencyName && <span> · {a.agencyName}</span>}
                        {a.detail && <span className="text-slate-400 italic"> — "{a.detail}"</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{new Date(a.at).toLocaleString()}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function SystemAdminDashboard() {
  const { token } = useAuth()
  const [view, setView]         = useState<View>('PENDING')
  const [allAgencies, setAll]   = useState<Agency[]>([])
  const [actions, setActions]   = useState<AdminAction[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<VerificationDocument | null>(null)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const fetchAgencies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/server/admin/agencies', { headers: authHeaders() })
      if (res.ok) setAll(await res.json())
    } finally { setLoading(false) }
  }, [authHeaders])

  const fetchActions = useCallback(async () => {
    const res = await fetch('/server/admin/actions', { headers: authHeaders() })
    if (res.ok) setActions(await res.json())
  }, [authHeaders])

  useEffect(() => { fetchAgencies() }, [fetchAgencies])
  useEffect(() => { fetchActions() }, [fetchActions])

  const pending  = useMemo(() => allAgencies.filter((a) => a.registrationStatus === 'PENDING'), [allAgencies])
  const approved = useMemo(() => allAgencies.filter((a) => a.registrationStatus === 'APPROVED'), [allAgencies])
  const rejected = useMemo(() => allAgencies.filter((a) => a.registrationStatus === 'REJECTED'), [allAgencies])
  const suspended = useMemo(() => approved.filter((a) => a.subscriptionStatus === 'SUSPENDED'), [approved])

  const byView: Record<View, Agency[]> = { PENDING: pending, APPROVED: approved, SUSPENDED: suspended, REJECTED: rejected }
  const currentList = byView[view]
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return currentList
    return currentList.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.admin?.email.toLowerCase().includes(q) ||
      a.admin?.displayName.toLowerCase().includes(q)
    )
  }, [currentList, search])

  useEffect(() => {
    if (!filteredList.some((a) => a.id === selectedId)) {
      setSelectedId(filteredList[0]?.id ?? null)
    }
  }, [filteredList, selectedId])

  const selectedAgency = filteredList.find((a) => a.id === selectedId) ?? null

  async function approveAgency(id: string) {
    await fetch(`/server/admin/agencies/${id}/approve`, { method: 'PATCH', headers: authHeaders() })
    setSelectedId(null); fetchAgencies(); fetchActions()
  }
  async function rejectAgency(id: string, reason: string) {
    await fetch(`/server/admin/agencies/${id}/reject`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ reason }) })
    setSelectedId(null); fetchAgencies(); fetchActions()
  }
  async function toggleStatus(agency: Agency) {
    const next = agency.subscriptionStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    await fetch(`/server/admin/agencies/${agency.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: next }) })
    fetchAgencies(); fetchActions()
  }

  const emptyLabel = search ? 'No matches found'
    : view === 'PENDING' ? 'No agencies awaiting review'
    : view === 'SUSPENDED' ? 'No suspended agencies'
    : `No ${view.toLowerCase()} agencies`

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: NAVY }}>
          <Building2 size={20} className="text-white" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-800">System Admin</h1>
          <p className="text-sm text-slate-400">Validate agency registrations and monitor subscriptions</p>
        </div>
      </motion.div>

      {/* Stat cards / filters */}
      <motion.div
        initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="flex gap-3"
      >
        {([
          { view: 'PENDING'  as View, label: 'Pending Review', count: pending.length,  tone: 'amber'   as const, Icon: Clock },
          { view: 'APPROVED' as View, label: 'Approved',       count: approved.length, tone: 'emerald' as const, Icon: CheckCircle2 },
          { view: 'SUSPENDED' as View, label: 'Suspended',     count: suspended.length, tone: 'red'    as const, Icon: PauseCircle },
          { view: 'REJECTED' as View, label: 'Rejected',       count: rejected.length, tone: 'slate'   as const, Icon: XCircle },
        ]).map((s) => (
          <motion.div key={s.view} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }} className="flex-1 flex">
            <StatCard label={s.label} count={s.count} tone={s.tone} Icon={s.Icon}
              active={view === s.view} onClick={() => setView(s.view)} />
          </motion.div>
        ))}
      </motion.div>

      {/* Master-detail */}
      <div className="flex gap-4" style={{ minHeight: 460 }}>
        {/* Left */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input-field text-sm py-2 pl-9" placeholder="Search agencies…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading && <p className="text-sm text-slate-400 text-center py-8">Loading…</p>}
            {!loading && filteredList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Inbox size={28} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">{emptyLabel}</p>
              </div>
            )}
            {filteredList.map((agency) => (
              <AgencyRow key={agency.id} agency={agency} selected={agency.id === selectedId}
                onClick={() => setSelectedId(agency.id)} />
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex-1 min-w-0 panel overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedAgency ? (
              <motion.div key={selectedAgency.id} className="h-full"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                <DetailPanel agency={selectedAgency} onApprove={approveAgency} onReject={rejectAgency}
                  onToggleStatus={toggleStatus} onPreviewDocument={setPreviewDoc} />
              </motion.div>
            ) : (
              <motion.div key="empty" className="h-full flex flex-col items-center justify-center text-center px-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Building2 size={32} className="text-slate-300 mb-3" />
                <p className="text-sm text-slate-400">Select an agency to review its details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ActionTimeline actions={actions} />

      <AnimatePresence>
        {previewDoc && selectedAgency && (
          <DocumentPreviewModal agencyId={selectedAgency.id} doc={previewDoc} token={token}
            onClose={() => setPreviewDoc(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
