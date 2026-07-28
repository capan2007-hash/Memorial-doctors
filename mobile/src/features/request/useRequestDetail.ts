// Kaynak: /src/features/requests/useRequests.ts useRequestDetail (web) — request +
// patient + category/subcategory/operation_type adları + fotoğraf imzalı URL'ler
// aynı Promise.all deseniyle mirror edilir. Yanıt: RLS gereği doktor yalnız kendi
// response satırını görür (bkz. migration 0002 resp_doctor_read) — bu yüzden
// responses[0] doğrudan "benim yanıtım" anlamına gelir.
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabase } from '@/lib/supabase'
import { resolvePhotoUrls } from './photoUrl'
import { catalogName } from '@/features/catalog/catalogName'
import type { PhotoRow, RequestRow, ResponseRow } from '@/types/db'

export interface RequestDetail {
  req: RequestRow
  patientName: string
  categoryName?: string
  subcategoryName: string | null
  operationName: string | null
  /** Katalog v2: talepte seçili tüm işlemler (çoklu alt kategori). Eski taleplerde boş. */
  procedureNames: string[]
  photos: string[]
  xrays: string[]
  myResponse: ResponseRow | null
  // Koordinatör/admin görünümü: TÜM doktor yanıtları (RLS resp_sales_admin_read).
  // Doktorun kendi ekranında (request/[id]) RLS yalnız kendi satırını verir → tek eleman.
  responses: ResponseRow[]
}

export function useRequestDetail(id?: string) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['request-detail', id, i18n.language],
    enabled: !!id,
    queryFn: async (): Promise<RequestDetail> => {
      const { data: reqData, error: reqErr } = await supabase.from('request').select('*').eq('id', id!).single()
      if (reqErr) throw reqErr
      const req = reqData as RequestRow

      const [{ data: responses }, { data: patient }, { data: category }, { data: subcategory }, { data: operationType }, { data: photoRows }] =
        await Promise.all([
          supabase.from('response').select('*').eq('request_id', id!),
          supabase.from('patient').select('first_name, last_name').eq('id', req.patient_id).single(),
          supabase.from('category').select('name, name_i18n').eq('id', req.category_id).single(),
          req.subcategory_id
            ? supabase.from('subcategory').select('name, name_i18n').eq('id', req.subcategory_id).single()
            : Promise.resolve({ data: null }),
          req.operation_type_id
            ? supabase.from('operation_type').select('name, name_i18n').eq('id', req.operation_type_id).single()
            : Promise.resolve({ data: null }),
          supabase.from('photo').select('*').eq('request_id', id!),
        ])

      // Çoklu işlem seçimi (katalog v2) — web useRequestDetail ile aynı sorgu.
      const { data: procRows } = await supabase
        .from('request_subcategory')
        .select('sort_order, subcategory:subcategory_id(name, name_i18n)')
        .eq('request_id', id!)
        .order('sort_order')
      const procedureNames = ((procRows ?? []) as unknown as {
        subcategory: { name: string; name_i18n?: Record<string, string> | null } | null
      }[])
        .map((r) => (r.subcategory ? catalogName(r.subcategory, i18n.language) : null))
        .filter((n): n is string => !!n)

      const allPhotos = (photoRows ?? []) as PhotoRow[]
      const [photos, xrays] = await Promise.all([
        resolvePhotoUrls(allPhotos.filter((p) => p.kind === 'photo' && !p.deleted_at)),
        resolvePhotoUrls(allPhotos.filter((p) => p.kind === 'xray' && !p.deleted_at)),
      ])
      const responseRows = (responses ?? []) as ResponseRow[]

      return {
        req,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
        categoryName: category ? catalogName(category as { name: string; name_i18n?: Record<string, string> | null }, i18n.language) : undefined,
        subcategoryName: subcategory
          ? catalogName(subcategory as { name: string; name_i18n?: Record<string, string> | null }, i18n.language)
          : null,
        operationName: operationType
          ? catalogName(operationType as { name: string; name_i18n?: Record<string, string> | null }, i18n.language)
          : null,
        procedureNames,
        photos,
        xrays,
        myResponse: responseRows[0] ?? null,
        responses: responseRows,
      }
    },
  })
}
