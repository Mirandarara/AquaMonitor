import type { StationNotificationStore, StationNotification } from './notificationStore.ts'
/** Forward only new, confirmed ESP32 events. Reading/dismissing history never replays it. */
export function subscribeBrowserDelivery(store: StationNotificationStore, deliver: (item: StationNotification) => void) {
  let lastId = Math.max(0, ...store.getSnapshot().items.map(item => item.id))
  return store.subscribe(() => {
    const fresh = store.getSnapshot().items.filter(item => item.id > lastId).reverse()
    lastId = Math.max(lastId, ...fresh.map(item => item.id))
    for (const item of fresh) {
      if (item.source !== 'wokwi') continue
      try { deliver(item) } catch { /* Dashboard history remains available if the OS rejects delivery. */ }
    }
  })
}
