import { useId } from 'react'
import { Cylinder, ChartNoAxesCombined } from 'lucide-react'
import { formatTime } from '../engine/simulation'

export interface StationSample { time: number; gallery: number; tank: number }
export function SimulationChart({ samples, kind, max, value, live = false, available = true }: { live?: boolean; available?: boolean; samples: StationSample[]; kind: 'gallery' | 'tank'; max: number; value: number }) {
  const id = useId().replaceAll(':', '')
  const first = samples[0]?.time ?? 0
  const end = samples.at(-1)?.time ?? first
  const span = Math.max(60, end - first)
  const points = samples.map(sample => `${40 + (sample.time - first) / span * 350},${145 - Math.min(1, sample[kind] / max) * 110}`)
  const lastX = samples.length ? 40 + (end - first) / span * 350 : 40
  const y = 145 - Math.min(1, value / max) * 110
  const unit = kind === 'gallery' ? 'cm' : 'L'
  const title = kind === 'gallery' ? 'Nível da galeria de coleta' : 'Volume da barragem'
  const Icon = kind === 'gallery' ? ChartNoAxesCombined : Cylinder
  return <article className={`panel sim-chart sim-chart-${kind}`}>
    <div className="sim-card-heading"><h2><Icon size={19} />{title}</h2><span>{kind === 'gallery' ? 'Escala: 0–30 cm' : `Capacidade: ${max} L`}</span></div>
    <svg viewBox="0 0 420 180" role="img" aria-label={`${title}: ${available ? value.toFixed(1) + ' ' + unit : 'Sem leitura atual'}. Histórico desta sessão.`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={kind === 'gallery' ? '#32b3fa' : '#09b9d2'} stopOpacity=".6" /><stop offset="1" stopColor="#63d8ed" stopOpacity=".12" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => <g key={i}><path d={`M40 ${145-i*36.67}H400`} stroke="#dfebf4" strokeDasharray="4 4" /><text x="27" y={149-i*36.67} textAnchor="end">{Math.round(i*max/3)}</text></g>)}
      {!live && points.length > 1 && <><path d={`M${points[0]} L${points.join(' L')} L${lastX},145 L40,145 Z`} fill={`url(#${id})`} /><path d={`M${points.join(' L')}`} fill="none" stroke={kind === 'gallery' ? '#129df0' : '#08b5cf'} strokeWidth="2.5" /></>}
      {live && <path d={points.map((point, i) => `${i === 0 || samples[i].time - samples[i - 1].time >= 6 ? 'M' : 'L'}${point}`).join(' ')} fill="none" stroke="#129df0" strokeWidth="2.5" />}
      {available && <><circle cx={lastX} cy={y} r="5" fill="#049acb" stroke="white" strokeWidth="2" />
      <g transform={`translate(${Math.min(355, Math.max(40, lastX-25))} ${Math.max(8, y-31)})`}><rect width="57" height="22" rx="5" fill="#142d40" /><text x="28.5" y="15" textAnchor="middle" fill="white" className="sim-chart-value">{value.toFixed(1)} {unit}</text></g></>}
      {[0, 1, 2, 3, 4].map(i => <text key={i} x={40+i*87.5} y="170" textAnchor="middle">{live ? new Date((first + span*i/4)*1000).toLocaleTimeString('pt-BR') : formatTime(first + span*i/4).slice(3)}</text>)}
    </svg><p className="sim-chart-note">{live ? available ? 'Telemetria recebida • horário real • lacunas ≥6 s' : 'Sem telemetria atual • histórico da sessão' : samples.length < 2 ? 'Inicie a simulação para acompanhar a evolução.' : 'Histórico da sessão • tempo simulado'}</p>
  </article>
}
