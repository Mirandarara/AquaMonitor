import { useEffect, useMemo, useReducer, useState, useRef, useSyncExternalStore, type PropsWithChildren } from 'react'
import { createInitialState, simulationReducer } from '../engine/simulation'
import { SimulationContext } from '../hooks/SimulationContext'
import { stationNotifications } from '../../notifications/notificationStore'
import { shareDashboard } from '../engine/dashboardBridge'

import { startCommandLoop } from '../../esp32/commandLoop'
import { aquaMqtt, telemetryFresh } from '../../esp32/mqttService'
import type { VirtualCommand } from '../../esp32/protocol'

export function SimulationProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(simulationReducer, undefined, createInitialState)
  const [mode, setMode] = useState<'local' | 'wokwi'>('local')
  const [virtualInput, setVirtualInput] = useState(false)
  const [virtualControls, setVirtualControls] = useState<VirtualCommand>({ mode: 'virtual', level_cm: 22, tank_full: false, tank_empty: true, reuse_requested: false, sensor_ok: true })
  const [now, clock] = useReducer(() => Date.now(), 0, () => Date.now())
  const mqtt = useSyncExternalStore(aquaMqtt.subscribe, aquaMqtt.getSnapshot)
  const fresh = telemetryFresh(mqtt, now)
  useEffect(() => {
    const t = mqtt.telemetry
    stationNotifications.observe(mode === 'local' ? {
      source: 'local', available: true, level: state.sensorFault ? null : state.galleryLiters,
      drainage: state.drainage === 'on', reuse: state.reuse === 'on', alarms: state.alarms,
    } : {
      source: 'wokwi', available: fresh, level: t?.sensor_ok ? t.level_cm : null,
      drainage: t?.drain_on ?? false, reuse: t?.reuse_on ?? false,
      alarms: t?.alarm ? [t.alarm_code] : t && !t.sensor_ok ? ['sensor_failure'] : [],
    })
  }, [mode, state, mqtt, fresh])
  const inputs = useRef(virtualControls)
  useEffect(() => { inputs.current = virtualControls }, [virtualControls])
  const commandState = useRef(state)
  useEffect(() => { commandState.current = state }, [state])
  useEffect(() => shareDashboard(() => mode === 'local' ? commandState.current : { mqtt: aquaMqtt.getSnapshot() }), [mode])
  useEffect(() => {
    if (mode !== 'wokwi') return
    const stop = () => aquaMqtt.stop()
    window.addEventListener('pagehide', stop)
    const timer = window.setInterval(clock, 250)
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', stop); aquaMqtt.stop() }
  }, [mode])
  useEffect(() => {
    if (mode !== 'wokwi' || mqtt.connection !== 'connected') return
    if (!virtualInput) { aquaMqtt.publish({ mode: 'sensor' }); return }
    const loop = startCommandLoop(command => aquaMqtt.publish(command), () => inputs.current)
    const resume = () => { if (document.visibilityState === 'visible') loop.send() }
    document.addEventListener('visibilitychange', resume)
    return () => {
      loop.stop()
      document.removeEventListener('visibilitychange', resume)
      if (virtualInput) aquaMqtt.publish({ mode: 'sensor' })
    }
  }, [mode, virtualInput, mqtt.connection])
  useEffect(() => {
    if (!state.running || mode !== 'local') return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      dispatch({ type: 'tick', seconds: (now - previous) / 1000 })
      previous = now
    }, 100)
    return () => window.clearInterval(timer)
  }, [state.running, mode])
  const value = useMemo(() => ({ state, dispatch, mode, setMode, virtualInput, setVirtualInput, virtualControls, setVirtualControls, mqtt, fresh }), [state, mode, virtualInput, virtualControls, mqtt, fresh])
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}
