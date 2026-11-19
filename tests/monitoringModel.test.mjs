import test from 'node:test'
import assert from 'node:assert/strict'
import { pointStatus, priorityPoint, READING_STALE_MS } from '../src/features/dashboard/data/monitoringModel.ts'
const now = Date.now()
const point = { id: 'a', name: 'Ponto', level: 20, location: '', attention: 60, critical: 100, updatedAt: new Date(now).toISOString() }
test('status honors sensor limits and never presents missing or stale readings as safe', () => {
  assert.equal(pointStatus(point, now), 'Normal')
  assert.equal(pointStatus({ ...point, level: 60 }, now), 'Atenção')
  assert.equal(pointStatus({ ...point, level: 100 }, now), 'Crítico')
  assert.equal(pointStatus({ ...point, level: null }, now), 'Sem leitura')
  assert.equal(pointStatus({ ...point, updatedAt: null }, now), 'Sem leitura')
  assert.equal(pointStatus({ ...point, updatedAt: 'invalid' }, now), 'Sem leitura')
  assert.equal(pointStatus(point, now + READING_STALE_MS + 1), 'Sem leitura')
  assert.equal(pointStatus({ ...point, demo: true, updatedAt: null }, now), 'Normal')
})
test('priority follows severity instead of relying on database order', () => {
  const warning = { ...point, id: 'b', level: 61 }
  const critical = { ...point, id: 'c', level: 101 }
  assert.equal(priorityPoint([point, warning, critical], now).id, 'c')
  assert.equal(priorityPoint([point, warning], now).id, 'b')
  assert.equal(priorityPoint([point, { ...point, id: 'offline', updatedAt: null }], now).id, 'offline')
  assert.equal(priorityPoint([], now), undefined)
})
