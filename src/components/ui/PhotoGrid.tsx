import { useEffect, useState } from 'react'
import { ImageOff, X } from 'lucide-react'
import { Icon } from './Icon'
import { formatDate } from '../../lib/format'

export interface DeletedPhotoTile {
  id: string
  deletedAt: string
}

export function PhotoGrid({
  urls,
  title,
  emptyText,
  deletedPhotos = [],
}: {
  urls: string[]
  title?: string
  emptyText?: string
  /** İmha edilmiş fotoğraflar (deleted_at dolu) — görsel yerine soluk KVKK notu render edilir. */
  deletedPhotos?: DeletedPhotoTile[]
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const alt = title ?? 'Fotoğraf'

  useEffect(() => {
    if (!selected) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selected])

  if (urls.length === 0 && deletedPhotos.length === 0) {
    return emptyText ? <p className="text-sm text-ink-muted">{emptyText}</p> : null
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setSelected(url)}
            className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/30"
          >
            <img src={url} alt={alt} loading="lazy" className="aspect-square w-full object-cover rounded-control border border-line" />
          </button>
        ))}
        {deletedPhotos.map((p) => (
          <div
            key={p.id}
            className="aspect-square w-full rounded-control border border-line bg-surface-2 flex flex-col items-center justify-center gap-1 p-2 text-ink-muted"
          >
            <Icon of={ImageOff} size={20} />
            <p className="text-xs text-center">
              Fotoğraf KVKK gereği imha edildi (<span className="tnum">{formatDate(p.deletedAt)}</span>)
            </p>
          </div>
        ))}
      </div>
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            aria-label="Kapat"
            className="absolute top-4 right-4 text-white/90 hover:text-white rounded-control p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            onClick={() => setSelected(null)}
          >
            <Icon of={X} size={24} />
          </button>
          <img src={selected} alt={alt} className="max-h-full max-w-full rounded-card" />
        </div>
      )}
    </>
  )
}
