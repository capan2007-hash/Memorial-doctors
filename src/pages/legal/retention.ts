export type Retention = {
  /** Fotoğrafların azami saklama süresi (gün). */
  photoDays: number
  /** Ameliyat tarihinden sonraki ek saklama tamponu (gün). */
  opBufferDays: number
}

/**
 * Kaynak: tenant.photo_retention_days (60) ve tenant.photo_op_buffer_days (30)
 * varsayılanları — supabase/migrations/0016_photo_lifecycle.sql.
 *
 * Public aydınlatma sayfası oturumsuz olduğu için tenant satırı okunamaz;
 * tek-klinik kararıyla sabit tutuluyor. tenant varsayılanları değişirse
 * retention.test.ts kırılır ve HUKUKİ METNİN de güncellenmesi gerektiğini
 * hatırlatır.
 */
export const RETENTION: Retention = {
  photoDays: 60,
  opBufferDays: 30,
}
