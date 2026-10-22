import { MQTT_CONFIG, type Command } from './protocol.ts'
/** Read the latest hydraulic inputs each time, independent of simulation speed/pause. */
export function startCommandLoop(publish: (command: Command) => unknown, read: () => Command) {
  const send = () => { publish(read()) }
  send()
  const timer = setInterval(send, MQTT_CONFIG.commandIntervalMs)
  return { send, stop: () => clearInterval(timer) }
}
