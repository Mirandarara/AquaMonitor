import type { SimulationState } from '../simulation/engine/simulation'
import type { Telemetry } from './protocol'
/** Received values only. Virtual inputs remain separate until acknowledged by ESP32. */
export function stationView(local: SimulationState, t: Telemetry | null, fresh: boolean): SimulationState {
  const level = t?.level_cm ?? 0
  return { ...local, galleryLiters: level, sensorFault: !t?.sensor_ok,
    running: fresh, rain: 0, tankLiters: 0,
    reuseRequested: t?.reuse_requested ?? false,
    drainage: fresh && t ? t.drain_on ? 'on' : 'off' : 'blocked',
    reuse: fresh && t ? t.reuse_on ? 'on' : 'off' : 'blocked',
    risk: level >= 26 ? 'critical' : level >= 18 ? 'attention' : 'normal',
  }
}
