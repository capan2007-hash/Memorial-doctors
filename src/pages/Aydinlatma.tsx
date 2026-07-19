export function Aydinlatma() {
  return (
    <div className="min-h-screen bg-surface py-6 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-lg border border-accent-600 bg-accent-100 text-accent-700 px-4 py-3 text-sm font-medium">
          ⚠ TASLAK — bu metin KVKK danışmanı onaylı nihai metinle değiştirilecektir.
        </div>

        <div className="rounded-xl bg-surface-card shadow-card p-5 md:p-8 space-y-6">
          <header className="space-y-1">
            <h1 className="font-display text-2xl text-slate-900">Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni</h1>
            <p className="text-sm text-slate-500">6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca</p>
          </header>

          <section className="space-y-2">
            <h2 className="font-display text-lg text-slate-900">Veri Sorumlusu</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              [Klinik unvanı / ticaret unvanı], KVKK kapsamında veri sorumlusu sıfatıyla, aşağıda açıklanan kişisel
              verilerinizi işlemektedir. [Adres, iletişim bilgileri buraya eklenecek.]
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg text-slate-900">İşlenen Veriler</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Kimlik bilgileriniz (ad, soyad), iletişim bilgileriniz (telefon), sağlık verileriniz (yaş, kilo, boy,
              cinsiyet, geçmiş ameliyatlar, bilinen hastalıklar, kullanılan ilaçlar) ve talebinize eklediğiniz
              fotoğraf/röntgen görüntüleri işlenmektedir.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg text-slate-900">İşleme Amacı</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Verileriniz; talebinizin ilgili doktorlara yönlendirilmesi, ön değerlendirme yapılması, size uygun
              tedavi seçeneklerinin sunulması ve klinik-hasta iletişiminin yürütülmesi amacıyla işlenmektedir.
            </p>
          </section>

          <section className="space-y-2 rounded-lg border border-accent-600 bg-accent-100/60 p-4">
            <h2 className="font-display text-lg text-slate-900">Yurt Dışına Aktarım</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Talebiniz, yapay zekâ destekli ön değerlendirme yapılabilmesi amacıyla <strong>ABD merkezli bir hizmet
              sağlayıcıya</strong> (yapay zekâ modeli sağlayıcısı) aktarılabilir. Bu aktarım yalnızca açık rızanız
              alındığında gerçekleştirilir; rıza vermediğiniz takdirde talebiniz yapay zekâ değerlendirmesine
              gönderilmeden yalnızca doktor değerlendirmesiyle işleme alınır.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg text-slate-900">Saklama Süreleri</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Verileriniz, klinik politikasında belirtilen saklama süreleri boyunca (fotoğraflar için tanımlı
              saklama/imha süreleri dahil) muhafaza edilir; süre sonunda silinir veya anonim hale getirilir.
              [Süre detayları buraya eklenecek.]
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg text-slate-900">Haklarınız</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              KVKK&apos;nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna
              ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
              yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini
              isteme, silinmesini/yok edilmesini isteme ve bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini
              isteme haklarına sahipsiniz. Taleplerinizi [iletişim kanalı buraya eklenecek] üzerinden iletebilirsiniz.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
