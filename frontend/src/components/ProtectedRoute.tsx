import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export function getHomeRoute(role?: string) {
  if (role === 'system_admin') return '/admin'
  if (role === 'agency_admin') return '/agency-admin'
  return '/dashboard'
}

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomeRoute(user.role)} replace />
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
