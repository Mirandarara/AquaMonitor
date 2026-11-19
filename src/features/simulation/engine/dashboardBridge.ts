import type { SimulationState } from './simulation'
import type { MqttSnapshot } from '../../esp32/mqttService'

export type DashboardState = SimulationState | { mqtt: MqttSnapshot }

export const DASHBOARD_CHANNEL = 'aquamonitor-local-simulation-v1'
export const DASHBOARD_STALE_MS = 4000

export function shareDashboard(getState: () => DashboardState | null, channel = new BroadcastChannel(DASHBOARD_CHANNEL)) {
  const send = () => channel.postMessage({ type: 'state', state: getState() })
  channel.onmessage = event => { if (event.data?.type === 'request') send() }
  const timer = setInterval(send, 250)
  send()
  return () => { clearInterval(timer); channel.close() }
}

export function followDashboard(onState: (state: DashboardState | null) => void, channel = new BroadcastChannel(DASHBOARD_CHANNEL)) {
  channel.onmessage = event => {
    if (event.data?.type === 'state') onState(event.data.state)
  }
  channel.postMessage({ type: 'request' })
  return () => channel.close()
}
