import type { LucideIcon } from 'lucide-react'

/** Tutarlı ikon sarmalayıcı: renk `currentColor`, stroke ve boyut standardı.
 *  Kullanım: <Icon of={Bell} size={18} /> — dekoratifse aria-hidden zaten set. */
export function Icon({
  of: Component,
  size = 18,
  className,
  label,
}: {
  of: LucideIcon
  size?: number
  className?: string
  label?: string
}) {
  return (
    <Component
      size={size}
      strokeWidth={1.75}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
