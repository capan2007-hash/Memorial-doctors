import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

type ToastKind = 'success' | 'error'

type ToastItem = {
  id: number
  message: string
  kind: ToastKind
}

type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 4000

const KIND_CLASSES: Record<ToastKind, string> = {
  success: 'bg-surface-3 border border-line text-ink-primary',
  error: 'bg-danger-bg border border-danger-border text-danger-text',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Unmount'ta bekleyen zamanlayıcıları temizle (setState-after-unmount önlenir)
  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach(clearTimeout); pending.clear() }
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, kind }])
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
    timers.current.add(timer)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 end-4 z-50 space-y-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-card px-4 py-3 text-sm shadow-pop ${KIND_CLASSES[toast.kind]}`}
          >
            <Icon of={toast.kind === 'error' ? AlertTriangle : Check} size={16} />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              aria-label={t('actions.close')}
              onClick={() => dismiss(toast.id)}
              className="text-ink-muted hover:text-ink-primary transition ease-premium duration-[var(--dur-fast)]"
            >
              <Icon of={X} size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast, ToastProvider içinde kullanılmalıdır')
  }
  return ctx
}
