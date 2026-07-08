import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

interface Agency {
  id: string
  name: string
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED' | string
  createdAt: string
  admin: { displayName: string; email: string } | null
  userCount: number
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:    'text-green-700 border-green-200 bg-green-50',
  SUSPENDED: 'text-alert border-red-200 bg-red-50',
}

export default function SystemAdminDashboard() {
  const { token } = useAuth()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [agencyName, setAgencyName]     = useState('')
  const [subStatus, setSubStatus]       = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [adminName, setAdminName]       = useState('')
  const [adminEmail, setAdminEmail]     = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError]               = useState('')
  const [submitting, setSubmitting]     = useState(false)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const fetchAgencies = useCallback(async () => {
    try {
      const res = await fetch('/server/admin/agencies', { headers: authHeaders() })
      if (res.ok) setAgencies(await res.json())
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { fetchAgencies() }, [fetchAgencies])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!agencyName || !adminName || !adminEmail || !adminPassword) {
      setError('All fields are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/server/admin/agencies', {
        method:  'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          agencyName, subscriptionStatus: subStatus,
          adminName, adminEmail, adminPassword,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create agency')
      }
      setAgencyName(''); setAdminName(''); setAdminEmail(''); setAdminPassword('')
      setSubStatus('ACTIVE'); setShowForm(false)
      fetchAgencies()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agency')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(agency: Agency) {
    const next = agency.subscriptionStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    await fetch(`/server/admin/agencies/${agency.id}/status`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ status: next }),
    })
    fetchAgencies()
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">System Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Manage subscribing agencies and their administrators</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Add Agency'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">New Agency</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agency Name</label>
              <input className="input-field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)}
                placeholder="CDRRMO Cebu" disabled={submitting} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subscription</label>
              <select className="input-field" value={subStatus}
                onChange={(e) => setSubStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')} disabled={submitting}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Name</label>
              <input className="input-field" value={adminName} onChange={(e) => setAdminName(e.target.value)}
                placeholder="Juan Dela Cruz" disabled={submitting} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Email</label>
              <input className="input-field" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@agency.ph" disabled={submitting} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Password</label>
              <input className="input-field" type="password" value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)} disabled={submitting} />
            </div>
          </div>

          {error && (
            <p className="text-alert text-xs border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Agency + Admin'}
          </button>
        </form>
      )}

      <div className="panel overflow-hidden">
        <div className="panel-header">Agencies ({agencies.length})</div>
        <div className="p-3 space-y-2">
          {loading && <p className="text-sm text-slate-400 text-center py-6">Loading…</p>}
          {!loading && agencies.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">— no agencies yet —</p>
          )}
          {agencies.map((agency) => (
            <div key={agency.id} className="p-3 rounded-md border border-slate-200 bg-surface-alt flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">{agency.name}</span>
                  <span className={`badge ${STATUS_STYLE[agency.subscriptionStatus] ?? ''}`}>
                    {agency.subscriptionStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {agency.admin ? `${agency.admin.displayName} · ${agency.admin.email}` : 'No admin'}
                  {' · '}{agency.userCount} user{agency.userCount === 1 ? '' : 's'}
                </p>
              </div>
              <button onClick={() => toggleStatus(agency)} className="btn-ghost text-xs flex-shrink-0">
                {agency.subscriptionStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
