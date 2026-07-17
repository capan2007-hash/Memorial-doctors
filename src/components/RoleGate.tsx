import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import type { Role } from '../types/domain'

export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useAuth()
  if (!role || !allow.includes(role)) return null
  return <>{children}</>
}
