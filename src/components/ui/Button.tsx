import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand-fill hover:bg-brand-fill-hover text-brand-on',
  secondary:
    'bg-surface-2 border border-line text-ink-primary hover:border-line-strong',
  danger: 'bg-danger-bg border border-danger-border text-danger-text',
  ghost: 'text-ink-secondary hover:bg-surface-2',
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: {
  variant?: Variant
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-medium disabled:opacity-40 transition ease-premium duration-[var(--dur-fast)] active:scale-[0.98] ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
