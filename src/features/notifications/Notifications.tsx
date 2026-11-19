import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, Check, Info, TriangleAlert, CircleAlert, CircleCheck, X } from 'lucide-react'
import { stationNotifications, type StationNotification } from './notificationStore'
import { useNotifications } from './useNotifications'
import './notifications.css'
import { BrowserNotificationControl, BrowserNotificationDelivery } from './BrowserNotifications'
const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, critical: CircleAlert }
const sourceLabel = (item: StationNotification) => item.source === 'wokwi' ? 'ESP32 / Wi-Fi' : 'Simulação local'
function NotificationItem({ item }: { item: StationNotification }) {
  const Icon = icons[item.tone]
  return <article className={`station-notification ${item.tone} ${item.read ? '' : 'unread'}`}>
    <Icon size={20} aria-hidden="true" />
    <div><strong>{item.title}</strong><p>{item.message}</p><small>{sourceLabel(item)} • <time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleTimeString('pt-BR')}</time>{item.read ? ' • Lida' : ' • Não lida'}</small></div>
    {!item.read && <button type="button" aria-label={`Marcar como lida: ${item.title}`} onClick={() => stationNotifications.markRead(item.id)}><Check size={17} /></button>}
  </article>
}
export function NotificationFeed({ limit = 100, compact = false }: { limit?: number; compact?: boolean }) {
  const { items } = useNotifications()
  return <div className="station-notification-list">{items.length ? items.slice(0, limit).map(item => <NotificationItem key={item.id} item={item} />) : <p className="station-notification-empty">{compact ? 'Nenhuma novidade por aqui.' : 'Nenhuma notificação nesta sessão. Avisos aparecem quando o nível muda de faixa, uma bomba muda de estado ou há alarmes e perda de telemetria.'}</p>}</div>
}
export function NotificationBell({ onClick, className = '', expanded = false }: { onClick: () => void; className?: string; expanded?: boolean }) {
  const { items } = useNotifications()
  const unread = items.filter(item => !item.read).length
  return <button type="button" className={`station-notification-bell ${className}`} aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded ? "station-notification-center" : undefined} aria-label={`Abrir notificações${unread ? ` (${unread} não lidas)` : ''}`} onClick={onClick}><Bell size={22} />{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</button>
}
function Toast({ item }: { item: StationNotification }) {
  useEffect(() => { const timer = window.setTimeout(() => stationNotifications.dismissToast(item.id), Math.max(0, item.createdAt + 8000 - Date.now())); return () => window.clearTimeout(timer) }, [item.id, item.createdAt])
  const Icon = icons[item.tone]
  return <div className={`station-toast ${item.tone}`} role={item.tone === 'critical' ? 'alert' : 'status'}><Icon size={22} /><div><strong>{item.title}</strong><p>{item.message}</p><small>{sourceLabel(item)}</small></div><button type="button" aria-label={`Fechar aviso: ${item.title}`} onClick={() => stationNotifications.dismissToast(item.id)}><X size={17} /></button></div>
}
export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, toastIds } = useNotifications()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [open, onClose])
  return <><BrowserNotificationDelivery />{open && <><button className="station-notification-backdrop" aria-label="Fechar central de notificações" onClick={onClose} /><aside className="station-notification-center" id="station-notification-center" role="dialog" aria-label="Notificações da estação"><header><div><h2>Notificações</h2><p>{items.filter(item => !item.read).length} não lidas • histórico desta sessão</p></div><button ref={closeRef} aria-label="Fechar notificações" onClick={onClose}><X /></button></header><button className="station-mark-all" onClick={stationNotifications.markAllRead}><CheckCheck size={17} />Marcar todas como lidas</button><BrowserNotificationControl /><NotificationFeed /></aside></>}
    {!open && <div className="station-toasts" aria-label="Avisos recentes">{toastIds.map(id => items.find(item => item.id === id)).filter((item): item is StationNotification => !!item).map(item => <Toast key={item.id} item={item} />)}</div>}
  </>
}
export function StationNotificationHistory() {
  const { items } = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const visible = items.filter(item => filter === 'all' || !item.read)
  return <article className="panel station-notification-history"><div className="panel-heading"><div><h2><Bell size={20} /> Notificações da estação</h2><p>Níveis, bombas, alarmes e conexão • últimos 100 eventos da sessão.</p></div><button className="text-button" onClick={stationNotifications.markAllRead}><CheckCheck size={17} />Marcar todas como lidas</button></div><div className="station-notification-filters"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todas ({items.length})</button><button aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Não lidas ({items.filter(item => !item.read).length})</button></div>{visible.length ? visible.map(item => <NotificationItem key={item.id} item={item} />) : <p className="station-notification-empty">{items.length ? 'Todas as notificações foram lidas.' : 'Nenhum evento recebido nesta sessão.'}</p>}</article>
}
