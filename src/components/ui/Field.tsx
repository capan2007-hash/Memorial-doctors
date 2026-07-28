import type { ReactNode } from 'react'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm text-ink-secondary">{label}</span>
      {children}
      {error ? (
        <p className="text-sm text-danger-text">{error}</p>
      ) : hint ? (
        <p className="text-sm text-ink-muted">{hint}</p>
      ) : null}
    </label>
  )
}
