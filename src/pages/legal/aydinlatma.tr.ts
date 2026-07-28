import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import { type LegalDocument, LEGAL_VERSION } from './types'

export const aydinlatmaTr = (id: ClinicIdentity, r: Retention): LegalDocument => ({
  version: LEGAL_VERSION,
  title: 'Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni',
  subtitle: '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca',
  updatedLabel: 'Son güncelleme',
  draftWarning: 'TASLAK — bu metin KVKK danışmanı onaylı nihai metinle değiştirilecektir.',
  shareMessage:
    'Merhaba, talebinizi kaydediyoruz. Kişisel verilerinizin nasıl işlendiğini açıklayan aydınlatma metnini buradan okuyabilirsiniz: {{link}} — Metni okuduktan sonra onayınızı bize iletmeniz gerekmektedir.',
  sections: [
    {
      id: 'controller',
      heading: 'Veri Sorumlusu',
      paragraphs: [
        `${id.legalName}, KVKK kapsamında veri sorumlusu sıfatıyla, aşağıda açıklanan kişisel verilerinizi işlemektedir.`,
        `Adres: ${id.address}`,
        `E-posta: ${id.email}`,
        ...(id.phone ? [`Telefon: ${id.phone}`] : []),
        ...(id.verbis ? [`VERBİS kayıt numarası: ${id.verbis}`] : []),
      ],
    },
    {
      id: 'data',
      heading: 'İşlenen Kişisel Veriler',
      paragraphs: [
        'Kimlik bilgileriniz (ad, soyad), iletişim bilgileriniz (telefon, varsa e-posta) ve sağlık verileriniz (yaş, kilo, boy, cinsiyet, geçmiş ameliyatlar, bilinen hastalıklar, kullanılan ilaçlar, sigara ve alkol kullanımı) işlenmektedir.',
        'Talebinize eklediğiniz fotoğraf ve röntgen görüntüleri de kişisel veri olarak işlenir. Yüklenen görüntülerin konum ve cihaz bilgisi (EXIF) sistem tarafından otomatik olarak silinir.',
        'Sağlık verileriniz KVKK m.6 anlamında özel nitelikli kişisel veridir ve yalnızca açık rızanıza dayanarak işlenir.',
      ],
    },
    {
      id: 'purpose',
      heading: 'İşleme Amaçları',
      paragraphs: [
        'Verileriniz; talebinizin uygun uzmanlık alanındaki hekimlere yönlendirilmesi, hekim tarafından ön değerlendirme yapılması, size uygun tedavi seçeneklerinin ve fiyat teklifinin sunulması ve klinik-hasta iletişiminin yürütülmesi amaçlarıyla işlenmektedir.',
        'Verileriniz pazarlama, reklam veya profilleme amacıyla kullanılmaz; üçüncü taraf reklam ve izleme teknolojileri kullanılmamaktadır.',
      ],
    },
    {
      id: 'legalBasis',
      heading: 'Toplama Yöntemi ve Hukuki Sebep',
      paragraphs: [
        'Kişisel verileriniz, klinik personelimizle kurduğunuz iletişim kanalı (WhatsApp, telefon görüşmesi veya klinikte yüz yüze görüşme) üzerinden tarafınızca beyan edilmesi suretiyle toplanır ve personelimiz tarafından sisteme kaydedilir.',
        'Sağlık verileriniz özel nitelikli kişisel veri olduğundan, işlenmesinin hukuki sebebi KVKK m.6/2 uyarınca açık rızanızdır. Kimlik ve iletişim bilgileriniz ise KVKK m.5/2-c uyarınca sözleşmenin kurulması ve ifasıyla doğrudan ilgili olması hukuki sebebine dayanılarak işlenir.',
        'Açık rızanızı dilediğiniz zaman geri alabilirsiniz. Rızanızı geri almanız halinde verileriniz işlenmeye devam edilmez ve saklama süresi sonunda silinir; geri alma tarihine kadar gerçekleştirilmiş işlemler bundan etkilenmez.',
      ],
    },
    {
      id: 'transfer',
      heading: 'Yurt Dışına Aktarım',
      emphasis: true,
      paragraphs: [
        'Talebiniz, yapay zekâ destekli ön değerlendirme yapılabilmesi amacıyla ABD merkezli bir hizmet sağlayıcıya (yapay zekâ modeli sağlayıcısı) aktarılabilir.',
        'Bu aktarım yalnızca açık rızanız alındığında gerçekleştirilir. Rıza vermediğiniz takdirde talebiniz yapay zekâ değerlendirmesine gönderilmez ve yalnızca hekim değerlendirmesiyle işleme alınır.',
        'Aktarım öncesinde adınız ve soyadınız serbest metin alanlarından otomatik olarak maskelenir; fotoğraf ve röntgen görüntüleri yapay zekâ değerlendirmesine gönderilmez.',
        'Yapay zekâ çıktıları yalnızca hekime yol gösterici niteliktedir; tanı veya tedavi kararı münhasıran yetkili hekim tarafından verilir.',
      ],
    },
    {
      id: 'retention',
      heading: 'Saklama ve İmha',
      paragraphs: [
        `Talebinize eklediğiniz fotoğraf ve röntgen görüntüleri en fazla ${r.photoDays} gün saklanır. Ameliyat tarihi belirlenmiş ise görüntüler ameliyat tarihinden ${r.opBufferDays} gün sonrasına kadar muhafaza edilir. Süre sonunda görüntüler otomatik olarak silinir.`,
        'Kimlik, iletişim ve sağlık verileriniz, ilgili mevzuatta öngörülen saklama süreleri boyunca muhafaza edilir; süre sonunda silinir, yok edilir veya anonim hale getirilir.',
      ],
    },
    {
      id: 'rights',
      heading: 'İlgili Kişi Olarak Haklarınız',
      paragraphs: [
        'KVKK\'nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme, işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonuç doğmasına itiraz etme ve kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.',
        `Taleplerinizi ${id.email} adresine ileterek kullanabilirsiniz. Başvurunuz en geç otuz gün içinde sonuçlandırılır.`,
      ],
    },
  ],
})
