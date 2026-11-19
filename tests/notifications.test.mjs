import test from 'node:test'
import assert from 'node:assert/strict'
import { StationNotificationStore } from '../src/features/notifications/notificationStore.ts'
const reading = (patch = {}) => ({ source:'wokwi',available:true,level:8,drainage:false,reuse:false,alarms:[],...patch })
const items = store => store.getSnapshot().items
const titles = store => items(store).map(item => item.title)
test('notifies confirmed threshold changes, not every MQTT packet; invalid sensor level is ignored', () => {
  const store = new StationNotificationStore()
  store.observe(reading())
  for (let i=0;i<100;i++) store.observe(reading())
  assert.equal(items(store).length,1)
  store.observe(reading({level:18})); assert.equal(items(store)[0].title,'Nível em atenção')
  store.observe(reading({level:24})); assert.equal(items(store).length,2)
  store.observe(reading({level:26})); assert.equal(items(store)[0].tone,'critical')
  store.observe(reading({level:17})); assert.equal(items(store)[0].title,'Nível normalizado')
  const before = items(store).length
  store.observe(reading({level:null})); assert.equal(items(store).length,before)
})
test('drainage and reuse transitions notify once; stale data never becomes an off command', () => {
  const store = new StationNotificationStore()
  store.observe(reading())
  store.observe(reading({drainage:true,reuse:true}))
  assert.ok(titles(store).includes('Bomba de drenagem acionada'))
  assert.ok(titles(store).includes('Circuito de reúso acionado'))
  const before = items(store).length
  store.observe(reading({drainage:true,reuse:true})); assert.equal(items(store).length,before)
  store.observe(reading({available:false}))
  store.observe(reading({available:false}))
  assert.equal(items(store).length,before+1)
  assert.equal(titles(store).some(title=>title.includes('desligad')),false)
  store.observe(reading({drainage:true,reuse:true}))
  assert.ok(titles(store).includes('Telemetria restabelecida'))
  assert.equal(titles(store).filter(title=>title==='Bomba de drenagem acionada').length,1)
  store.observe(reading())
  assert.ok(titles(store).includes('Bomba de drenagem desligada'))
  assert.ok(titles(store).includes('Circuito de reúso desligado'))
})
test('alarms notify on activation and change, and record recovery without repeating steady faults', () => {
  const store = new StationNotificationStore()
  store.observe(reading({alarms:['sensor_failure'],level:null}))
  const before = items(store).length
  store.observe(reading({alarms:['sensor_failure'],level:null})); assert.equal(items(store).length,before)
  store.observe(reading({alarms:['float_conflict']}))
  assert.match(items(store)[0].message,/Conflito entre boias/)
  store.observe(reading()); assert.equal(items(store)[0].title,'Alarmes normalizados')
})
test('source changes do not produce fabricated pump transitions; local simulation is labelled', () => {
  const store = new StationNotificationStore()
  store.observe(reading({drainage:true}))
  store.observe(reading({source:'local'}))
  assert.equal(titles(store).some(title=>title.includes('desligada')),false)
  store.observe(reading({source:'local',level:20,drainage:true}))
  assert.equal(items(store)[0].source,'local')
  assert.match(items(store)[0].message,/simulação local/)
})
test('initial active pumps are described as observed state, without inventing an activation time', () => {
  const store = new StationNotificationStore()
  store.observe(reading({drainage:true,level:27}))
  assert.ok(titles(store).includes('Bomba de drenagem em operação'))
  assert.ok(titles(store).includes('Nível crítico na galeria'))
  assert.equal(titles(store).includes('Bomba de drenagem acionada'),false)
})
test('read and toast dismissal are separate; history bounded to 100 and cleanup unsubscribes', () => {
  const store = new StationNotificationStore()
  let changes=0; const unsubscribe = store.subscribe(()=>changes++)
  store.observe(reading()); const id=items(store)[0].id
  store.dismissToast(id); assert.equal(items(store)[0].read,false); assert.deepEqual(store.getSnapshot().toastIds,[])
  store.markRead(id); assert.equal(items(store)[0].read,true)
  for(let i=0;i<120;i++) store.observe(reading({drainage:i%2===0}))
  assert.equal(items(store).length,100)
  assert.ok(store.getSnapshot().toastIds.length<=3)
  store.markAllRead(); assert.ok(items(store).every(item=>item.read)); assert.deepEqual(store.getSnapshot().toastIds,[])
  const count=changes; unsubscribe(); store.observe(reading({level:30})); assert.equal(changes,count)
})

test('first valid telemetry after waiting is labelled as first reception, not recovery', () => {
  const store = new StationNotificationStore()
  store.observe(reading({available:false}))
  store.observe(reading())
  assert.equal(items(store)[0].title,'ESP32 transmitindo')
})
