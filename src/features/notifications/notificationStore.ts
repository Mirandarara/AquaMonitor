export type NotificationSource = 'local' | 'wokwi'
export type NotificationTone = 'info' | 'success' | 'warning' | 'critical'
export interface StationObservation {
  source: NotificationSource
  available: boolean
  level: number | null
  drainage: boolean
  reuse: boolean
  alarms: string[]
}
export interface StationNotification {
  id: number
  source: NotificationSource
  tone: NotificationTone
  title: string
  message: string
  createdAt: number
  read: boolean
}
export interface NotificationSnapshot {
  items: StationNotification[]
  toastIds: number[]
}
const levelBand = (level: number) => level >= 26 ? 2 : level >= 18 ? 1 : 0
const alarmLabels: Record<string, string> = {
  sensor_failure: 'Falha do sensor', float_conflict: 'Conflito entre boias', tank_full: 'Boia de destino cheio', reuse_without_water: 'Reúso sem água',
  sensor: 'Falha do sensor', 'tank-full': 'Destino cheio', 'tank-empty': 'Destino vazio', 'gallery-full': 'Galeria no limite',
}
/** Session-only events. Compare confirmed observations; never infer relay changes from stale data. */
export class StationNotificationStore {
  private snapshot: NotificationSnapshot = { items: [], toastIds: [] }
  private listeners = new Set<() => void>()
  private previous: StationObservation | null = null
  private sequence = 0
  private seenAvailable = new Set<NotificationSource>()
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(snapshot: NotificationSnapshot) { this.snapshot = snapshot; this.listeners.forEach(fn => fn()) }
  private add(source: NotificationSource, tone: NotificationTone, title: string, message: string, at: number) {
    const item: StationNotification = { id: ++this.sequence, source, tone, title, message, createdAt: at, read: false }
    this.update({ items: [item, ...this.snapshot.items].slice(0, 100), toastIds: [...this.snapshot.toastIds, item.id].slice(-3) })
  }
  observe(next: StationObservation, at = Date.now()) {
    const previous = this.previous?.source === next.source ? this.previous : null
    // Store independent copies: callers may reuse their observation arrays.
    this.previous = { ...next, alarms: [...next.alarms] }
    const emit = (tone: NotificationTone, title: string, message: string) => this.add(next.source, tone, title, message, at)
    if (!next.available) {
      if (previous?.available) emit('warning', 'Telemetria indisponível', 'Sem dados atuais do ESP32. O estado das bombas é desconhecido até uma nova leitura válida.')
      return
    }
    const baseline = previous?.available ? previous : null
    if (next.source === 'wokwi' && !baseline) emit('success', previous && this.seenAvailable.has(next.source) ? 'Telemetria restabelecida' : 'ESP32 transmitindo', 'Recebendo leituras atuais do ESP32 por Wi-Fi.')
    this.seenAvailable.add(next.source)
    if (next.level !== null) {
      const band = levelBand(next.level)
      const oldBand = baseline?.level !== null && baseline?.level !== undefined ? levelBand(baseline.level) : null
      if (band !== oldBand && (band > 0 || oldBand !== null && oldBand > 0)) {
        emit(band === 2 ? 'critical' : band === 1 ? 'warning' : 'success',
          band === 2 ? 'Nível crítico na galeria' : band === 1 ? 'Nível em atenção' : 'Nível normalizado',
          `Galeria em ${next.level.toFixed(1)} cm de 30 cm. ${band === 2 ? 'Faixa crítica: ≥26 cm.' : band === 1 ? 'Faixa de atenção: ≥18 cm.' : 'Nível abaixo de 18 cm.'}`)
      }
    }
    for (const [key, name] of [['drainage', 'Bomba de drenagem'], ['reuse', 'Circuito de reúso']] as const) {
      if (baseline ? baseline[key] !== next[key] : next[key]) {
        emit(next[key] ? 'info' : 'success', `${name} ${next[key] ? baseline ? key === 'drainage' ? 'acionada' : 'acionado' : 'em operação' : key === 'drainage' ? 'desligada' : 'desligado'}`,
          next.source === 'wokwi' ? 'Estado confirmado pela telemetria do controlador ESP32.' : 'Estado calculado pela simulação local.')
      }
    }
    for (const alarm of next.alarms) if (!baseline?.alarms.includes(alarm)) emit('critical', 'Alarme da estação', `${alarmLabels[alarm] ?? alarm}. ${next.source === 'wokwi' ? 'Informado pelo ESP32.' : 'Simulação local.'}`)
    if (baseline?.alarms.length && !next.alarms.length) emit('success', 'Alarmes normalizados', 'A estação deixou de informar alarmes ativos.')
  }
  markRead = (id: number) => this.update({ ...this.snapshot, items: this.snapshot.items.map(item => item.id === id ? { ...item, read: true } : item), toastIds: this.snapshot.toastIds.filter(item => item !== id) })
  markAllRead = () => this.update({ items: this.snapshot.items.map(item => ({ ...item, read: true })), toastIds: [] })
  dismissToast = (id: number) => this.update({ ...this.snapshot, toastIds: this.snapshot.toastIds.filter(item => item !== id) })
}
export const stationNotifications = new StationNotificationStore()
