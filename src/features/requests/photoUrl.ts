import { supabase } from '../../lib/supabase'
import type { PhotoRow } from '../../types/db'

// M4 Task 4 (FR-37/38): aktif katman fotoğrafları bugünkü gibi doğrudan
// createSignedUrl ile imzalanır. Arşiv katmanı fotoğrafları client'ta ASLA
// doğrudan imzalanmaz — `photo-url` edge fonksiyonu caller yetkisini doğrular
// (koordinatör/admin veya atanan doktor; agent/sales engellenir), kısa ömürlü
// (120sn) imzalı URL üretir ve erişimi audit_log'a yazar. İmha edilmiş
// fotoğraflar (deleted_at dolu) için URL üretilmez.
export type ResolvablePhoto = Pick<PhotoRow, 'id' | 'storage_path' | 'layer' | 'deleted_at'>

export async function resolvePhotoUrl(photo: ResolvablePhoto): Promise<string | null> {
  if (photo.deleted_at) return null

  if (photo.layer === 'archive') {
    try {
      const { data, error } = await supabase.functions.invoke('photo-url', { body: { photoId: photo.id } })
      if (error) return null
      return (data as { url?: string } | null)?.url ?? null
    } catch {
      return null
    }
  }

  const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 300)
  return data?.signedUrl ?? null
}

export async function resolvePhotoUrls(photos: ResolvablePhoto[]): Promise<string[]> {
  const urls = await Promise.all(photos.map(resolvePhotoUrl))
  return urls.filter((u): u is string => !!u)
}
