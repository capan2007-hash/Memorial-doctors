import { supabase } from '../../lib/supabase'

export async function uploadPhotos(
  tenantId: string, requestId: string, files: File[], kind: 'photo' | 'xray' = 'photo',
) {
  for (const file of files) {
    const path = `${tenantId}/${requestId}/${crypto.randomUUID()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file)
    if (upErr) throw upErr
    const { error: insErr } = await supabase.from('photo').insert({
      tenant_id: tenantId, request_id: requestId, storage_path: path, kind,
    })
    if (insErr) throw insErr
  }
}
