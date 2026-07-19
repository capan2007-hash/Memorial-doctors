import type { ReactNode } from 'react'

export function Card({
  title,
  children,
  className = '',
  hover = false,
}: {
  title?: string
  children: ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div
      className={`bg-surface-2 border border-line rounded-card shadow-card p-4 md:p-5 ${
        hover
          ? 'transition ease-premium duration-[var(--dur-base)] hover:shadow-pop hover:-translate-y-px'
          : ''
      } ${className}`}
    >
      {title && (
        <h3 className="font-display text-base text-ink-primary border-b border-line pb-2 mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
