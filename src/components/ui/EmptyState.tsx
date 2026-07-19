import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { Icon } from './Icon'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <Icon of={Inbox} size={28} className="text-ink-muted" />
      <p className="mt-3 font-display text-ink-primary">{title}</p>
      {description && <p className="mt-1 text-ink-secondary text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
