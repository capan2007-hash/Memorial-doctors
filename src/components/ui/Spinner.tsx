export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      data-testid="spinner"
      role="status"
      aria-label="Yükleniyor"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}
