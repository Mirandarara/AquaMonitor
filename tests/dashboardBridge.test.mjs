import test from 'node:test'
import assert from 'node:assert/strict'
import { shareDashboard, DASHBOARD_STALE_MS } from '../src/features/simulation/engine/dashboardBridge.ts'
import { createInitialState, simulationReducer } from '../src/features/simulation/engine/simulation.ts'
import { DashboardSimulationController as SimulationController } from '../prototype-3d/src/simulation/DashboardSimulationController.js'

test('dashboard shares its running model with 3D, including pause, reset and loss of updates', async () => {
  let state = createInitialState()
  const sim = new SimulationController({ start() {}, stop() {} })
  const receive = (predicate) => new Promise((resolve, reject) => {
    const deadline = Date.now() + 2000
    const timer = setInterval(() => {
      if (predicate()) { clearInterval(timer); resolve() }
      else if (Date.now() > deadline) { clearInterval(timer); reject(new Error('No dashboard update')) }
    }, 10)
  })
  let stop
  try {
    sim.setMode('dashboard')
    assert.equal(sim.view().fresh, false)
    stop = shareDashboard(() => state)
    await receive(() => sim.view().fresh)
    state = simulationReducer(state, { type: 'rain', value: 100 })
    state = simulationReducer(state, { type: 'running', value: true })
    state = simulationReducer(state, { type: 'tick', seconds: 12 })
    await receive(() => sim.state.galleryLiters === state.galleryLiters)
    assert.equal(sim.state.galleryLiters, state.galleryLiters)
    assert.equal(sim.view().drain, state.drainage)
    assert.equal(sim.view().rain, 1)
    const volume = sim.state.galleryLiters
    sim.tick(10)
    assert.equal(sim.state.galleryLiters, volume)
    state = simulationReducer(state, { type: 'running', value: false })
    await receive(() => !sim.state.running)
    assert.equal(sim.view().running, false)
    state = simulationReducer(state, { type: 'reset' })
    await receive(() => sim.state.galleryLiters === 8)
    assert.equal(sim.state.galleryLiters, 8)
    assert.equal(sim.view(sim.dashboardAt + DASHBOARD_STALE_MS).drain, 'unknown')
    state = { mqtt: {
      connection: 'connected', deviceStatus: 'online', receivedAt: Date.now(),
      telemetry: { level_cm: 22, level_pct: 73.3, sensor_ok: true, drain_on: true, reuse_on: false, tank_full: false, tank_empty: false, alarm: false, alarm_code: 'none', input_mode: 'sensor' },
    } }
    await receive(() => sim.bridge.mqtt !== null)
    assert.equal(sim.view().drain, 'on')
    assert.equal(sim.view().input, 'Sensor HC-SR04')
    assert.equal(sim.view().level, 0.733)
    assert.equal(sim.view(sim.dashboardAt + DASHBOARD_STALE_MS).drain, 'unknown')
    state.mqtt = { ...state.mqtt, receivedAt: null, connection: 'offline' }
    await receive(() => sim.view().drain === 'unknown')
    state = null
    await receive(() => !sim.view().fresh)
    assert.equal(sim.view().fresh, false)
  } finally {
    stop?.()
    sim.dispose()
  }
})
