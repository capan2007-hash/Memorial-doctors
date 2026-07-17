import type { ReactElement } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './features/auth/LoginPage'
import { Layout } from './components/Layout'
import { RoleGate } from './components/RoleGate'
import { NewRequestWizard } from './features/requests/NewRequestWizard'
import { DoctorQueue } from './features/doctor/DoctorQueue'
import { DoctorRequestView } from './features/doctor/DoctorRequestView'
import { RequestList } from './features/requests/RequestList'
import { RequestDetail } from './features/requests/RequestDetail'

function Home() {
  const { role } = useAuth()
  if (role === 'doctor') return <Navigate to="/doctor" replace />
  return <Navigate to="/requests" replace />
}

function Protected({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-4">Yükleniyor…</div>
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Protected><Home /></Protected>} />
            <Route path="/requests/new" element={<Protected><Layout><RoleGate allow={['agent','sales']}><NewRequestWizard /></RoleGate></Layout></Protected>} />
            <Route path="/doctor" element={<Protected><Layout><RoleGate allow={['doctor']}><DoctorQueue /></RoleGate></Layout></Protected>} />
            <Route path="/doctor/request/:id" element={<Protected><Layout><RoleGate allow={['doctor']}><DoctorRequestView /></RoleGate></Layout></Protected>} />
            <Route path="/requests" element={<Protected><Layout><RequestList /></Layout></Protected>} />
            <Route path="/requests/:id" element={<Protected><Layout><RequestDetail /></Layout></Protected>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
