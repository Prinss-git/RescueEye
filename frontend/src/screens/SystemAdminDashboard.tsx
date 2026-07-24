import { useState, useEffect, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

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

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED'

const SUB_STATUS_STYLE: Record<string, string> = {
  ACTIVE:    'text-green-700 border-green-200 bg-green-50',
  SUSPENDED: 'text-alert border-red-200 bg-red-50',
}

function PendingRow({ agency, onApprove, onReject, onDownloadDocument }: {
  agency: Agency
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reason: string) => Promise<void>
  onDownloadDocument: (agencyId: string, doc: VerificationDocument) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason]       = useState('')
  const [busy, setBusy]           = useState(false)

  async function submitReject() {
    setBusy(true)
    try { await onReject(agency.id, reason) } finally { setBusy(false); setRejecting(false); setReason('') }
  }

  async function submitApprove() {
    setBusy(true)
    try { await onApprove(agency.id) } finally { setBusy(false) }
  }

  return (
    <div className="p-3 rounded-md border border-slate-200 bg-surface-alt space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-800 truncate">{agency.name}</span>
          <p className="text-xs text-slate-400 truncate">
            {agency.admin ? `${agency.admin.displayName} · ${agency.admin.email}` : 'No admin'}
            {' · submitted '}{new Date(agency.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={submitApprove} className="btn-primary text-xs" disabled={busy}>
            Approve
          </button>
          <button onClick={() => setRejecting((r) => !r)} className="btn-ghost text-xs text-alert" disabled={busy}>
            {rejecting ? 'Cancel' : 'Reject'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {agency.verificationDocuments.length === 0 && (
          <span className="text-xs text-alert">No verification documents submitted</span>
        )}
        {agency.verificationDocuments.map((doc) => (
          <button
            key={doc.storedName}
            onClick={() => onDownloadDocument(agency.id, doc)}
            className="badge border-slate-200 text-slate-600 gap-1.5 hover:border-accent hover:text-accent"
            title={`Download ${doc.fileName}`}
          >
            <FileText size={12} />
            {doc.fileName}
          </button>
        ))}
      </div>

      {rejecting && (
        <div className="flex gap-2">
          <input className="input-field text-xs py-1" placeholder="Reason for rejection"
            value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          <button onClick={submitReject} className="btn-primary text-xs flex-shrink-0" disabled={busy || !reason.trim()}>
            {busy ? 'Saving…' : 'Confirm Reject'}
          </button>
        </div>
      )}
    </div>
  )
}

function ApprovedRow({ agency, onToggleStatus }: {
  agency: Agency
  onToggleStatus: (agency: Agency) => void
}) {
  return (
    <div className="p-3 rounded-md border border-slate-200 bg-surface-alt flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 truncate">{agency.name}</span>
          <span className={`badge ${SUB_STATUS_STYLE[agency.subscriptionStatus] ?? ''}`}>
            {agency.subscriptionStatus}
          </span>
        </div>
        <p className="text-xs text-slate-400 truncate">
          {agency.admin ? `${agency.admin.displayName} · ${agency.admin.email}` : 'No admin'}
          {' · '}{agency.userCount} user{agency.userCount === 1 ? '' : 's'}
        </p>
      </div>
      <button onClick={() => onToggleStatus(agency)} className="btn-ghost text-xs flex-shrink-0">
        {agency.subscriptionStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
      </button>
    </div>
  )
}

function RejectedRow({ agency }: { agency: Agency }) {
  return (
    <div className="p-3 rounded-md border border-slate-200 bg-surface-alt">
      <span className="text-sm font-semibold text-slate-800">{agency.name}</span>
      <p className="text-xs text-slate-400">
        {agency.admin?.email ?? '—'} · rejected {new Date(agency.createdAt).toLocaleDateString()}
      </p>
      {agency.rejectionReason && (
        <p className="text-xs text-slate-500 mt-1 italic">"{agency.rejectionReason}"</p>
      )}
    </div>
  )
}

function ActionLog({ actions }: { actions: AdminAction[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">Recent Actions</div>
      <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
        {actions.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">— no actions yet —</p>
        )}
        {actions.map((a) => (
          <div key={a.id} className="text-xs text-slate-500 flex items-center justify-between gap-4">
            <span>
              <span className="font-medium text-slate-700">{a.type.replace(/_/g, ' ')}</span>
              {a.agencyName && <span> · {a.agencyName}</span>}
              {a.detail && <span className="italic"> — "{a.detail}"</span>}
            </span>
            <span className="text-slate-400 flex-shrink-0">{new Date(a.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SystemAdminDashboard() {
  const { token } = useAuth()
  const [tab, setTab]         = useState<Tab>('PENDING')
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [actions, setActions] = useState<AdminAction[]>([])
  const [loading, setLoading] = useState(true)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const fetchAgencies = useCallback(async (status: Tab) => {
    setLoading(true)
    try {
      const res = await fetch(`/server/admin/agencies?status=${status}`, { headers: authHeaders() })
      if (res.ok) setAgencies(await res.json())
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const fetchActions = useCallback(async () => {
    const res = await fetch('/server/admin/actions', { headers: authHeaders() })
    if (res.ok) setActions(await res.json())
  }, [authHeaders])

  useEffect(() => { fetchAgencies(tab) }, [tab, fetchAgencies])
  useEffect(() => { fetchActions() }, [fetchActions])

  async function approveAgency(id: string) {
    await fetch(`/server/admin/agencies/${id}/approve`, { method: 'PATCH', headers: authHeaders() })
    fetchAgencies(tab); fetchActions()
  }

  async function rejectAgency(id: string, reason: string) {
    await fetch(`/server/admin/agencies/${id}/reject`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ reason }),
    })
    fetchAgencies(tab); fetchActions()
  }

  async function toggleStatus(agency: Agency) {
    const next = agency.subscriptionStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    await fetch(`/server/admin/agencies/${agency.id}/status`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: next }),
    })
    fetchAgencies(tab); fetchActions()
  }

  // Document downloads require the Bearer token, so a plain <a href> can't
  // carry auth — fetch as a blob and trigger the save manually instead.
  async function downloadDocument(agencyId: string, doc: VerificationDocument) {
    const res = await fetch(`/server/admin/agencies/${agencyId}/documents/${doc.storedName}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'PENDING',  label: 'Pending Review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
  ]

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">System Admin</h1>
        <p className="text-sm text-slate-400 mt-1">Validate agency registrations and monitor subscription status</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">
          {TABS.find((t) => t.key === tab)?.label} ({agencies.length})
        </div>
        <div className="p-3 space-y-2">
          {loading && <p className="text-sm text-slate-400 text-center py-6">Loading…</p>}
          {!loading && agencies.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              {tab === 'PENDING' ? '— no agencies awaiting review —' : `— no ${tab.toLowerCase()} agencies —`}
            </p>
          )}
          {!loading && tab === 'PENDING' && agencies.map((agency) => (
            <PendingRow key={agency.id} agency={agency} onApprove={approveAgency} onReject={rejectAgency}
              onDownloadDocument={downloadDocument} />
          ))}
          {!loading && tab === 'APPROVED' && agencies.map((agency) => (
            <ApprovedRow key={agency.id} agency={agency} onToggleStatus={toggleStatus} />
          ))}
          {!loading && tab === 'REJECTED' && agencies.map((agency) => (
            <RejectedRow key={agency.id} agency={agency} />
          ))}
        </div>
      </div>

      <ActionLog actions={actions} />
    </div>
  )
}
