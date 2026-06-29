import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'

// Auth pages (static imports - needed immediately)
import Login        from './pages/Login'
import Unauthorized from './pages/Unauthorized'
import ForgotPassword from './pages/ForgotPassword'
import ConfirmResetPassword from './pages/ConfirmResetPassword'
import UpdatePassword from './pages/UpdatePassword'
import AuthConfirm from './pages/AuthConfirm'
import AuthCallback from './pages/AuthCallback'

// Portal lazy imports
const CeoPortal        = lazy(() => import('./pages/portals/CeoPortal'))
const AccountantPortal = lazy(() => import('./pages/portals/AccountantPortal'))
const PmPortal         = lazy(() => import('./pages/portals/PmPortal'))
const HrPortal         = lazy(() => import('./pages/portals/HrPortal'))
const EmployeePortal   = lazy(() => import('./pages/portals/EmployeePortal'))
const ClientPortal     = lazy(() => import('./pages/portals/ClientPortal'))

// Management pages lazy imports
const ClientRegistry   = lazy(() => import('./pages/clients/ClientRegistry'))
const ClientDetail     = lazy(() => import('./pages/clients/ClientDetail'))
const SupplierRegistry = lazy(() => import('./pages/suppliers/SupplierRegistry'))
const SupplierDetail   = lazy(() => import('./pages/suppliers/SupplierDetail'))
const RetentionDashboard = lazy(() => import('./pages/retention/RetentionDashboard'))
const RevenueRecognitionDashboard = lazy(() => import('./pages/revenue/RevenueRecognitionDashboard'))
const ProjectRegistry = lazy(() => import('./pages/projects/ProjectRegistry'))
const ChartOfAccounts = lazy(() => import('./pages/accounts/ChartOfAccounts'))
const PaymentsReceived = lazy(() => import('./pages/payments/PaymentsReceived'))

// Loading fallback
function RouteLoadingSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-900">
      <div className="text-center">
        <div className="mb-4 inline-flex h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-white"></div>
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoadingSpinner />}>
            <Routes>

          {/* Public routes */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Password reset flow */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/confirm-reset-password" element={<ConfirmResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />

          {/* CEO portal */}
          <Route path="/ceo" element={
            <ProtectedRoute allowedRoles={['ceo']}>
              <CeoPortal />
            </ProtectedRoute>
          } />

          {/* Accountant portal */}
          <Route path="/accountant" element={
            <ProtectedRoute allowedRoles={['accountant']}>
              <AccountantPortal />
            </ProtectedRoute>
          } />

          {/* Project Manager portal */}
          <Route path="/pm" element={
            <ProtectedRoute allowedRoles={['project_manager']}>
              <PmPortal />
            </ProtectedRoute>
          } />

          {/* HR Manager portal */}
          <Route path="/hr" element={
            <ProtectedRoute allowedRoles={['hr_manager']}>
              <HrPortal />
            </ProtectedRoute>
          } />

          {/* Employee portal */}
          <Route path="/employee" element={
            <ProtectedRoute allowedRoles={['employee']}>
              <EmployeePortal />
            </ProtectedRoute>
          } />

          {/* Client portal */}
          <Route path="/client" element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientPortal />
            </ProtectedRoute>
          } />

          {/* Client management */}
          <Route path="/clients" element={
            <ProtectedRoute allowedRoles={['accountant', 'project_manager', 'ceo']}>
              <ClientRegistry />
            </ProtectedRoute>
          } />
          <Route path="/clients/:id" element={
            <ProtectedRoute allowedRoles={['accountant', 'project_manager', 'ceo']}>
              <ClientDetail />
            </ProtectedRoute>
          } />

          <Route path="/retention" element={
            <ProtectedRoute allowedRoles={['ceo', 'accountant', 'project_manager']}>
              <RetentionDashboard />
            </ProtectedRoute>
          } />

          <Route path="/revenue-recognition" element={
            <ProtectedRoute allowedRoles={['ceo', 'accountant']}>
              <RevenueRecognitionDashboard />
            </ProtectedRoute>
          } />

          <Route path="/projects" element={
            <ProtectedRoute allowedRoles={['ceo', 'accountant', 'project_manager']}>
              <ProjectRegistry />
            </ProtectedRoute>
          } />

          <Route path="/chart-of-accounts" element={
            <ProtectedRoute allowedRoles={['accountant', 'ceo']}>
              <ChartOfAccounts />
            </ProtectedRoute>
          } />

          <Route path="/payments-received" element={
            <ProtectedRoute allowedRoles={['accountant', 'ceo']}>
              <PaymentsReceived />
            </ProtectedRoute>
          } />

          {/* Supplier management */}
          <Route path="/suppliers" element={
            <ProtectedRoute allowedRoles={['accountant', 'project_manager', 'ceo']}>
              <SupplierRegistry />
            </ProtectedRoute>
          } />
          <Route path="/suppliers/:id" element={
            <ProtectedRoute allowedRoles={['accountant', 'project_manager', 'ceo']}>
              <SupplierDetail />
            </ProtectedRoute>
          } />

          {/* Catch-all — redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />

            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
