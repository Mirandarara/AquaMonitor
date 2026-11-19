// Local MQTT/WebSocket transport fixture. This does not claim to test the live Wokwi firmware.
import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import mqtt from 'mqtt'
import mqttPacket from 'mqtt-packet'
import { WebSocketServer } from 'ws'
import { createRequire } from 'node:module'
import { AquaMqttService, telemetryFresh } from '../src/features/esp32/mqttService.ts'
import { MQTT_CONFIG } from '../src/features/esp32/protocol.ts'
import { stationView } from '../src/features/esp32/stationView.ts'
import { createInitialState } from '../src/features/simulation/engine/simulation.ts'
import { shareDashboard } from '../src/features/simulation/engine/dashboardBridge.ts'
import { DashboardSimulationController } from '../prototype-3d/src/simulation/DashboardSimulationController.js'
import { Flow } from '../prototype-3d/src/scene/Water.js'
const require3d = createRequire(new URL('../prototype-3d/package.json', import.meta.url))
const { Group } = require3d('three')
async function until(predicate) {
  const deadline = Date.now() + 4000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Transport/bridge update timed out')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
test('mqtt.js -> subscribe -> JSON -> shared dashboard/3D -> command -> new telemetry, disconnect handoff', async () => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  await once(server, 'listening')
  let seq = 0, connected = 0, subscribed = [], commands = [], drain = false, stopped = false
  const payload = (patch = {}) => ({device:'local-test-esp32', input_mode:'sensor', level_cm:8, level_pct:8/30*100, distance_cm:22, tank_full:false, tank_empty:true, reuse_requested:false, sensor_ok:true, drain_on:false, reuse_on:false, alarm:false, alarm_code:'none', wifi_connected:true, mqtt_connected:true, seq:seq++, uptime_ms:1000+seq*100, ...patch})
  server.on('connection', socket => {
    const parser = mqttPacket.parser()
    const send = packet => socket.send(mqttPacket.generate(packet))
    const publish = (topic, value) => send({cmd:'publish', topic, payload:typeof value === 'string' ? value : JSON.stringify(value), qos:0, retain:false, dup:false})
    parser.on('packet', packet => {
      if (packet.cmd === 'connect') { connected++; send({cmd:'connack', returnCode:0, sessionPresent:false}) }
      if (packet.cmd === 'subscribe') {
        subscribed = packet.subscriptions.map(s => s.topic)
        send({cmd:'suback', messageId:packet.messageId, granted:packet.subscriptions.map(() => 0)})
        publish(MQTT_CONFIG.status,'online')
        publish(MQTT_CONFIG.telemetry,payload())
      }
      if (packet.cmd === 'publish' && packet.topic === MQTT_CONFIG.commands) {
        const command = JSON.parse(packet.payload.toString()); commands.push(command)
        if (command.mode === 'sensor') { if (!stopped) publish(MQTT_CONFIG.telemetry,payload()); return }
        const alarm = !command.sensor_ok || command.tank_full || command.tank_full && command.tank_empty
        drain = !alarm && (command.level_cm >= 20 || drain && command.level_cm > 12)
        publish(MQTT_CONFIG.telemetry,payload({...command, input_mode:'virtual', level_pct:command.level_cm/30*100, distance_cm:30-command.level_cm, drain_on:drain, reuse_on:command.reuse_requested && !command.tank_empty, alarm, alarm_code:alarm?'protection':'none'}))
      }
      if (packet.cmd === 'disconnect') socket.close()
      if (packet.cmd === 'pingreq') send({cmd:'pingresp'})
    })
    socket.on('message', data => parser.parse(data))
  })
  const service = new AquaMqttService((_url, options) => mqtt.connect(`ws://127.0.0.1:${server.address().port}/mqtt`, options))
  const sim = new DashboardSimulationController({start(){assert.fail('3D must not connect')},stop(){},publish(){assert.fail('3D must not publish')}})
  const flow = new Flow(new Group(), [[0,0,0],[1,1,1]], 'drain', 0x2288aa)
  let stopSharing
  try {
    sim.setMode('dashboard')
    stopSharing = shareDashboard(() => ({mqtt:service.getSnapshot()}))
    service.start({username:'local-test-only',password:'not-a-broker-credential'})
    service.start({username:'local-test-only',password:'not-a-broker-credential'})
    await until(() => service.getSnapshot().telemetry !== null)
    assert.equal(connected,1)
    assert.deepEqual(subscribed,[MQTT_CONFIG.telemetry,MQTT_CONFIG.status])
    assert.equal(telemetryFresh(service.getSnapshot(),Date.now()),true)
    await until(() => sim.view().levelCm === 8)
    const command = {mode:'virtual',level_cm:22,tank_full:false,tank_empty:true,reuse_requested:false,sensor_ok:true}
    service.publish({...command,drain_on:false,reuse_on:true})
    await until(() => service.getSnapshot().telemetry.level_cm === 22)
    assert.deepEqual(commands.at(-1),command)
    assert.equal(stationView(createInitialState(),service.getSnapshot().telemetry,true).galleryLiters,22)
    await until(() => sim.view().drainFlow)
    assert.equal(sim.view().dam,null)
    flow.update(.1,sim.view().drainFlow); assert.equal(flow.dots.visible,true)
    service.publish({...command,level_cm:16})
    await until(() => service.getSnapshot().telemetry.level_cm === 16)
    assert.equal(service.getSnapshot().telemetry.drain_on,true)
    service.publish({...command,level_cm:12})
    await until(() => service.getSnapshot().telemetry.level_cm === 12)
    assert.equal(service.getSnapshot().telemetry.drain_on,false)
    await until(() => sim.view().drain === 'off')
    flow.update(.1,sim.view().drainFlow); assert.equal(flow.dots.visible,false)
    service.publish({...command,level_cm:22,sensor_ok:false})
    await until(() => service.getSnapshot().telemetry.alarm)
    assert.equal(service.getSnapshot().telemetry.drain_on,false)
    assert.equal(telemetryFresh(service.getSnapshot(),service.getSnapshot().receivedAt+MQTT_CONFIG.staleMs),false)
    service.publish({...command,tank_empty:false,reuse_requested:true})
    await until(() => service.getSnapshot().telemetry.reuse_on)
    await until(() => sim.view().reuseFlow)
    stopped = true; service.stop()
    await until(() => commands.at(-1)?.mode === 'sensor')
    assert.equal(service.getSnapshot().connection,'offline')
    await until(() => !sim.view().fresh)
  } finally {
    stopSharing?.(); sim.dispose(); service.stop()
    for (const socket of server.clients) socket.terminate()
    await new Promise(resolve => server.close(resolve))
  }
})
