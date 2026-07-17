import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { RequestRow, PhotoRow } from '../../types/db'

export function DoctorRequestView() {
  const { id } = useParams()
  const { appUser } = useAuth()
  const q = useQuery({ queryKey: ['doctor-request', id], enabled: !!id, queryFn: async () => {
    const { data: req } = await supabase.from('request').select('*').eq('id', id!).single()
    const { data: photos } = await supabase.from('photo').select('*').eq('request_id', id!)
    const signed = await Promise.all(((photos ?? []) as PhotoRow[]).map(async (p) => {
      const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 300)
      return data?.signedUrl
    }))
    return { req: req as RequestRow, photos: signed.filter(Boolean) as string[] }
  }})

  useEffect(() => {
    // seen_at yaz (görüldü)
    (async () => {
      const { data: doc } = await supabase.from('doctor').select('id').eq('app_user_id', appUser!.id).single()
      if (doc?.id && id) {
        await supabase.from('assignment').update({ seen_at: new Date().toISOString() })
          .eq('request_id', id).eq('doctor_id', doc.id).is('seen_at', null)
      }
    })()
  }, [id, appUser])

  if (!q.data) return <p>Yükleniyor…</p>
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Talep #{q.data.req.id.slice(0, 8)}</h2>
      <p className="text-sm text-slate-600">{q.data.req.notes}</p>
      <div className="grid grid-cols-2 gap-2">
        {q.data.photos.map((url, i) => <img key={i} src={url} className="rounded border" />)}
      </div>
      {/* Yanıt aksiyonları Task 11 */}
    </div>
  )
}
