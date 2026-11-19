import { getSupabaseClient } from '@/lib/supabase'
import type { DashboardPoint } from './monitoringModel'

export async function fetchMonitoringPoints(signal?: AbortSignal): Promise<DashboardPoint[]> {
  let query = getSupabaseClient().from('monitoring_overview').select('*').order('name').limit(200)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error('Não foi possível carregar os pontos. Confira a conexão e a estrutura do banco.')
  return data.map(row => ({ id: row.id, name: row.name, location: row.location, level: row.level_cm, updatedAt: row.recorded_at, attention: row.attention_cm, critical: row.critical_cm }))
}
export async function fetchPointHistory(pointId: string, since: string, signal?: AbortSignal) {
  let query = getSupabaseClient().from('water_readings').select('level_cm, recorded_at').eq('point_id', pointId).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(500)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error('Não foi possível carregar o histórico deste ponto.')
  return data.reverse().map(row => ({ at: Date.parse(row.recorded_at), level: row.level_cm }))
}
