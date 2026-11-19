import { useSimulation } from '../simulation/hooks/SimulationContext'
import { stationView } from './stationView'
export function useStationView() {
  const { state, mode, mqtt, fresh } = useSimulation()
  return mode === 'local' ? state : stationView(state, mqtt.telemetry, fresh)
}
