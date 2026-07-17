# MedTriage M1 — Ertelenen Takip İşleri (final review triyajı)

M1 merge'i için kabul edilebilir bulunan, sonraki iterasyona bırakılan minor işler. FR-21 ve tenant izolasyonu güvenlidir; aşağıdakiler polish/robustluk.

- **db.ts tipleri**: `PhotoRow`/`AssignmentRow`/`ResponseRow` `tenant_id` alanını içermiyor (insert'ler yine de gönderiyor). M2'de Supabase generated types'a geçince çözülür.
- **Null guard'lar**: `DoctorRequestView` `appUser!` ve `RequestDetail` null `req` durumunda hata verebilir (yalnız yanlış seed veya elle URL ile ulaşılır). Basit guard eklenebilir.
- **Route-level RoleGate**: `/requests` ve `/requests/:id` route seviyesinde RoleGate yok (doktor manuel gidebilir; ne plan ne aracı-mesajı görür — sızıntı değil, kozmetik).
- **AllRequests reassign**: 0 uygun doktor olsa da audit satırı yazıp durumu `assigned` yapıyor; `closed` talebi de yeniden açabilir. `rows.length>0` ve terminal-durum guard'ı eklenmeli.
- **Sessiz mutation hataları**: `AllRequests`, `DoctorAdmin` hata durumunda kullanıcıya bildirim vermiyor (NewRequestWizard ve DoctorRequestView artık veriyor).
- **DoctorQueue "Bekleyen Talepler" listesi** yanıtlanmış talepleri de gösteriyor (sayaç/badge `seen_at` bazlı ve doğru; liste başlığı yanıltıcı). Liste yanıt vermemiş talepleri filtrelemeli veya başlık düzeltilmeli.
- **Storage SELECT politikası** request-scoped değil tenant-scoped (aynı tenant kullanıcısı tenant klasöründeki herhangi bir imzalı URL'i üretebilir; dosya adları rastgele UUID taşıdığından pratikte güvenli). M4 arşiv/şifreleme işinde daraltılır.
- **status.ts (nextStatus FSM)** üretimde kullanılmıyor (DB trigger kaynak); test edilen domain kuralı olarak duruyor (Rule=Data). İsteğe bağlı olarak iyimser UI'da kullanılabilir.

Ayrıca kapsam gereği ertelenenler (M2-M6): AI triyaj, skor/SLA/eskalasyon zamanlayıcı, KVKK fotoğraf yaşam döngüsü + silme, mükerrer tespiti, native push.
