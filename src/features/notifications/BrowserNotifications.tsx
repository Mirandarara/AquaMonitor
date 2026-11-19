import { useEffect, useState, useSyncExternalStore } from 'react'
import { stationNotifications } from './notificationStore'
import { subscribeBrowserDelivery } from './browserDelivery'
const preferenceKey = 'aquamonitor.browser-notifications'
const listeners = new Set<() => void>()
const supported = () => typeof Notification !== 'undefined' && window.isSecureContext
const readEnabled = () => {
  try { return localStorage.getItem(preferenceKey) === 'enabled' } catch { return false }
}
let enabled = readEnabled()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const setEnabled = (next: boolean) => {
  enabled = next
  try { localStorage.setItem(preferenceKey, next ? 'enabled' : 'disabled') } catch { /* Session preference still works. */ }
  listeners.forEach(listener => listener())
}
export function BrowserNotificationDelivery() {
  const active = useSyncExternalStore(subscribe, () => enabled)
  useEffect(() => {
    if (!active || !supported()) return
    return subscribeBrowserDelivery(stationNotifications, item => {
      if (Notification.permission !== 'granted') return
      const notice = new Notification(`AquaMonitor · ${item.title}`, { body: item.message, tag: `aquamonitor-${item.id}` })
      notice.onclick = () => { window.focus(); notice.close() }
    })
  }, [active])
  return null
}
export function BrowserNotificationControl() {
  const active = useSyncExternalStore(subscribe, () => enabled)
  const [permission, setPermission] = useState(() => supported() ? Notification.permission : null)
  const [error, setError] = useState('')
  useEffect(() => {
    const refresh = () => setPermission(supported() ? Notification.permission : null)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const toggle = async () => {
    setError('')
    if (active && permission === 'granted') { setEnabled(false); return }
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      setEnabled(result === 'granted')
    } catch { setError('Não foi possível ativar. Os avisos continuam no Dashboard.') }
  }
  return <div className="station-browser-notifications">
    <strong>Notificações no navegador</strong>
    <p>Receba mudanças de nível, bombas, alarmes e perda de conexão do ESP32. Mantenha o Dashboard aberto, mesmo em outra aba.</p>
    <button type="button" disabled={!permission || permission === 'denied'} onClick={() => void toggle()}>{active && permission === 'granted' ? 'Desativar notificações' : 'Ativar notificações'}</button>
    <p role="status">{error || (!permission ? 'Use localhost ou HTTPS em um navegador com suporte a notificações.' : permission === 'denied' ? 'Permissão bloqueada. Libere as notificações nas configurações deste site no navegador.' : active && permission === 'granted' ? 'Ativadas para os novos eventos do ESP32.' : 'Os avisos continuam disponíveis no Dashboard.')}</p>
  </div>
}
