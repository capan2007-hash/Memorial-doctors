// Doktor görünen adı: unvan (doctor.title) + ad (app_user.full_name).
//
// HATA: bunlar körlemesine birleştirilince "Op. Dr. Op. Dr. Plastik" gibi ÇİFT UNVAN
// çıkıyordu — çünkü sahadaki kayıtlarda unvan bazen full_name'in İÇİNDE de yazılı
// ("Op. Dr." + "Op. Dr. Plastik"). Kural: ad zaten unvanı içeriyorsa unvan eklenmez.
// Karşılaştırma normalize edilir (küçük harf, nokta ve fazla boşluk yok sayılır).

function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function doctorLabel(title: string | null | undefined, fullName: string | null | undefined): string {
  const t = (title ?? '').trim()
  const n = (fullName ?? '').trim()
  if (!n) return t
  if (!t) return n
  const nn = normalize(n)
  const tn = normalize(t)
  // Ad zaten unvanı barındırıyorsa (ör. "Op. Dr. Plastik" ⊃ "Op. Dr.") tekrar etme.
  if (nn === tn || nn.startsWith(tn + ' ') || nn.includes(tn)) return n
  return `${t} ${n}`
}
