import { useStationView } from '../../esp32/useStationView'
import { Esp32Panel } from '../../esp32/Esp32Panel'
import { Play, Pause, RotateCcw, CloudRain, CloudOff, Droplets, FlaskConical, Waves, Cylinder, Activity, Settings, Timer, Radio, Wifi, TriangleAlert, CircleGauge } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SimulationChart, type StationSample } from '../components/SimulationChart'
import { useSimulation } from '../hooks/SimulationContext'
import { formatTime, galleryHeight, riskLabels, SIMULATION_CONFIG as config, pumpLabels } from '../engine/simulation'
import { alarmLabels } from '../engine/simulation'


export function SimulationPage() {
  const { state: local, dispatch, mode, mqtt, fresh } = useSimulation()
  const s = useStationView()
  const t = mqtt.telemetry
  const latest = useRef(s)
  useEffect(() => { latest.current = s }, [s])
  const [samples, setSamples] = useState<StationSample[]>([{ time: s.time, gallery: galleryHeight(s), tank: s.tankLiters }])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = latest.current
      setSamples(previous => {
        const sample = { time: current.time, gallery: galleryHeight(current), tank: current.tankLiters }
        if (current.time < (previous.at(-1)?.time ?? 0)) return [sample]
        if (current.time === previous.at(-1)?.time) return previous
        return [...previous, sample].slice(-90)
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  const live = mode === 'wokwi'
  const measured = !live || fresh && t?.sensor_ok === true
  const levelText = measured ? galleryHeight(s).toFixed(1) : '—'
  const unavailable = mode === 'wokwi' && !fresh
  const connectionLabel = mode === 'local' ? 'Simulação local' : fresh ? 'ESP32 conectado' : 'ESP32 aguardando'
  const level = galleryHeight(s)
  return <section className="page simulation-page">
    <header className="page-header"><div><p className="eyebrow">Laboratório hidráulico</p><h1>Simulação</h1><p className="subtitle">Da chuva ao reúso: acompanhe cada etapa da estação virtual.</p></div><span className="sim-demo"><FlaskConical size={16} /> Estação de demonstração</span></header>
    <div className="sim-metrics">
      <article><i className="sim-metric-icon"><Waves /></i><div><span>Nível da galeria</span><strong>{levelText} <small>cm</small></strong><small><b>{measured ? (level / config.maxHeightCm * 100).toFixed(1) : '—'}%</b> do limite (30 cm)</small></div></article>
      <article><i className="sim-metric-icon"><Cylinder /></i><div><span>Barragem</span><strong>{live ? '—' : s.tankLiters.toFixed(1)} <small>L</small></strong><small>{live ? 'Volume não medido pelo ESP32' : `${(s.tankLiters / s.capacityLiters * 100).toFixed(0)}% da capacidade (${s.capacityLiters} L) • estimado`}</small></div></article>
      <article><i className="sim-metric-icon sim-metric-green"><Activity /></i><div><span>Classificação</span><strong className={`sim-risk-${s.risk}`}>{measured ? riskLabels[s.risk] : 'Sem leitura'}</strong><small>Atenção ≥ {config.attentionCm} cm • Crítico ≥ {config.criticalCm} cm</small></div></article>
      <article><i className="sim-metric-icon"><Droplets /></i><div><span>Transbordamento</span><strong>{live ? '—' : s.overflowTotal.toFixed(2)} <small>L</small></strong><small>{live ? 'Não medido pelo ESP32' : 'Excesso contabilizado'}</small></div></article>
    </div>
    <div className="sim-workspace">
      <div className="sim-visual">
        <iframe className="sim-3d" src="/prototype/index.html?source=dashboard&embed=true" title="Maquete 3D da estação hidráulica conectada à simulação" />
        <div className="sim-scene-label sim-label-city"><span>Área urbana</span><small>{live ? 'Chuva não medida' : `Chuva ${s.rain}%`}</small></div>
        <div className="sim-scene-label sim-label-gallery"><span>Galeria de coleta</span><strong>{levelText} <small>cm / 30 cm</small></strong><progress value={measured ? level : 0} max={30} /></div>
        <div className="sim-scene-label sim-label-tank"><span>Barragem</span><strong>{live ? 'Volume não medido' : `${s.tankLiters.toFixed(1)} L / ${s.capacityLiters} L`}</strong>{!live && <progress value={s.tankLiters} max={s.capacityLiters} />}</div>
        <div className="sim-scene-label sim-label-reuse"><span>Saída para reúso</span><small><i className={s.reuse === 'on' ? 'sim-dot on' : 'sim-dot'} />{unavailable ? 'Desconhecido' : pumpLabels[s.reuse]}</small></div>
        <div className="sim-scene-caption"><span><i className={s.running ? 'sim-dot on' : 'sim-dot'} />{live ? fresh ? 'Telemetria ESP32 atual' : 'Telemetria desatualizada' : s.running ? 'Simulação em execução' : 'Simulação pausada'} • {formatTime(s.time)}</span><a href="/prototype/index.html?source=dashboard" target="_blank" rel="noopener noreferrer">Explorar em 3D ↗</a></div>
      </div>

      <article className="panel sim-controls"><div className="sim-card-heading"><h2>Controles da simulação</h2><span className={`sim-connection ${unavailable ? 'waiting' : ''}`}><i />{connectionLabel}</span></div>
      <div className="sim-playback"><button className="sim-primary" disabled={live} onClick={() => dispatch({ type: 'running', value: !s.running })}>{s.running ? <Pause size={15} /> : <Play size={15} />}{s.running ? 'Pausar' : s.started ? 'Continuar' : 'Iniciar simulação'}</button><button disabled={live} aria-label="Reiniciar cenário" title="Reiniciar cenário" onClick={() => dispatch({ type: 'reset' })}><RotateCcw size={15} /></button></div>
      <fieldset disabled={live}>
        <label className="sim-control" htmlFor="simulation-rain"><span><Droplets size={19} />Intensidade da chuva</span> <output>{s.rain}%</output><input id="simulation-rain" type="range" min="0" max="100" step="1" value={s.rain} onChange={e => dispatch({ type: 'rain', value: Number(e.target.value) })} /></label>
        <div className="sim-actions"><button onClick={() => dispatch({ type: 'rain', value: 100 })}><CloudRain size={17} /> Simular tempestade</button><button onClick={() => dispatch({ type: 'rain', value: 0 })}><CloudOff size={17} /> Parar chuva</button></div>
        <label className="sim-control"><span><Timer size={19} />Velocidade do tempo</span><select value={s.speed} onChange={e => dispatch({ type: 'speed', value: Number(e.target.value) })}>{[1, 10, 30, 60, 120].map(speed => <option key={speed} value={speed}>{speed}× • {speed} s simulados / s real</option>)}</select></label>
        <label className="sim-control" htmlFor="simulation-capacity"><span><Cylinder size={19} />Capacidade da barragem (L)</span><output>{s.capacityLiters} L</output><input id="simulation-capacity" type="range" min="5" max="200" step="1" value={s.capacityLiters} onChange={e => dispatch({ type: 'capacity', value: Number(e.target.value) })} /></label>
        <button className="sim-reuse-button" aria-pressed={s.reuseRequested} onClick={() => dispatch({ type: 'reuse' })}><Droplets size={17} />{s.reuseRequested ? 'Cancelar reúso' : 'Solicitar reúso'}</button>
        <fieldset><legend>Teste de proteções</legend><button disabled={s.tankLiters >= s.capacityLiters} onClick={() => dispatch({ type: 'fill' })}><Cylinder size={17} />Barragem cheia</button><button aria-pressed={local.sensorFault} onClick={() => dispatch({ type: 'sensor', value: !local.sensorFault })}><TriangleAlert size={17} />Falha do sensor</button></fieldset>
      </fieldset></article>
    </div>
    <div className="sim-insights">
      {live ? <><SimulationChart samples={mqtt.samples.map(sample => ({time: sample.at / 1000, gallery: sample.level, tank: 0}))} kind="gallery" max={30} value={level} live available={measured} /><article className="panel"><h2>Barragem</h2><p>Volume não medido pelo ESP32. As boias são entradas do controlador; não indicam litros ou percentual da barragem.</p></article></> : <><SimulationChart samples={samples} kind="gallery" max={30} value={level} /><SimulationChart samples={samples} kind="tank" max={s.capacityLiters} value={s.tankLiters} /></>}
      <article className="panel sim-system"><h2><Settings size={20} />Estados do sistema</h2>
        <div><span><CircleGauge size={15} />Sensor ultrassônico</span><b><i className={!s.sensorFault && !unavailable ? 'sim-dot on' : 'sim-dot'} />{unavailable ? 'Sem leitura' : s.sensorFault ? 'Falha' : 'OK'}</b><small>{unavailable || s.sensorFault ? '—' : `${(live && t ? t.distance_cm : 30-level).toFixed(1)} cm`}</small></div>
        <div><span><CircleGauge size={15} />Bomba drenagem</span><b><i className={s.drainage === 'on' ? 'sim-dot on' : 'sim-dot'} />{unavailable ? 'Desconhecida' : pumpLabels[s.drainage]}</b></div>
        <div><span><CircleGauge size={15} />Bomba reúso</span><b><i className={s.reuse === 'on' ? 'sim-dot on' : 'sim-dot'} />{unavailable ? 'Desconhecido' : pumpLabels[s.reuse]}</b></div>
        <div><span><Wifi size={15} />Fonte dos dados</span><b><i className={unavailable ? 'sim-dot' : 'sim-dot on'} />{mode === 'local' ? 'Motor local' : fresh ? 'ESP32' : 'Aguardando'}</b></div>
        <div><span><Radio size={15} />Conexão MQTT</span><b><i className={mqtt.connection === 'connected' ? 'sim-dot on' : 'sim-dot'} />{mode === 'local' ? 'Não utilizada' : mqtt.connection === 'connected' ? 'Conectada' : 'Desconectada'}</b></div>
      </article>
    </div>
    <p className="sim-footnote">{live ? 'Telemetria ESP32 • galeria de 30 cm • volume da barragem não medido.' : 'Estação virtual de demonstração • escala de 30 cm • volumes estimados.'} Arraste a maquete para girar e use a rolagem para aproximar.</p>
    <details className="panel sim-technical"><summary>Conexão ESP32, alarmes e histórico <span>Configurações da estação</span></summary>
    <div className="sim-notice">Modelo didático com valores estimados. Esta estação tem escala própria de 30 cm e não representa leituras dos pontos urbanos.</div>
    <div className="sim-notice"><a href="/prototype/index.html?source=dashboard" target="_blank" rel="noopener noreferrer">Abrir protótipo 3D conectado</a> • O 3D acompanha a fonte selecionada aqui: simulação local ou ESP32. Para testar com ESP32, <a href="https://wokwi.com/projects/478540696015596545" target="_blank" rel="noopener noreferrer">inicie o Wokwi</a>, selecione ESP32 conectado e aguarde “ESP32 transmitindo”. Insira as credenciais temporárias e escolha “Entradas virtuais de demonstração” para enviar níveis e boias ao ESP32. Mantenha uma única aba controladora do dashboard aberta.</div>
    <Esp32Panel />
      <div className="sim-log-column"><article className="panel"><h2>Alarmes ativos <span className="sim-count">{mode === 'wokwi' ? fresh ? Number(t?.alarm ?? false) : '?' : s.alarms.length}</span></h2><div aria-live="polite">{mode === 'wokwi' ? <p>{!fresh ? 'ESP32 sem telemetria atual.' : t?.alarm ? `Alarme ESP32: ${t.alarm_code}` : 'Nenhum alarme informado pelo ESP32.'}</p> : s.alarms.length ? <ul className="sim-alarms">{s.alarms.map(alarm => <li key={alarm}>{alarmLabels[alarm]}</li>)}</ul> : <p className="sim-clear">Nenhuma proteção acionada.</p>}</div></article>
        <article className="panel" hidden={live}><h2>Histórico da estação</h2><p className="sim-help">Eventos em tempo simulado • últimos 500 registros</p><ol className="sim-events" aria-label="Eventos da simulação">{s.events.slice().reverse().map(event => <li key={event.id}><time>{formatTime(event.time)}</time><span>{event.message}</span></li>)}</ol></article>
      </div>
    </details>
    <details className="panel sim-model" hidden={live}><summary>Modelo hidráulico e balanço de volumes</summary><p>Galeria prismática de base 0,1 m²: cada centímetro corresponde a 1 litro, até 30 L. Chuva de 100% gera entrada efetiva estimada de 3 L/min. Filtro ideal, sem perdas ou atraso. Drenagem liga a 20 cm, desliga a 12 cm e mantém o estado entre esses limites, respeitando sensor e capacidade de destino. Vazões são limitadas pela água e pelo espaço disponíveis em cada passo de 0,25 s.</p><p>Galeria + barragem = água inicial (13 L) + chuva + aporte externo − reúso − transbordamento. Transferência pela drenagem é interna ao sistema.</p><dl className="sim-summary"><div><dt>Entrada de chuva</dt><dd>{s.rainTotal.toFixed(2)} L</dd></div><div><dt>Transferido pelo filtro</dt><dd>{s.drainedTotal.toFixed(2)} L</dd></div><div><dt>Água reutilizada</dt><dd>{s.reusedTotal.toFixed(2)} L</dd></div><div><dt>Aporte externo de teste</dt><dd>{s.externalAddedTotal.toFixed(2)} L</dd></div></dl></details>
  </section>
}
