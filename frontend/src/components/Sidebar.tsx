import { NavLink } from 'react-router-dom'
import { Video, Map as MapIcon, Users, BarChart3, Building2, UserCog } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const OPERATIONAL_LINKS = [
  { to: '/dashboard',    label: 'Live Feed',    icon: Video },
  { to: '/map',          label: 'Damage Map',   icon: MapIcon },
  { to: '/coordination', label: 'Coordination', icon: Users },
  { to: '/evaluation',   label: 'Evaluation',   icon: BarChart3 },
]

const SYSTEM_ADMIN_LINKS = [
  { to: '/admin', label: 'Agencies', icon: Building2 },
]

const AGENCY_ADMIN_LINKS = [
  { to: '/agency-admin', label: 'Users', icon: UserCog },
]

export default function Sidebar() {
  const { user } = useAuth()

  const links =
    user?.role === 'system_admin' ? SYSTEM_ADMIN_LINKS :
    user?.role === 'agency_admin' ? AGENCY_ADMIN_LINKS :
    OPERATIONAL_LINKS

  return (
    <aside className="w-56 flex-shrink-0 bg-surface border-r border-slate-200 flex flex-col py-4">
      <nav className="flex flex-col gap-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-tint text-accent'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
