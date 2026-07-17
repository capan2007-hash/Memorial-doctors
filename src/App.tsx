import type { ReactElement } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './features/auth/LoginPage'

function Home() {
  const { role } = useAuth()
  return <div className="p-4">Giriş yapıldı. Rol: {role}</div>
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
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
