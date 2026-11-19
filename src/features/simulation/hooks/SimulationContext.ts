import { createContext, useContext, type Dispatch } from 'react'
import type { VirtualCommand } from '../../esp32/protocol'
import type { MqttSnapshot } from '../../esp32/mqttService'
import type { SimulationAction, SimulationState } from '../engine/simulation'

export const SimulationContext = createContext<{ state: SimulationState; dispatch: Dispatch<SimulationAction>; mode: 'local' | 'wokwi'; setMode: (mode: 'local' | 'wokwi') => void; virtualInput: boolean; setVirtualInput: (value: boolean) => void; virtualControls: VirtualCommand; setVirtualControls: Dispatch<import('react').SetStateAction<VirtualCommand>>; mqtt: MqttSnapshot; fresh: boolean } | null>(null)
export function useSimulation() {
  const context = useContext(SimulationContext)
  if (!context) throw new Error('useSimulation requer SimulationProvider')
  return context
}
