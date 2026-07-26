// Satışçı "Gönder"e basıp talebi oluşturduktan sonra AI ön-değerlendirme sonucu
// SATIŞÇININ EKRANINDA gösterilsin mi? Karar saf/test edilebilir tutuldu.
//
// Kural — hepsi sağlanmalı:
//  1) Talep DOKTORLARA gitti (routed==='doctors'). Mükerrer şüphesiyle koordinatöre
//     giden taleplerde AI zaten çalışmaz (route_new_request atlar) → boşuna token yok.
//  2) En az bir doktora atandı (assignedCount>0) — atama yoksa AI de tetiklenmez.
//  3) Onam verildi (consentGiven) — onam yoksa AI hiç çalışmaz (KVKK kapısı).
//  4) Görüntüleyen rolü ai_evaluation'ı OKUYABİLEN bir rol. RLS'e göre bunlar
//     sales/coordinator/admin; AGENT (aracı) ai_evaluation'ı okuyamaz → ona gösterilmez.
const AI_VIEWER_ROLES = ['sales', 'coordinator', 'admin']

export interface AiPreviewInput {
  routed: 'coordinator' | 'doctors'
  assignedCount: number
  consentGiven: boolean
  role: string | null | undefined
}

export function shouldShowAiPreview(input: AiPreviewInput): boolean {
  return (
    input.routed === 'doctors' &&
    input.assignedCount > 0 &&
    input.consentGiven &&
    AI_VIEWER_ROLES.includes(input.role ?? '')
  )
}
