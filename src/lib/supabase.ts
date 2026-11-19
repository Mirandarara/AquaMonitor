import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const isDatabaseConfigured = Boolean(url && key)
let client: SupabaseClient<Database> | undefined

export function getSupabaseClient() {
  if (!url || !key) throw new Error('Configure a URL e a chave pública do Supabase em .env.local.')
  client ??= createClient<Database>(url, key)
  return client
}
