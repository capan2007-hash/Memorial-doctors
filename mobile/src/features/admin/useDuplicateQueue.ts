// Kaynak: /src/features/admin/useDuplicateQueue.ts (web) — mobil mükerrer inceleme
// veri katmanı mirror. dup_state='pending' kuyruğu + ana talep + AI görsel (duplicate_check)
// + foto imzalı URL'ler; karar resolve_duplicate RPC ile verilir.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabase } from '@/lib/supabase'
import { resolvePhotoUrls } from '@/features/request/photoUrl'
import { catalogName } from '@/features/catalog/catalogName'
import type { PhotoRow } from '@/types/db'

export interface DuplicateItem {
  requestId: string
  createdAt: string
  patientName: string
  phone: string | null
  categoryName: string
  parentRequestId: string
  parentCreatedAt: string | null
  parentPatientName: string
  aiSame: boolean | null
  aiConfidence: number | null
  aiReason: string | null
  newPhotos: string[]
  parentPhotos: string[]
}

interface PatientMini {
  id: string
  first_name: string
  last_name: string
  phone: string | null
}
interface ParentMini {
  id: string
  created_at: string
  patient_id: string
}
interface CheckRow {
  request_id: string
  ai_same: boolean | null
  ai_confidence: number | null
  ai_reason: string | null
}

export function useDuplicateQueue() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['duplicate-queue', i18n.language],
    queryFn: async (): Promise<DuplicateItem[]> => {
      const { data: reqs, error } = await supabase
        .from('request')
        .select('*')
        .eq('dup_state', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      const list = (reqs ?? []) as {
        id: string
        created_at: string
        patient_id: string
        category_id: string
        duplicate_of_request_id: string
      }[]
      if (!list.length) return []

      const parentIds = list.map((r) => r.duplicate_of_request_id).filter(Boolean)
      const reqIds = list.map((r) => r.id)
      const [{ data: parents }, { data: patients }, { data: cats }, { data: checks }, { data: photos }] =
        await Promise.all([
          supabase.from('request').select('id, created_at, patient_id').in('id', parentIds),
          supabase.from('patient').select('id, first_name, last_name, phone'),
          supabase.from('category').select('id, name, name_i18n'),
          supabase.from('duplicate_check').select('*').in('request_id', reqIds),
          supabase
            .from('photo')
            .select('*')
            .in('request_id', [...reqIds, ...parentIds])
            .is('deleted_at', null),
        ])

      const pmap = new Map((patients ?? []).map((p: PatientMini) => [p.id, p]))
      const cmap = new Map(
        (cats ?? []).map((c: { id: string; name: string; name_i18n?: Record<string, string> | null }) => [c.id, c]),
      )
      const parentMap = new Map((parents ?? []).map((p: ParentMini) => [p.id, p]))
      const checkMap = new Map((checks ?? []).map((c: CheckRow) => [c.request_id, c]))
      const photosByReq = new Map<string, PhotoRow[]>()
      for (const ph of (photos ?? []) as PhotoRow[]) {
        const arr = photosByReq.get(ph.request_id) ?? []
        arr.push(ph)
        photosByReq.set(ph.request_id, arr)
      }
      const signFor = (id: string) =>
        resolvePhotoUrls((photosByReq.get(id) ?? []).filter((p) => p.kind === 'photo'))

      const items: DuplicateItem[] = []
      for (const r of list) {
        const parent = parentMap.get(r.duplicate_of_request_id)
        const patient = pmap.get(r.patient_id)
        const parentPatient = parent ? pmap.get(parent.patient_id) : null
        const chk = checkMap.get(r.id)
        const catRow = cmap.get(r.category_id)
        const [newPhotos, parentPhotos] = await Promise.all([
          signFor(r.id),
          parent ? signFor(parent.id) : Promise.resolve([]),
        ])
        items.push({
          requestId: r.id,
          createdAt: r.created_at,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
          phone: patient?.phone ?? null,
          categoryName: catRow ? catalogName(catRow, i18n.language) : '—',
          parentRequestId: r.duplicate_of_request_id,
          parentCreatedAt: parent?.created_at ?? null,
          parentPatientName: parentPatient ? `${parentPatient.first_name} ${parentPatient.last_name}` : '—',
          aiSame: chk?.ai_same ?? null,
          aiConfidence: chk?.ai_confidence ?? null,
          aiReason: chk?.ai_reason ?? null,
          newPhotos,
          parentPhotos,
        })
      }
      return items
    },
  })
}

export function useResolveDuplicate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { requestId: string; decision: 'confirmed' | 'dismissed'; note?: string }) => {
      const { error } = await supabase.rpc('resolve_duplicate', {
        p_request_id: input.requestId,
        p_decision: input.decision,
        p_note: input.note ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duplicate-queue'] })
      qc.invalidateQueries({ queryKey: ['all-requests'] })
    },
  })
}
