import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { NewRequestInput } from '../useRequests'

/**
 * request insert payload'ının onam alanlarını (consent_at/consent_channel/
 * consented_by/consent_text_version/consent_lang) GERÇEKTEN içerip
 * içermediğini doğrular. buildConsentFields.test.ts yalnız yardımcı
 * fonksiyonu test ediyordu — `...consent` spread'i insert çağrısından
 * silinse bile o test yeşil kalırdı (ve sunucu-taraflı AI kapısı
 * route_new_request onam yoksa sessizce devre dışı kalırdı). Bu dosya
 * gerçek insert payload'ını yakalayıp bunu kanıtlar.
 */

const insertedRequestPayloads: Record<string, unknown>[] = []

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'patient') {
        return {
          insert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: { id: 'patient-1' }, error: null }) }),
          }),
        }
      }
      if (table === 'request') {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertedRequestPayloads.push(payload)
            return {
              select: () => ({ single: () => Promise.resolve({ data: { id: 'req-1' }, error: null }) }),
            }
          },
        }
      }
      throw new Error(`beklenmeyen tablo: ${table}`)
    },
    rpc: () => Promise.resolve({ data: { routed: 'coordinator', assignedCount: 0 }, error: null }),
  },
}))

import { useCreateRequest } from '../useRequests'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const baseInput: NewRequestInput = {
  tenantId: 't1',
  createdBy: 'user-1',
  patient: { first_name: 'Ayşe', last_name: 'Yılmaz', phone: '+905551112233' },
  age: 30,
  weightKg: 60,
  heightCm: 165,
  gender: 'female',
  pastSurgeries: '',
  knownConditions: '',
  medications: '',
  categoryId: 'cat-1',
  subcategoryId: 'sub-1',
  operationTypeId: null,
  files: [],
  sourceLang: 'tr',
}

describe('useCreateRequest — onam alanları request insert payload\'ında', () => {
  beforeEach(() => {
    insertedRequestPayloads.length = 0
  })

  it('consentGiven true ise payload onam alanlarını İÇERİR', async () => {
    const { result } = renderHook(() => useCreateRequest(), { wrapper: makeWrapper() })

    result.current.mutate({ ...baseInput, consentGiven: true, consentLang: 'ar' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(insertedRequestPayloads).toHaveLength(1)
    const payload = insertedRequestPayloads[0]
    expect(payload).toMatchObject({
      consent_channel: 'whatsapp',
      consented_by: 'user-1',
      consent_lang: 'ar',
    })
    expect(typeof payload.consent_at).toBe('string')
    expect(typeof payload.consent_text_version).toBe('string')
  })

  it('consentGiven false ise payload HİÇBİR onam alanı içermez (kolonlar null kalır)', async () => {
    const { result } = renderHook(() => useCreateRequest(), { wrapper: makeWrapper() })

    result.current.mutate({ ...baseInput, consentGiven: false })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(insertedRequestPayloads).toHaveLength(1)
    const payload = insertedRequestPayloads[0]
    expect(payload).not.toHaveProperty('consent_at')
    expect(payload).not.toHaveProperty('consent_channel')
    expect(payload).not.toHaveProperty('consented_by')
    expect(payload).not.toHaveProperty('consent_text_version')
    expect(payload).not.toHaveProperty('consent_lang')
  })
})
