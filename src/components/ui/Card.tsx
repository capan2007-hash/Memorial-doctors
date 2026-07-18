import type { ReactNode } from 'react'

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`bg-surface-card rounded-xl shadow-card p-4 md:p-5 ${className}`}>
      {title && <h3 className="font-display text-base text-slate-900 mb-3">{title}</h3>}
      {children}
    </div>
  )
}
