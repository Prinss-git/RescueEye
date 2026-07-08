import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute, { getHomeRoute } from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import PageTransition from './components/PageTransition'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import DamageMap from './screens/DamageMap'
import CoordinationPanel from './screens/CoordinationPanel'
import EvaluationReport from './screens/EvaluationReport'
import SystemAdminDashboard from './screens/SystemAdminDashboard'
import AgencyAdminDashboard from './screens/AgencyAdminDashboard'

const OPERATIONAL_ROLES = ['incident_commander', 'drone_operator', 'coordinator', 'sar_responder', 'ems_responder']

function DefaultRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? getHomeRoute(user.role) : '/login'} replace />
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />

        <Route element={<ProtectedRoute allowedRoles={OPERATIONAL_ROLES} />}>
          <Route path="/dashboard"    element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/map"          element={<PageTransition><DamageMap /></PageTransition>} />
          <Route path="/coordination" element={<PageTransition><CoordinationPanel /></PageTransition>} />
          <Route path="/evaluation"   element={<PageTransition><EvaluationReport /></PageTransition>} />
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
