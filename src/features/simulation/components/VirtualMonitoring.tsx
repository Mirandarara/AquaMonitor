import { useStationView } from '../../esp32/useStationView'
import { Esp32Panel } from '../../esp32/Esp32Panel'
import { Link } from 'react-router-dom'
import { ArrowRight, FlaskConical } from 'lucide-react'
import { useSimulation } from '../hooks/SimulationContext'
import { galleryHeight, pumpLabels, riskLabels, tankLabel, formatTime } from '../engine/simulation'

export function VirtualMonitoring() {
  const { mode, fresh, mqtt, virtualInput } = useSimulation()
  const s = useStationView()
  const last = s.events.at(-1)!
  return <article className="panel virtual-monitoring">
    <div className="panel-heading"><div><h2><FlaskConical size={18} /> Monitoramento virtual</h2><p>Estação de demonstração • {mode === 'wokwi' ? 'ESP32 Wokwi' : 'valores estimados'} • {s.running ? 'em execução' : s.started ? 'pausada' : 'pronta para iniciar'}</p></div><Link className="text-button" to="/simulacao">Abrir simulação <ArrowRight size={16} /></Link></div>
    <Esp32Panel />{mode === 'local' || mqtt.telemetry ? <dl className="sim-summary"><div><dt>{mode === 'wokwi' ? fresh ? virtualInput ? 'Galeria do motor (comandos)' : 'Galeria da estação ESP32' : 'Galeria • última leitura' : 'Galeria virtual'}</dt><dd>{galleryHeight(s).toFixed(1)} <small>/ 30 cm</small></dd></div><div><dt>Drenagem</dt><dd>{pumpLabels[s.drainage]}</dd></div><div><dt>Reservatório estimado • {tankLabel(s)}</dt><dd>{s.tankLiters.toFixed(1)} <small>/ {s.capacityLiters} L</small></dd></div><div><dt>Classificação do cenário</dt><dd><span className={`sim-risk sim-risk-${s.risk}`}>{riskLabels[s.risk]}</span></dd></div></dl> : <p>Aguardando a primeira telemetria do ESP32.</p>}
    <p className="sim-last-event"><time>{formatTime(last.time)}</time> {last.message}</p>
  </article>
}
