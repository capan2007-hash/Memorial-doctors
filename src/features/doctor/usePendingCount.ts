import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Doktorun görmediği (seen_at IS NULL) atama sayısı; realtime güncellenir.
export function usePendingCount(doctorId?: string) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!doctorId) return
    const load = async () => {
      const { count: c } = await supabase.from('assignment')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorId).is('seen_at', null)
      setCount(c ?? 0)
    }
    load()
    // Kanal adı hook örneği başına benzersiz olmalı: supabase.channel() aynı
    // isimde MEVCUT kanalı döndürür; ikinci tüketici (ör. Layout + DoctorQueue
    // aynı anda) subscribe edilmiş kanala .on() ekleyince exception fırlar.
    const ch = supabase.channel(`pending-${doctorId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment', filter: `doctor_id=eq.${doctorId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [doctorId])
  return count
}
