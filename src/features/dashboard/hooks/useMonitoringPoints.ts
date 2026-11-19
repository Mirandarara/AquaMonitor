import { useCallback, useEffect, useState } from 'react'
import { isDatabaseConfigured } from '@/lib/supabase'
import { monitoringPoints } from '../data/monitoringPoints'
import type { DashboardPoint } from '../data/monitoringModel'
import { fetchMonitoringPoints } from '../data/monitoringRepository'

const demoPoints: DashboardPoint[] = monitoringPoints.map((p, i) => ({ id: `demo-${i}`, name: p.name, location: 'Juazeiro do Norte, CE', level: p.level, updatedAt: null, attention: 60, critical: 100, demo: true }))
export function useMonitoringPoints(enabled = true) {
  const [points, setPoints] = useState<DashboardPoint[]>(isDatabaseConfigured ? [] : demoPoints)
  const [loading, setLoading] = useState(isDatabaseConfigured)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    if (!isDatabaseConfigured || !enabled) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const next = await fetchMonitoringPoints(AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]))
        if (!controller.signal.aborted) { setPoints(next); setError('') }
      } catch (e) {
        if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Falha ao carregar dados.'); setPoints([]) }
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(refresh, 30_000) }
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [enabled, revision])
  return { points, loading: enabled && loading, error: enabled ? error : '', retry, demo: !isDatabaseConfigured }
}
