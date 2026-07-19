import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
      <div>
        <h2 className="font-display text-2xl text-ink-primary">{title}</h2>
        {subtitle && <p className="text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
