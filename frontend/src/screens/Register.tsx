import { useState, FormEvent, ChangeEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CheckCircle2, FileText, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getHomeRoute } from '../components/ProtectedRoute'

export default function Register() {
  const { user } = useAuth()
  const [agencyName, setAgencyName]       = useState('')
  const [adminName, setAdminName]         = useState('')
  const [adminEmail, setAdminEmail]       = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [documents, setDocuments]         = useState<File[]>([])
  const [error, setError]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [submitted, setSubmitted]         = useState(false)

  if (user) return <Navigate to={getHomeRoute(user.role)} replace />

  function handleFilesChosen(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    setDocuments((prev) => [...prev, ...chosen].slice(0, 5))
    e.target.value = ''
  }

  function removeDocument(index: number) {
    setDocuments((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!agencyName || !adminName || !adminEmail || !adminPassword) {
      setError('All fields are required.')
      return
    }
    if (documents.length === 0) {
      setError('At least one verification document (e.g. accreditation certificate, government ID) is required.')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('agencyName', agencyName)
      formData.append('adminName', adminName)
      formData.append('adminEmail', adminEmail)
      formData.append('adminPassword', adminPassword)
      documents.forEach((file) => formData.append('documents', file))

      const res = await fetch('/server/auth/register-agency', {
        method: 'POST',
        body:   formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Registration failed')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center panel p-8">
          <CheckCircle2 size={40} className="mx-auto text-green-600 mb-4" />
          <h1 className="font-semibold text-slate-800 text-lg">Registration submitted</h1>
          <p className="text-sm text-slate-500 mt-2">
            A RescueEye System Admin will review <strong>{agencyName}</strong> and your submitted
            documents shortly. You'll be able to log in once your agency is approved.
          </p>
          <Link to="/login" className="btn-primary inline-flex items-center justify-center mt-6 px-6 py-2">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-semibold text-slate-800 tracking-tight text-xl">Register Your Agency</h1>
          <p className="text-slate-500 text-sm mt-1">Get your organization onto RescueEye</p>
        </div>

        <form onSubmit={handleSubmit} className="panel p-8 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Agency Name</label>
            <input className="input-field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)}
              placeholder="CDRRMO Cebu" disabled={submitting} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Your Name</label>
            <input className="input-field" value={adminName} onChange={(e) => setAdminName(e.target.value)}
              placeholder="Juan Dela Cruz" disabled={submitting} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Your Email</label>
            <input className="input-field" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@agency.ph" autoComplete="username" disabled={submitting} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Password</label>
            <input className="input-field" type="password" value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)} autoComplete="new-password" disabled={submitting} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Verification Documents
            </label>
            <p className="text-xs text-slate-400 mb-2">
              SEC/DTI registration, LGU accreditation, or a valid government ID — up to 5 files.
              A System Admin reviews these before approving your agency.
            </p>
            <label className={`flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-md py-3 text-xs text-slate-500 cursor-pointer hover:border-accent hover:text-accent transition-colors ${submitting ? 'pointer-events-none opacity-60' : ''}`}>
              <FileText size={14} />
              Choose files
              <input type="file" className="hidden" multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFilesChosen} disabled={submitting} />
            </label>

            {documents.length > 0 && (
              <ul className="mt-2 space-y-1">
                {documents.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-surface-alt rounded px-2 py-1">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => removeDocument(i)} className="text-slate-400 hover:text-alert flex-shrink-0">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="text-alert text-xs border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full mt-2" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for Review'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-6">
          Already registered? <Link to="/login" className="text-accent hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
