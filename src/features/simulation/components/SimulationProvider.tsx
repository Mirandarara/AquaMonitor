import { useEffect, useMemo, useReducer, useState, useRef, useSyncExternalStore, type PropsWithChildren } from 'react'
import { createInitialState, simulationReducer } from '../engine/simulation'
import { SimulationContext } from '../hooks/SimulationContext'

import { startCommandLoop } from '../../esp32/commandLoop'
import { aquaMqtt, telemetryFresh } from '../../esp32/mqttService'
import { virtualCommand } from '../../esp32/protocol'

export function SimulationProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(simulationReducer, undefined, createInitialState)
  const [mode, setMode] = useState<'local' | 'wokwi'>('local')
  const [virtualInput, setVirtualInput] = useState(false)
  const [now, clock] = useReducer(() => Date.now(), 0)
  const mqtt = useSyncExternalStore(aquaMqtt.subscribe, aquaMqtt.getSnapshot)
  const fresh = telemetryFresh(mqtt, now)
  const commandState = useRef(state)
  useEffect(() => { commandState.current = state }, [state])
  useEffect(() => {
    if (mode !== 'wokwi') return
    aquaMqtt.start()
    const timer = window.setInterval(clock, 500)
    return () => { window.clearInterval(timer); aquaMqtt.stop() }
  }, [mode])
  const drainOn = fresh && mqtt.telemetry?.drain_on === true
  const reuseOn = fresh && mqtt.telemetry?.reuse_on === true
  const matchingInput = mqtt.telemetry?.input_mode === (virtualInput ? 'virtual' : 'sensor')
  useEffect(() => {
    dispatch({ type: 'external', value: mode === 'wokwi' ? {
      drainage: fresh && matchingInput ? drainOn ? 'on' : 'off' : 'blocked', reuse: fresh && matchingInput ? reuseOn ? 'on' : 'off' : 'blocked',
    } : undefined })
  }, [mode, drainOn, reuseOn, matchingInput, fresh])
  useEffect(() => {
    if (mode !== 'wokwi' || mqtt.connection !== 'connected') return
    const loop = startCommandLoop(command => aquaMqtt.publish(command), () => virtualInput ? virtualCommand(commandState.current) : { mode: 'sensor' })
    const resume = () => { if (document.visibilityState === 'visible') loop.send() }
    document.addEventListener('visibilitychange', resume)
    return () => {
      loop.stop()
      document.removeEventListener('visibilitychange', resume)
      if (virtualInput) aquaMqtt.publish({ mode: 'sensor' })
    }
  }, [mode, virtualInput, mqtt.connection])
  useEffect(() => {
    if (!state.running || (mode === 'wokwi' && (!virtualInput || !fresh || !matchingInput))) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      if (mode === 'local' || now - previous < 1000) dispatch({ type: 'tick', seconds: (now - previous) / 1000 })
      previous = now
    }, 100)
    return () => window.clearInterval(timer)
  }, [state.running, mode, virtualInput, fresh, matchingInput])
  const value = useMemo(() => ({ state, dispatch, mode, setMode, virtualInput, setVirtualInput, mqtt, fresh }), [state, mode, virtualInput, mqtt, fresh])
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}
