import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { Button as ShadButton } from '@/components/shadcn/button'

// Mevcut API (primary/secondary/danger/ghost + loading) korunur; altta shadcn
// button render edilir (birleşik teal tema, tutarlı odak/hover). Böylece tüm
// ekranlardaki <Button> kullanımı tek noktadan shadcn'e yükselir.
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANT_MAP: Record<Variant, 'default' | 'secondary' | 'destructive' | 'ghost'> = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: {
  variant?: Variant
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <ShadButton variant={VARIANT_MAP[variant]} disabled={disabled || loading} className={className} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </ShadButton>
  )
}
