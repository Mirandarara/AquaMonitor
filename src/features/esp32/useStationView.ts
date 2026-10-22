import { useSimulation } from '../simulation/hooks/SimulationContext'
import type { SimulationState } from '../simulation/engine/simulation'
/** Read-only projection. Telemetry never becomes the source of virtual commands. */
export function useStationView(): SimulationState {
  const { state, mode, virtualInput, mqtt, fresh } = useSimulation()
  const t = mqtt.telemetry
  if (mode !== 'wokwi') return state
  const level = !virtualInput && t ? t.level_cm : state.galleryLiters
  return { ...state, galleryLiters: level,
    sensorFault: !virtualInput && t ? !t.sensor_ok : state.sensorFault,
    drainage: fresh && t ? t.drain_on ? 'on' : 'off' : 'blocked',
    reuse: fresh && t ? t.reuse_on ? 'on' : 'off' : 'blocked',
    risk: level >= 26 ? 'critical' : level >= 18 ? 'attention' : 'normal',
  }
}
