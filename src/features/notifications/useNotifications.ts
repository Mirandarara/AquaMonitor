import { useSyncExternalStore } from 'react'
import { stationNotifications } from './notificationStore'
export const useNotifications = () => useSyncExternalStore(stationNotifications.subscribe, stationNotifications.getSnapshot)
