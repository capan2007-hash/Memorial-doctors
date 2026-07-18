import { useEffect, useState } from 'react'

export function PhotoGrid({
  urls,
  title,
  emptyText,
}: {
  urls: string[]
  title?: string
  emptyText?: string
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

  if (urls.length === 0) {
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
