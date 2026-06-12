import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import PageTransition from './components/PageTransition'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import DamageMap from './screens/DamageMap'
import CoordinationPanel from './screens/CoordinationPanel'
import EvaluationReport from './screens/EvaluationReport'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard"    element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/map"          element={<PageTransition><DamageMap /></PageTransition>} />
          <Route path="/coordination" element={<PageTransition><CoordinationPanel /></PageTransition>} />
          <Route path="/evaluation"   element={<PageTransition><EvaluationReport /></PageTransition>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
