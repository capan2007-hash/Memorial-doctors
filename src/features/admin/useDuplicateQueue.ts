import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { resolvePhotoUrls } from '../requests/photoUrl'
import type { PhotoRow } from '../../types/db'

export interface DuplicateItem {
  requestId: string
  createdAt: string
  patientName: string
  phone: string | null
  categoryName: string
  parentRequestId: string
  parentCreatedAt: string | null
  parentPatientName: string
  matchReason: 'phone' | 'name' | null
  aiSame: boolean | null
  aiConfidence: number | null
  aiReason: string | null
  newPhotos: string[]
  parentPhotos: string[]
}

export function useDuplicateQueue() {
  return useQuery({
    queryKey: ['duplicate-queue'],
    queryFn: async (): Promise<DuplicateItem[]> => {
      const { data: reqs, error } = await supabase.from('request')
        .select('*').eq('dup_state', 'pending').order('created_at', { ascending: false })
      if (error) throw error
      const list = (reqs ?? []) as any[]
      if (!list.length) return []
      const parentIds = list.map((r) => r.duplicate_of_request_id).filter(Boolean)
      const reqIds = list.map((r) => r.id)
      const [{ data: parents }, { data: patients }, { data: cats }, { data: checks }, { data: photos }] = await Promise.all([
        supabase.from('request').select('id, created_at, patient_id').in('id', parentIds),
        supabase.from('patient').select('id, first_name, last_name, phone'),
        supabase.from('category').select('id, name'),
        supabase.from('duplicate_check').select('*').in('request_id', reqIds),
        supabase.from('photo').select('*').in('request_id', [...reqIds, ...parentIds]).is('deleted_at', null),
      ])
      const pmap = new Map((patients ?? []).map((p: any) => [p.id, p]))
      const cmap = new Map((cats ?? []).map((c: any) => [c.id, c.name]))
      const parentMap = new Map((parents ?? []).map((p: any) => [p.id, p]))
      const checkMap = new Map((checks ?? []).map((c: any) => [c.request_id, c]))
      const photosByReq = new Map<string, PhotoRow[]>()
      for (const ph of (photos ?? []) as PhotoRow[]) {
        const arr = photosByReq.get(ph.request_id) ?? []; arr.push(ph); photosByReq.set(ph.request_id, arr)
      }
      const signFor = (id: string) => resolvePhotoUrls((photosByReq.get(id) ?? []).filter((p) => p.kind === 'photo'))
      const items: DuplicateItem[] = []
      for (const r of list) {
        const parent = parentMap.get(r.duplicate_of_request_id)
        const patient = pmap.get(r.patient_id)
        const parentPatient = parent ? pmap.get(parent.patient_id) : null
        const chk = checkMap.get(r.id)
        const [newPhotos, parentPhotos] = await Promise.all([
          signFor(r.id), parent ? signFor(parent.id) : Promise.resolve([]),
        ])
        items.push({
          requestId: r.id, createdAt: r.created_at,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : '—',
          phone: patient?.phone ?? null, categoryName: cmap.get(r.category_id) ?? '—',
          parentRequestId: r.duplicate_of_request_id, parentCreatedAt: parent?.created_at ?? null,
          parentPatientName: parentPatient ? `${parentPatient.first_name} ${parentPatient.last_name}` : '—',
          matchReason: null,
          aiSame: chk?.ai_same ?? null, aiConfidence: chk?.ai_confidence ?? null, aiReason: chk?.ai_reason ?? null,
          newPhotos, parentPhotos,
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
        p_request_id: input.requestId, p_decision: input.decision, p_note: input.note ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['duplicate-queue'] }); qc.invalidateQueries({ queryKey: ['requests'] }) },
  })
}
