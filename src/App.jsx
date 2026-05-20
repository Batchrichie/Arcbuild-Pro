import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import Login        from './pages/Login'
import Unauthorized from './pages/Unauthorized'
import ClientRegistry   from './pages/clients/ClientRegistry'
import ClientDetail     from './pages/clients/ClientDetail'
import SupplierRegistry from './pages/suppliers/SupplierRegistry'
import SupplierDetail   from './pages/suppliers/SupplierDetail'
import RetentionDashboard from './pages/retention/RetentionDashboard'
import RevenueRecognitionDashboard from './pages/revenue/RevenueRecognitionDashboard'

// Portal placeholders (Phase 4 will replace these)
import CeoPortal        from './pages/portals/CeoPortal'
import AccountantPortal from './pages/portals/AccountantPortal'
import PmPortal         from './pages/portals/PmPortal'
import HrPortal         from './pages/portals/HrPortal'
import EmployeePortal   from './pages/portals/EmployeePortal'
import ClientPortal     from './pages/portals/ClientPortal'

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>

          {/* Public routes */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

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
      </BrowserRouter>
    </ThemeProvider>
  </AuthProvider>
  )
}
