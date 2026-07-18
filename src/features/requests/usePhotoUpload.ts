import { supabase } from '../../lib/supabase'
import { buildPhotoPath, sanitizeImage } from './sanitizeImage'

export async function uploadPhotos(
  tenantId: string, requestId: string, files: File[], kind: 'photo' | 'xray' = 'photo',
) {
  for (const file of files) {
    const path = buildPhotoPath(tenantId, requestId, file)
    const sanitized = await sanitizeImage(file)
    const { error: upErr } = await supabase.storage
      .from('photos')
      .upload(path, sanitized, { contentType: sanitized.type || file.type })
    if (upErr) throw upErr
    const { error: insErr } = await supabase.from('photo').insert({
      tenant_id: tenantId, request_id: requestId, storage_path: path, kind,
    })
    if (insErr) throw insErr
  }
}
