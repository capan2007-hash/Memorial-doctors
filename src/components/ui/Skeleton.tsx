/** Yeniden kullanılabilir yükleme bloğu (skeleton). animate-pulse,
 *  reduced-motion tercihine saygı duyar (tarayıcı native davranışı). */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-2 rounded-control animate-pulse ${className}`}
    />
  )
}
