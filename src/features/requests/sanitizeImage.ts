// Fotoğraf yükleme gizlilik yardımcıları:
// - safeExt: MIME türünden güvenli dosya uzantısı türetir (orijinal ad kullanılmaz).
// - sanitizeImage: canvas üzerinden yeniden kodlayarak EXIF/GPS metadata'sını düşürür.
// - buildPhotoPath: storage path'inde orijinal dosya adının asla görünmemesini garanti eder.

export function safeExt(file: File): string {
  switch (file.type) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'jpg'
  }
}

function mimeFor(file: File): string {
  switch (file.type) {
    case 'image/png':
      return 'image/png'
    case 'image/webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
}

/**
 * Görseli canvas üzerinden yeniden kodlar; bu işlem EXIF/GPS gibi metadata'yı
 * düşürür. Herhangi bir adımda hata olursa (createImageBitmap desteklenmiyor,
 * toBlob null döner, vb.) orijinal dosya döndürülür — yükleme akışı ASLA
 * kesintiye uğramaz (FR-11).
 */
export async function sanitizeImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.drawImage(bitmap, 0, 0)

      const mime = mimeFor(file)
      const quality = mime === 'image/jpeg' ? 0.92 : undefined

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mime, quality)
      })

      return blob ?? file
    } finally {
      bitmap.close?.()
    }
  } catch {
    return file
  }
}

/** Storage path'i: tenant/request/UUID.ext — orijinal file.name hiçbir yerde kullanılmaz. */
export function buildPhotoPath(tenantId: string, requestId: string, file: File): string {
  return `${tenantId}/${requestId}/${crypto.randomUUID()}.${safeExt(file)}`
}
