import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Icon } from '../components/ui/Icon'
import { getLegalDocument, resolveLang } from './legal'
import { IDENTITY_COMPLETE } from './legal/clinicIdentity'

/**
 * Public aydınlatma metni sayfası — iOS/App Store gizlilik politikası URL'i.
 *
 * Dil sırası: ?lang= parametresi SADECE İLK YÜKLEMEDE bir TOHUM'dur — bir kez
 * uygulanır, ondan sonra gösterilen dil (ve dolayısıyla doküman + <html dir>)
 * TAMAMEN aktif i18next diline bağlıdır. Bu ayrım kasıtlıdır: useTranslation()
 * her dil değişiminde YENİ bir i18n nesnesi döndürür, dolayısıyla efekt
 * [urlLang, i18n]'e bağlı kalıp her seferinde ?lang='i yeniden uygularsa dil
 * seçici kalıcı olarak ETKİSİZ hale gelir (kullanıcı Fransızcaya geçer, bir
 * kare sonra otomatik olarak ?lang= değerine geri döner). Bu yüzden tohumlama
 * bir useRef bayrağıyla TEK SEFERLİK yapılır; sonraki render'larda doc,
 * i18n.language'den türetilir, urlLang'den DEĞİL.
 *
 * TASLAK bannerı IDENTITY_COMPLETE'e bağlıdır; elle kaldırılmaz. Testlerde
 * enjekte edilebilmesi için opsiyonel bir prop olarak da alınabilir
 * (varsayılan üretim davranışı değişmez).
 *
 * Bidi notu: paragraflar ve sürüm satırı düz string olarak gelir; klinik
 * kimliği (unvan, adres, e-posta, VERBİS no) bu stringlerin içine zaten
 * enterpole edilmiş halde. Arapça (RTL) paragraflarda gömülü Latin değerler
 * sayfa düzeyindeki dir="rtl" tek başına doğru izole edilmez (ör. unvanın
 * ardından gelen nokta yanlış tarafa kayabilir). Bu yüzden her paragraf ve
 * sürüm satırı <bdi> ile sarılır — Unicode bidi izolasyonunu markup
 * seviyesinde sağlar; dizelere kontrol karakteri EKLENMEZ.
 */
export function Aydinlatma({ identityComplete = IDENTITY_COMPLETE }: { identityComplete?: boolean } = {}) {
  const [params] = useSearchParams()
  const { i18n } = useTranslation()
  const urlLang = params.get('lang')

  // ?lang= tohumu TEK SEFERLİK uygulanır (bkz. yukarıdaki not). i18n.changeLanguage
  // 'languageChanged' olayını tetikler → src/i18n/index.ts'teki applyDir dinleyicisi
  // <html dir>'i de doğru yöne çevirir; bu efekt urlLang'i doğrudan render'a
  // KARIŞTIRMAZ, sadece i18next'e bir kerelik uygular.
  const seededFromUrlRef = useRef(false)
  useEffect(() => {
    if (seededFromUrlRef.current) return
    seededFromUrlRef.current = true
    if (!urlLang) return
    const resolved = resolveLang(urlLang)
    if (resolved !== i18n.language) i18n.changeLanguage(resolved)
  }, [urlLang, i18n])

  const doc = getLegalDocument(i18n.language)

  return (
    <div className="min-h-screen bg-surface py-6 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-end">
          <LanguageSwitcher />
        </div>

        {!identityComplete && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-accent-600 bg-accent-100 px-4 py-3 text-sm font-medium text-accent-700"
          >
            <Icon of={AlertTriangle} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{doc.draftWarning}</span>
          </div>
        )}

        <div className="space-y-6 rounded-xl bg-surface-card p-5 shadow-card md:p-8">
          <header className="space-y-1">
            <h1 className="font-display text-2xl text-ink-primary">{doc.title}</h1>
            <p className="text-sm text-ink-secondary">{doc.subtitle}</p>
            <p className="text-xs text-ink-secondary">
              <bdi>
                {doc.updatedLabel}: {doc.version}
              </bdi>
            </p>
          </header>

          {doc.sections.map((s) => (
            <section
              key={s.id}
              className={
                s.emphasis
                  ? 'space-y-2 rounded-lg border border-accent-600 bg-accent-100/60 p-4'
                  : 'space-y-2'
              }
            >
              <h2 className="font-display text-lg text-ink-primary">{s.heading}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-ink-secondary">
                  <bdi>{p}</bdi>
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
