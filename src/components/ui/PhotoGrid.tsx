import { useEffect, useState } from 'react'
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
    return emptyText ? <p className="text-sm text-slate-500">{emptyText}</p> : null
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {urls.map((url) => (
          <button key={url} type="button" onClick={() => setSelected(url)}>
            <img src={url} alt={alt} className="aspect-square w-full object-cover rounded-lg border" />
          </button>
        ))}
        {deletedPhotos.map((p) => (
          <div
            key={p.id}
            className="aspect-square w-full rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center p-2"
          >
            <p className="text-xs text-slate-500 text-center">
              Fotoğraf KVKK gereği imha edildi ({formatDate(p.deletedAt)})
            </p>
          </div>
        ))}
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <img src={selected} alt={alt} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  )
}
