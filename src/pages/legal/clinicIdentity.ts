export type ClinicIdentity = {
  /** Tam ticaret unvanı. */
  legalName: string
  /** Açık (tebligat) adresi. */
  address: string
  /** KVKK m.11 başvurularının geleceği e-posta. */
  email: string
  /** Opsiyonel — boşsa metinden çıkarılır. */
  phone: string
  /** Opsiyonel VERBİS kayıt numarası — boşsa metinden çıkarılır. */
  verbis: string
}

/**
 * BEKLEYEN GİRDİ: legalName / address / email doldurulmadan sayfa TASLAK
 * modunda kalır (bkz. IDENTITY_COMPLETE). Değerler klinikten gelir; metni
 * KVKK danışmanı onaylamalıdır.
 */
export const CLINIC_IDENTITY: ClinicIdentity = {
  legalName: '',
  address: '',
  email: '',
  phone: '',
  verbis: '',
}

/**
 * Zorunlu üç kimlik alanı (unvan, adres, e-posta) dolu mu? Telefon ve VERBİS
 * opsiyoneldir. Saf fonksiyon — sabitten değil parametreden hesaplar, böylece
 * fixture'larla gerçekten test edilebilir.
 */
export function isIdentityComplete(id: ClinicIdentity): boolean {
  return Boolean(id.legalName.trim() && id.address.trim() && id.email.trim())
}

/**
 * Üretimdeki kimliğin durumu. false ise sayfa TASLAK bannerı gösterir.
 * Banner ELLE kaldırılmaz — bu bayrak düşünce kendisi kaybolur.
 */
export const IDENTITY_COMPLETE = isIdentityComplete(CLINIC_IDENTITY)
