import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute, { getHomeRoute } from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import PageTransition from './components/PageTransition'
import Landing from './screens/Landing'
import Login from './screens/Login'
import Register from './screens/Register'
import Dashboard from './screens/Dashboard'
import DamageMap from './screens/DamageMap'
import IncidentConsole from './screens/IncidentConsole'
import Responders from './screens/Responders'
import IncidentHistory from './screens/IncidentHistory'
import SystemAdminDashboard from './screens/SystemAdminDashboard'
import AgencyAdminDashboard from './screens/AgencyAdminDashboard'

const OPERATIONAL_ROLES = ['command_staff']

function DefaultRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? getHomeRoute(user.role) : '/'} replace />
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"         element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/login"    element={<PageTransition><Login /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />

        <Route element={<ProtectedRoute allowedRoles={OPERATIONAL_ROLES} />}>
          <Route path="/dashboard"  element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/map"        element={<PageTransition><DamageMap /></PageTransition>} />
          <Route path="/incidents"  element={<PageTransition><IncidentConsole /></PageTransition>} />
          <Route path="/responders" element={<PageTransition><Responders /></PageTransition>} />
          <Route path="/history"    element={<PageTransition><IncidentHistory /></PageTransition>} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['system_admin']} />}>
          <Route path="/admin" element={<PageTransition><SystemAdminDashboard /></PageTransition>} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['agency_admin']} />}>
          <Route path="/agency-admin" element={<PageTransition><AgencyAdminDashboard /></PageTransition>} />
        </Route>

        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}
