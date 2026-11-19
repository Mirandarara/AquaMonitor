import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CircleAlert, FlaskConical, MapPin, RefreshCw, ShieldCheck, Waves } from 'lucide-react'
import { useSimulation } from '@/features/simulation/hooks/SimulationContext'
import { useStationView } from '@/features/esp32/useStationView'
import { galleryHeight } from '@/features/simulation/engine/simulation'
import { Esp32Panel } from '@/features/esp32/Esp32Panel'
import { NotificationFeed } from '@/features/notifications/Notifications'
import { useMonitoringPoints } from '../hooks/useMonitoringPoints'
import { pointStatus, priorityPoint, type DashboardPoint, type PointStatus } from '../data/monitoringModel'
import { fetchPointHistory } from '../data/monitoringRepository'

const tone: Record<PointStatus, string> = { Normal: 'normal', 'Atenção': 'warning', 'Crítico': 'critical', 'Sem leitura': 'unknown' }
function updated(point: DashboardPoint) {
  if (point.demo) return 'Exemplo de leitura'
  return point.updatedAt ? `Leitura às ${new Date(point.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando sensor'
}

function PointHistory({ point, samples, demo }: { point: DashboardPoint; samples?: { at: number; level: number }[]; demo: boolean }) {
  const [period, setPeriod] = useState(24)
  const [history, setHistory] = useState<{ at: number; level: number }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (demo || samples !== undefined) return
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError(''); setHistory([])
      try {
        const data = await fetchPointHistory(point.id, new Date(Date.now() - period * 3600_000).toISOString(), AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]))
        if (!controller.signal.aborted) setHistory(data)
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Falha ao carregar histórico.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [point.id, point.updatedAt, period, demo, samples])
  const values = samples ?? (demo ? [24, 31, 27, 40, 33, 48, 45, 59, 51, 62].map((level, i) => ({ at: i * 3600_000, level: Math.max(0, level + (point.level ?? 62) - 62) })) : history)
  const max = Math.max(point.critical * 1.15, ...values.map(s => s.level), 1)
  const first = values[0]?.at ?? 0
  const span = Math.max(1, (values.at(-1)?.at ?? first) - first)
  const coordinates = values.map(s => `${12 + (s.at - first) / span * 676},${140 - s.level / max * 125}`).join(' ')
  const currentStatus = pointStatus(point)
  return <article className="panel overview-history">
    <div className="panel-heading"><div><h2>Nível da água</h2><p>{point.name}</p></div>{samples === undefined && !demo && <div className="period-switch" aria-label="Período"><button type="button" className={period === 24 ? 'active' : ''} onClick={() => setPeriod(24)}>24h</button><button type="button" className={period === 168 ? 'active' : ''} onClick={() => setPeriod(168)}>7 dias</button></div>}</div>
    {loading ? <p className="overview-empty" role="status">Carregando histórico…</p> : error ? <p className="overview-empty" role="alert">{error}</p> : values.length < 2 ? <p className="overview-empty">O gráfico aparece após duas leituras.</p> : <><div className="overview-graph" role="img" aria-label={`Histórico de ${point.name}, ${demo ? 'dados de exemplo' : `${values.length} leituras`}`}><span>{Math.round(max)} cm</span><svg viewBox="0 0 700 160" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="level-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#169dba" stopOpacity=".17"/><stop offset="1" stopColor="#169dba" stopOpacity="0"/></linearGradient></defs>{[0, .5, 1].map(n => <line key={n} x1="12" x2="688" y1={15 + n * 125} y2={15 + n * 125} stroke="#edf0f3"/>)}<polygon points={`12,140 ${coordinates} 688,140`} fill="url(#level-area)"/><polyline points={coordinates} fill="none" stroke="#0d90a6" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/></svg><span>0 cm</span></div><div className="overview-chart-caption"><span>{demo ? 'Evolução ilustrativa' : `${new Date(first).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} → ${new Date(values.at(-1)!.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}</span><strong>{currentStatus === 'Sem leitura' ? '—' : `${point.level?.toFixed(1)} cm`} atual</strong></div></>}
  </article>
}

export function DashboardPage() {
  const { mode, mqtt, fresh } = useSimulation()
  const station = useStationView()
  const live = mode === 'wokwi'
  const database = useMonitoringPoints(!live)
  const [selectedId, setSelectedId] = useState('')
  const valid = fresh && mqtt.telemetry?.sensor_ok === true
  const livePoint: DashboardPoint = { id: 'esp32', name: 'Estação ESP32', location: 'Protótipo · Wi-Fi', level: valid ? galleryHeight(station) : null, updatedAt: mqtt.receivedAt ? new Date(mqtt.receivedAt).toISOString() : null, attention: 18, critical: 26 }
  const points = live ? [livePoint] : database.points
  const priority = priorityPoint(points)
  const selected = points.find(p => p.id === selectedId) ?? priority
  const statuses = points.map(p => pointStatus(p))
  const attention = statuses.filter(s => s === 'Atenção' || s === 'Crítico').length
  const normal = statuses.filter(s => s === 'Normal').length
  const unknown = statuses.filter(s => s === 'Sem leitura').length
  const unavailable = !live && (database.loading || Boolean(database.error))
  const demo = !live && database.demo
  const priorityStatus = priority ? pointStatus(priority) : null
  return <section className="page dashboard-page concise-dashboard">
    <header className="page-header"><div><p className="eyebrow">Seu monitoramento</p><h1>Visão geral</h1><p className="subtitle">Tudo o que precisa de atenção, em um só lugar.</p></div><Link to="/mapa" className="overview-primary"><MapPin size={16}/> Abrir mapa <ArrowUpRight size={16}/></Link></header>
    <div className="overview-source"><span className={`source-chip ${demo ? 'demo' : ''}`}><i/>{live ? valid ? 'ESP32 · leitura atual' : 'ESP32 · aguardando leitura' : demo ? 'Modo demonstração' : database.error ? 'Conexão indisponível' : database.loading ? 'Carregando pontos' : 'Dados do banco'}</span><span>{demo ? 'Dados ilustrativos' : live ? 'Telemetria da estação' : 'Atualização a cada 30 s'}</span></div>
    <details className="panel sim-technical"><summary>Conectar protótipo físico por Wi-Fi</summary><p>Conecte o ESP32 à internet, selecione a fonte ESP32 e entre com as credenciais MQTT do mesmo broker usado pela placa. Dashboard e maquete recebem as mesmas leituras.</p><Esp32Panel /></details>
    {database.error && !live && <div className="overview-error" role="alert"><span>{database.error}</span><button type="button" onClick={database.retry}><RefreshCw size={14}/> Tentar novamente</button></div>}
    <div className="overview-metrics" aria-label="Resumo do monitoramento">
      <article><span className="overview-metric-icon"><MapPin size={20}/></span><div><strong>{unavailable ? '—' : points.length}</strong><span>Pontos monitorados</span></div></article>
      <article><span className="overview-metric-icon normal"><ShieldCheck size={20}/></span><div><strong>{unavailable ? '—' : normal}</strong><span>Dentro do esperado</span></div></article>
      <article><span className={`overview-metric-icon ${attention ? 'warning' : ''}`}><CircleAlert size={20}/></span><div><strong>{unavailable ? '—' : attention}</strong><span>Requerem atenção{unknown > 0 && <small> · {unknown} sem leitura</small>}</span></div></article>
    </div>
    <div className="overview-main-grid">
      <article className="panel overview-points"><div className="panel-heading"><h2>Seus pontos</h2><Link className="text-button" to="/mapa">Ver mapa <ArrowRight size={14}/></Link></div>
        {points.length === 0 ? <div className="overview-empty"><MapPin size={28}/><strong>{database.loading ? 'Buscando pontos…' : database.error ? 'Pontos indisponíveis' : 'Nenhum ponto publicado'}</strong><span>{database.error ? 'Tente atualizar a conexão.' : 'Os pontos aparecem aqui quando estiverem disponíveis.'}</span></div> : <div className="overview-point-list">{points.map(p => { const status = pointStatus(p); return <button type="button" className={`overview-point ${selected?.id === p.id ? 'selected' : ''}`} key={p.id} onClick={() => setSelectedId(p.id)} aria-pressed={selected?.id === p.id}><span className="overview-point-pin"><MapPin size={18}/></span><span className="overview-point-name"><strong>{p.name}</strong><small>{updated(p)}</small></span><span className="overview-point-reading"><strong>{status === 'Sem leitura' ? '—' : p.level?.toFixed(1)} <small>cm</small></strong><span className={`overview-status ${tone[status]}`}>{status}</span></span></button> })}</div>}
      </article>
      <article className={`panel overview-priority ${priorityStatus ? tone[priorityStatus] : ''}`}><div className="overview-priority-label"><CircleAlert size={16}/><span>Agora no monitoramento</span></div><h2>{attention ? `${attention} ponto${attention > 1 ? 's' : ''} em atenção` : unknown ? 'Confira a conexão' : points.length ? 'Tudo dentro do esperado' : 'Pronto para monitorar'}</h2><p>{attention ? 'Acompanhe a evolução do nível neste local.' : unknown ? 'Há sensores sem leitura recente.' : points.length ? 'Nenhum ponto com nível elevado.' : 'Seus pontos aparecerão aqui.'}</p>{priority && <div className="overview-priority-point"><span>{priority.name}</span><strong>{priorityStatus === 'Sem leitura' ? '—' : priority.level?.toFixed(1)} <small>cm</small></strong><span className={`overview-status ${tone[priorityStatus!]}`}>{priorityStatus}</span></div>}<Link to={live ? '/simulacao' : '/mapa'} className="overview-priority-link">{live ? 'Abrir estação' : 'Explorar mapa'}<ArrowRight size={16}/></Link></article>
      {selected && <PointHistory key={selected.id} point={selected} samples={live ? mqtt.samples : undefined} demo={demo}/>}
      <article className="panel overview-activity"><div className="panel-heading"><h2>Atividade recente</h2><Link className="text-button" to="/alertas">Ver tudo <ArrowRight size={14}/></Link></div><NotificationFeed limit={3} compact/></article>
    </div>
    <Link to="/simulacao" className="overview-lab"><span className="overview-lab-icon"><FlaskConical size={23}/></span><span><strong>Explore a estação virtual</strong><small>Simulação, maquete 3D e conexão ESP32.</small></span><span className="overview-lab-action">Abrir laboratório <ArrowRight size={17}/></span></Link>
    <p className="overview-footnote"><Waves size={14}/>{demo ? 'Você está explorando um cenário de demonstração.' : 'As leituras apoiam o monitoramento dos pontos cadastrados.'}</p>
  </section>
}
