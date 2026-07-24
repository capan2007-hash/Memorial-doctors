# RTL Sözleşmesi — mantıksal (logical) Tailwind sınıfları

MedTriage üç dili destekler: `tr`, `en` (LTR) ve `ar` (RTL). `src/i18n/index.ts`
içindeki `applyDir(lang)` dil değiştiğinde `<html dir>` ve `<html lang>`
özniteliklerini günceller (`ar` → `dir="rtl"`, diğerleri → `dir="ltr"`).
Bileşenlerin bu yön değişimine kırılmadan uyması için **fiziksel** (`left`/
`right`) yerine **mantıksal** (`start`/`end`) Tailwind sınıfları kullanılır.
Tailwind 3.3+ bu yardımcıları doğrudan destekler — ek eklenti gerekmez.

## Kural: fiziksel → mantıksal

| Fiziksel (kullanma) | Mantıksal (kullan) | Anlamı |
| --- | --- | --- |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` | padding-inline-start / end |
| `ml-*` / `mr-*` | `ms-*` / `me-*` | margin-inline-start / end |
| `left-*` / `right-*` | `start-*` / `end-*` | inset-inline-start / end |
| `-left-*` / `-right-*` | `-start-*` / `-end-*` | negatif inset (rozet/badge konumlandırma vb.) |
| `text-left` / `text-right` | `text-start` / `text-end` | metin hizalama |

`start` LTR'de sol, RTL'de sağ demektir; `end` tam tersi — sınıf adı sabit
kalır, tarayıcı `dir` özniteliğine göre yönü kendisi çözer.

## Dokunma — zaten yön-duyarlı

- `flex` + `gap-*` (row/column) — flexbox ana ekseni `dir`'e göre otomatik
  ters döner, `gap-*` fiziksel yön varsaymaz. `space-x-*` bunun tersine
  yöne duyarlı **değildir** (`margin-left` üretir) — yeni kodda `space-x-*`
  yerine `flex` + `gap-*` tercih edilir.
- `mx-auto`, simetrik `px-*`/`py-*` — zaten yönden bağımsız.

## Yön-duyarlı ikonlar

Chevron, ok, "geri" gibi anlamı yönle değişen ikonlar RTL'de aynalanmalı:

```tsx
<Icon of={ChevronRight} className="rtl:-scale-x-100" />
```

veya (Tailwind'in `rtl:` varyantı `dir="rtl"` olan bir ata elemente göre
eşleşir):

```tsx
<Icon of={ChevronRight} className="rtl:rotate-180" />
```

**Nötr ikonlar dokunulmaz** — logo/marka işareti (`Monogram`), tema
anahtarı (güneş/ay), dil seçici gibi yön taşımayan ikonlar aynı kalır.
Skor barı gibi **sabit-yön grafikler** de (örn. soldan sağa ilerleme
göstergesi, sayısal bir ölçeği temsil eder) bilinçli olarak nötr
bırakılır — bunlar dilin okuma yönünü değil, sabit bir ölçeği temsil eder.

## Referans dönüşüm — `src/components/Layout.tsx`

Mobil alt navigasyonda bekleyen-sayısı rozeti ikonun sağ-üst köşesine
`absolute` konumlandırılıyordu:

```diff
- <span className="absolute -right-2 -top-1.5">
+ <span className="absolute -end-2 -top-1.5">
```

`-top-1.5` dikey eksende kalır (RTL yalnız yatay ekseni etkiler).
`-right-2` → `-end-2` olunca rozet LTR'de sağ-üstte, RTL'de sol-üstte
doğru köşede kalır. Header, pill nav ve mobil alt-nav'daki diğer tüm
düzen sınıfları (`flex`, `gap-*`, `justify-between`, `mx-auto`, simetrik
`px-*`) zaten yön-duyarlı olduğundan değişmedi.

## Yeni bileşen eklerken kontrol listesi

1. `pl-/pr-/ml-/mr-/left-/right-/text-left/text-right` var mı? → mantıksal
   karşılığına çevir.
2. `space-x-*` yerine `flex` + `gap-*` kullan.
3. Yönü olan bir ikon mu (ok, chevron, geri)? → `rtl:` varyantıyla aynala.
4. Sabit ölçek/skor grafiği mi? → bilinçli olarak dokunma, yorum bırak.
5. `applyDir` testi (`src/i18n/__tests__/dir.test.ts`) `ar → rtl`,
   `en/tr → ltr` sözleşmesini korur; dil listesine yeni bir RTL dili
   eklenirse `RTL_LANGS` (`src/i18n/index.ts`) güncellenir.
