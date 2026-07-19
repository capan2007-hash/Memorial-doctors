// Kaynak: /src/features/requests/useRequests.ts useRequestDetail (web) — request +
// patient + category/subcategory/operation_type adları + fotoğraf imzalı URL'ler
// aynı Promise.all deseniyle mirror edilir. Yanıt: RLS gereği doktor yalnız kendi
// response satırını görür (bkz. migration 0002 resp_doctor_read) — bu yüzden
// responses[0] doğrudan "benim yanıtım" anlamına gelir.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { resolvePhotoUrls } from './photoUrl'
import type { PhotoRow, RequestRow, ResponseRow } from '@/types/db'

export interface RequestDetail {
  req: RequestRow
  patientName: string
  categoryName?: string
  subcategoryName: string | null
  operationName: string | null
  photos: string[]
  xrays: string[]
  myResponse: ResponseRow | null
}

export function useRequestDetail(id?: string) {
  return useQuery({
    queryKey: ['request-detail', id],
    enabled: !!id,
    queryFn: async (): Promise<RequestDetail> => {
      const { data: reqData, error: reqErr } = await supabase.from('request').select('*').eq('id', id!).single()
      if (reqErr) throw reqErr
      const req = reqData as RequestRow

      const [{ data: responses }, { data: patient }, { data: category }, { data: subcategory }, { data: operationType }, { data: photoRows }] =
        await Promise.all([
          supabase.from('response').select('*').eq('request_id', id!),
          supabase.from('patient').select('first_name, last_name').eq('id', req.patient_id).single(),
          supabase.from('category').select('name').eq('id', req.category_id).single(),
          req.subcategory_id
            ? supabase.from('subcategory').select('name').eq('id', req.subcategory_id).single()
            : Promise.resolve({ data: null }),
          req.operation_type_id
            ? supabase.from('operation_type').select('name').eq('id', req.operation_type_id).single()
            : Promise.resolve({ data: null }),
          supabase.from('photo').select('*').eq('request_id', id!),
        ])

      const allPhotos = (photoRows ?? []) as PhotoRow[]
      const [photos, xrays] = await Promise.all([
        resolvePhotoUrls(allPhotos.filter((p) => p.kind === 'photo' && !p.deleted_at)),
        resolvePhotoUrls(allPhotos.filter((p) => p.kind === 'xray' && !p.deleted_at)),
      ])
      const responseRows = (responses ?? []) as ResponseRow[]

      return {
        req,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
        categoryName: (category as { name?: string } | null)?.name,
        subcategoryName: (subcategory as { name?: string } | null)?.name ?? null,
        operationName: (operationType as { name?: string } | null)?.name ?? null,
        photos,
        xrays,
        myResponse: responseRows[0] ?? null,
      }
    },
  })
}
