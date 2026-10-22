import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { AquaMqttService, telemetryFresh } from '../src/features/esp32/mqttService.ts'
import { parseTelemetry, virtualCommand, MQTT_CONFIG as config } from '../src/features/esp32/protocol.ts'
import { createInitialState, simulationReducer as reduce } from '../src/features/simulation/engine/simulation.ts'
const telemetry = (patch = {}) => ({ level_cm: 22, level_pct: 73.3, distance_cm: 8, sensor_ok: true, drain_on: true, reuse_on: false, tank_full: false, tank_empty: false, alarm: false, alarm_code: 'none', input_mode: 'sensor', ...patch })
function setup() {
  const client = new EventEmitter()
  client.connected = true
  client.subscribe = (topics, options, callback) => { client.topics = topics; callback(null, topics.map(topic => ({topic, qos: 0}))) }
  client.published = []
  client.publish = (...args) => { client.published.push(args.slice(0, 3)); args[3]?.() }
  client.end = () => { client.ended = true }
  let calls = 0
  const service = new AquaMqttService(() => { calls++; return client })
  const receive = (t, retain = false) => client.emit('message', config.telemetry, Buffer.from(JSON.stringify(t)), { retain })
  service.start(); client.emit('connect')
  return {service, client, receive, calls: () => calls}
}
test('schema rejects malformed, partial, out-of-range and wrongly typed packets atomically', () => {
  assert.deepEqual(parseTelemetry(JSON.stringify(telemetry())), telemetry())
  for (const p of ['{', 'null', '[]', '{}', JSON.stringify(telemetry({ level_cm: 31 })), JSON.stringify(telemetry({ sensor_ok: 1 })), JSON.stringify(telemetry({ level_pct: 30 })), JSON.stringify(telemetry({ input_mode: 'unknown' }))]) assert.throws(() => parseTelemetry(p))
  assert.doesNotThrow(() => parseTelemetry(JSON.stringify(telemetry({ sensor_ok: false, distance_cm: -1 }))))
})
test('subscribes both topics, updates readings and pumps, rejects invalid/retained replays', () => {
  const {service, client, receive} = setup()
  assert.deepEqual(client.topics, [config.telemetry, config.status])
  receive(telemetry()); assert.equal(service.getSnapshot().telemetry.drain_on, true)
  receive(telemetry({level_cm: 10, level_pct:33.3, drain_on:false})); assert.equal(service.getSnapshot().telemetry.drain_on, false)
  const before = service.getSnapshot().telemetry
  receive({level_cm: 3}); assert.equal(service.getSnapshot().telemetry, before); assert.match(service.getSnapshot().error, /rejeitada/)
  receive(telemetry(), true); assert.equal(service.getSnapshot().telemetry, before)
  assert.equal(service.getSnapshot().samples.length, 2)
  service.stop()
})
test('freshness expires without allowing status online to prove fresh telemetry; reconnect resubscribes', () => {
  const {service, client, receive} = setup()
  receive(telemetry()); const at = service.getSnapshot().receivedAt
  assert.equal(telemetryFresh(service.getSnapshot(), at + 5999), true)
  assert.equal(telemetryFresh(service.getSnapshot(), at + 6000), false)
  client.emit('message', config.status, Buffer.from('offline'), {})
  assert.equal(telemetryFresh(service.getSnapshot(), at), false)
  client.emit('message', config.status, Buffer.from('online'), {})
  assert.equal(telemetryFresh(service.getSnapshot(), at), false)
  client.emit('reconnect'); assert.equal(service.getSnapshot().connection, 'reconnecting')
  client.emit('connect'); assert.equal(service.getSnapshot().connection, 'connected')
  assert.equal(service.getSnapshot().receivedAt, null)
  receive(telemetry()); assert.equal(telemetryFresh(service.getSnapshot(), Date.now()), true)
  service.stop()
})
test('commands match firmware, are not retained/queued offline, and listeners are removed', () => {
  const {service, client, calls} = setup()
  service.start(); assert.equal(calls(), 1)
  let updates = 0; const unsubscribe = service.subscribe(() => updates++)
  const command = virtualCommand(createInitialState())
  assert.deepEqual(command, {mode:'virtual', level_cm:8, tank_full:false, tank_empty:false, reuse_requested:false, sensor_ok:true})
  assert.equal(service.publish(command), true)
  assert.deepEqual(client.published[0], [config.commands, JSON.stringify(command), {qos:0,retain:false}])
  client.emit('close'); assert.equal(service.publish(command), false)
  client.emit('error',new Error('test failure')); assert.match(service.getSnapshot().error,/test failure/)
  unsubscribe(); const count = updates
  service.stop(); assert.equal(updates,count); assert.equal(client.eventNames().length,0); assert.equal(client.ended,true)
})
test('React rain -> command -> ESP32 decision drives hydraulic engine without overwriting volumes', () => {
  const {service, receive} = setup()
  let s = { ...createInitialState(), running:true, speed:1 }
  s = reduce(s, {type:'external',value:{drainage:'off',reuse:'off'}})
  s = reduce(s, {type:'rain',value:100})
  s = reduce(s, {type:'tick',seconds:250})
  const command = virtualCommand(s)
  assert.ok(command.level_cm > 20)
  // Firmware response emulated here, not a claim of a running Wokwi test.
  receive(telemetry({input_mode:'virtual',level_cm:command.level_cm,level_pct:command.level_cm/30*100}))
  const t = service.getSnapshot().telemetry
  const before = s.galleryLiters
  s = reduce(s,{type:'external',value:{drainage:t.drain_on?'on':'off',reuse:t.reuse_on?'on':'off'}})
  assert.equal(s.galleryLiters,before)
  assert.equal(s.drainage,'on')
  assert.equal(virtualCommand(s).level_cm,before)
  s = reduce(s,{type:'rain',value:0}); s = reduce(s,{type:'tick',seconds:1})
  assert.ok(s.galleryLiters<before)
  service.stop()
})
test('external pump decisions override local thresholds and reset; local mode restores autonomy', () => {
  let s = {...createInitialState(), running:true, speed:1, galleryLiters:24}
  s = reduce(s,{type:'external',value:{drainage:'off',reuse:'off'}})
  s = reduce(s,{type:'tick',seconds:10}); assert.equal(s.galleryLiters,24); assert.equal(s.drainage,'off')
  s = reduce(s,{type:'external',value:{drainage:'on',reuse:'off'}})
  s = reduce(s,{type:'reset'}); assert.equal(s.drainage,'on')
  s = reduce(s,{type:'external',value:undefined}); assert.equal(s.drainage,'off')
})

test('virtual heartbeat sends current inputs every 2 seconds during pause, stops cleanly', async context => {
  const { startCommandLoop } = await import('../src/features/esp32/commandLoop.ts')
  context.mock.timers.enable({apis:['setInterval']})
  let state = createInitialState()
  const commands = []
  const loop = startCommandLoop(command => commands.push(command), () => virtualCommand(state))
  assert.equal(commands.length,1)
  context.mock.timers.tick(2000); assert.equal(commands.length,2)
  state = {...state, galleryLiters:24, tankLiters:state.capacityLiters}
  context.mock.timers.tick(2000); assert.equal(commands.length,3)
  assert.equal(commands.at(-1).level_cm,24); assert.equal(commands.at(-1).tank_full,true)
  context.mock.timers.tick(6000); assert.equal(commands.length,6)
  loop.stop(); context.mock.timers.tick(10000); assert.equal(commands.length,6)
})
