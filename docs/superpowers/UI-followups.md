# MedTriage UI Yenileme — Ertelenen Takip İşleri (final review triyajı)

Merge öncesi çözülenler: taslak PII oturum-sınırı temizliği; tıbbi alan iç içe label/yanlış Yok-toggle. Kalanlar:

- **AllRequests "Yeniden ata" butonu `<Link>` içinde** — interactive-in-interactive geçersiz HTML; preventDefault ile çalışıyor. Buton satırın dışına (sibling) taşınmalı.
- **PhotoGrid lightbox a11y** — role="dialog"/aria-modal/focus-trap yok; ESC document dinleyicisiyle çalışıyor. Pilot için yeterli, sonra parlatılır.
- **Doktorda çift realtime aboneliği** — Layout + DoctorQueue aynı anda usePendingCount kurar (benzersiz kanal adlarıyla güvenli ama gereksiz); paylaşılan context'e alınabilir.
- **Login'de etiket+placeholder tekrarı** — E2E artık etiket kullanıyor; duplicate placeholder'lar kaldırılabilir.
- **DoctorAdmin hızlı aktif/pasif toggle** — restyle'da genişletilmiş forma taşındı; satırda hızlı toggle geri eklenebilir.
