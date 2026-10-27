import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Evento } from '../store/escritorio'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null
export const modoDemo = !supabase

/** Assina os eventos de um post e repassa ao escritório na ordem em que chegam. */
export function assinarEventos(postId: string, aplicar: (e: Evento) => void) {
  if (!supabase) return () => {}
  const canal = supabase
    .channel(`eventos:${postId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'eventos', filter: `post_id=eq.${postId}` },
      (payload) => aplicar(payload.new as Evento),
    )
    .subscribe()
  return () => {
    supabase.removeChannel(canal)
  }
}
