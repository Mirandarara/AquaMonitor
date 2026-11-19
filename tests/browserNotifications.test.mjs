import test from 'node:test'
import assert from 'node:assert/strict'
import { StationNotificationStore } from '../src/features/notifications/notificationStore.ts'
import { subscribeBrowserDelivery } from '../src/features/notifications/browserDelivery.ts'
const reading = patch => ({source:'wokwi',available:true,level:8,drainage:false,reuse:false,alarms:[],...patch})
test('browser delivery ignores existing history and local simulation; delivers new ESP32 events once', () => {
  const store = new StationNotificationStore(), sent = []
  store.observe(reading())
  const stop = subscribeBrowserDelivery(store, item => sent.push(item))
  store.observe(reading({level:26,drainage:true}))
  assert.deepEqual(sent.map(item => item.title), ['Nível crítico na galeria','Bomba de drenagem acionada'])
  store.markAllRead(); store.observe(reading({level:26,drainage:true}))
  assert.equal(sent.length,2)
  store.observe(reading({available:false})); store.observe(reading({available:false}))
  assert.equal(sent.at(-1).title,'Telemetria indisponível')
  assert.equal(sent.length,3)
  store.observe(reading({source:'local',level:28,drainage:true})); assert.equal(sent.length,3)
  stop(); store.observe(reading()); assert.equal(sent.length,3)
})
test('browser API failures do not break dashboard event processing', () => {
  const store = new StationNotificationStore()
  const stop = subscribeBrowserDelivery(store, () => { throw new Error('OS rejected') })
  assert.doesNotThrow(() => store.observe(reading({level:27})))
  assert.equal(store.getSnapshot().items.length,2)
  stop()
})
