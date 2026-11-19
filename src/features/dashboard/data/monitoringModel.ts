export type PointStatus = 'Normal' | 'Atenção' | 'Crítico' | 'Sem leitura'
export type DashboardPoint = {
  id: string
  name: string
  location: string
  level: number | null
  updatedAt: string | null
  attention: number
  critical: number
  demo?: boolean
}
export const READING_STALE_MS = 5 * 60 * 1000
export function pointStatus(point: DashboardPoint, now = Date.now()): PointStatus {
  if (point.level === null || !Number.isFinite(point.level) || (!point.demo && (!point.updatedAt || now - Date.parse(point.updatedAt) > READING_STALE_MS || !Number.isFinite(Date.parse(point.updatedAt))))) return 'Sem leitura'
  return point.level >= point.critical ? 'Crítico' : point.level >= point.attention ? 'Atenção' : 'Normal'
}
export function priorityPoint(points: DashboardPoint[], now = Date.now()) {
  const rank: Record<PointStatus, number> = { 'Crítico': 3, 'Atenção': 2, 'Sem leitura': 1, Normal: 0 }
  return [...points].sort((a, b) => rank[pointStatus(b, now)] - rank[pointStatus(a, now)])[0]
}
