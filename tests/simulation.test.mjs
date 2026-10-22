import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState, simulationReducer as reduce, galleryHeight } from '../src/features/simulation/engine/simulation.ts'

const initial = () => ({ ...createInitialState(), speed: 1 })
const running = (overrides = {}) => ({ ...initial(), running: true, ...overrides })
const tick = (s, seconds) => reduce(s, { type: 'tick', seconds })
function close(actual, expected, tolerance = 1e-8) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`) }
function balance(s) {
  close(s.galleryLiters + s.tankLiters, 13 + s.rainTotal + s.externalAddedTotal - s.reusedTotal - s.overflowTotal)
  assert.ok(s.galleryLiters >= 0 && s.galleryLiters <= 30)
  assert.ok(s.tankLiters >= 0 && s.tankLiters <= s.capacityLiters)
}
test('A: sem chuva e nível baixo, drenagem permanece desligada', () => {
  const s = tick(running(), 600)
  assert.equal(s.drainage, 'off'); close(s.galleryLiters, 8); balance(s)
})
test('B/C: tempestade aumenta o nível e aciona a drenagem ao atingir 20 cm', () => {
  let s = reduce(running(), { type: 'rain', value: 100 })
  s = tick(s, 239.75); assert.equal(s.drainage, 'off'); assert.ok(galleryHeight(s) < 20)
  s = tick(s, .5); assert.equal(s.drainage, 'on'); assert.ok(galleryHeight(s) >= 20)
  assert.ok(s.events.some(e => e.message === 'Drenagem: ligada.')); balance(s)
})
test('D: histerese mantém drenagem entre limites e desliga em 12 cm', () => {
  let s = tick(running({ galleryLiters: 20 }), .25)
  assert.equal(s.drainage, 'on')
  s = tick(s, 100); assert.equal(s.drainage, 'on'); assert.ok(galleryHeight(s) > 12)
  s = tick(s, 150); assert.equal(s.drainage, 'off'); close(galleryHeight(s), 12, .009)
  const off = tick(running({ galleryLiters: 16 }), 60); assert.equal(off.drainage, 'off')
})
test('E: reservatório cheio bloqueia imediatamente e impede transferência', () => {
  let s = tick(running({ galleryLiters: 22 }), 1)
  s = reduce(s, { type: 'fill' }); assert.equal(s.drainage, 'blocked'); assert.ok(s.alarms.includes('tank-full'))
  const volume = s.galleryLiters
  s = tick(s, 30); close(s.galleryLiters, volume); close(s.tankLiters, s.capacityLiters)
})
test('F/G: reúso reduz armazenamento a 1,2 L/min e bloqueia no vazio', () => {
  let s = reduce(running(), { type: 'reuse' }); assert.equal(s.reuse, 'on')
  s = tick(s, 60); close(s.tankLiters, 3.8); balance(s)
  s = tick(s, 600); close(s.tankLiters, 0); assert.equal(s.reuse, 'blocked'); assert.ok(s.alarms.includes('tank-empty')); balance(s)
})
test('H: falha do sensor desliga drenagem imediatamente e registra alarme', () => {
  let s = tick(running({ galleryLiters: 22 }), 1)
  s = reduce(s, { type: 'sensor', value: true }); assert.equal(s.drainage, 'blocked'); assert.ok(s.alarms.includes('sensor'))
  const volume = s.galleryLiters
  s = tick(s, 120); close(s.galleryLiters, volume)
  s = reduce(s, { type: 'sensor', value: false }); assert.equal(s.drainage, 'on'); assert.ok(!s.alarms.includes('sensor'))
})
test('J: reset restaura todos os controles, volumes, eventos e execução', () => {
  let s = reduce(running(), { type: 'rain', value: 100 }); s = tick(s, 300)
  s = reduce(s, { type: 'sensor', value: true }); s = reduce(s, { type: 'fill' })
  assert.deepEqual(reduce(s, { type: 'reset' }), createInitialState())
})
test('balanço com transbordamento, aporte externo, reúso e redução de capacidade', () => {
  let s = reduce(running(), { type: 'fill' }); s = reduce(s, { type: 'rain', value: 100 }); s = tick(s, 1200)
  assert.ok(s.overflowTotal > 0); assert.equal(s.risk, 'critical'); balance(s)
  s = reduce(s, { type: 'capacity', value: 10 }); balance(s)
  s = reduce(s, { type: 'reuse' }); s = tick(s, 900); balance(s)
})
test('delta e resíduo: mesmo resultado com ticks de frequências diferentes', () => {
  const s = running({ rain: 100 })
  const whole = tick(s, 420.13)
  let split = s
  for (let i = 0; i < 42013; i++) split = tick(split, .01)
  for (const key of ['time', 'remainder', 'galleryLiters', 'tankLiters', 'rainTotal', 'drainedTotal', 'overflowTotal']) close(split[key], whole[key])
  assert.deepEqual(split.events, whole.events); balance(split)
})
test('pausa congela tempo/volumes e continuidade retoma com aceleração', () => {
  let s = reduce(running({ rain: 100 }), { type: 'running', value: false })
  assert.deepEqual(tick(s, 100), s)
  s = reduce(s, { type: 'speed', value: 60 }); s = reduce(s, { type: 'running', value: true }); s = tick(s, 2)
  close(s.time, 120); close(s.galleryLiters, 14)
})
test('capacidade, chuva e velocidade rejeitam valores inválidos e respeitam limites', () => {
  for (const type of ['rain', 'speed', 'capacity']) assert.deepEqual(reduce(initial(), { type, value: NaN }), initial())
  assert.equal(reduce(initial(), { type: 'rain', value: 999 }).rain, 100)
  assert.equal(reduce(initial(), { type: 'capacity', value: -10 }).capacityLiters, 5)
  assert.equal(reduce(initial(), { type: 'speed', value: 0 }).speed, 1)
})
