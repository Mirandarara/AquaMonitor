import { useSimulation } from '../simulation/hooks/SimulationContext'
const alarmLabels: Record<string, string> = { none: 'Nenhum', float_conflict: 'Conflito entre boias', sensor_failure: 'Falha do sensor', tank_full: 'Reservatório cheio', reuse_without_water: 'Reúso sem água' }
export function Esp32Panel() {
  const { mode, setMode, virtualInput, setVirtualInput, mqtt, fresh } = useSimulation()
  const t = mqtt.telemetry
  const start = mqtt.samples[0]?.at ?? 0
  const duration = Math.max(1, (mqtt.samples.at(-1)?.at ?? start) - start)
  const chartPath = mqtt.samples.map((sample, i) => `${i === 0 || sample.at - mqtt.samples[i - 1].at >= 6000 ? 'M' : 'L'}${(sample.at - start) / duration * 600},${99 - sample.level / 30 * 98}`).join(' ')
  return <div className="esp32-panel">
    <label>Fonte da estação virtual <select aria-label="Fonte da estação virtual" value={mode} onChange={e => setMode(e.target.value as 'local' | 'wokwi')}><option value="local">Simulação local</option><option value="wokwi">ESP32 conectado (Wokwi)</option></select></label>
    {mode === 'wokwi' && <>
      <p role="status"><strong>{fresh ? 'ESP32 transmitindo' : mqtt.connection === 'connected' ? 'ESP32 desconectado ou telemetria desatualizada' : `MQTT: ${mqtt.connection}`}</strong> • Estação virtual de demonstração • 30 cm</p>
      <label>Entrada do ESP32 <select aria-label="Entrada do ESP32" value={virtualInput ? 'virtual' : 'sensor'} onChange={e => setVirtualInput(e.target.value === 'virtual')}><option value="sensor">HC-SR04 e chaves do Wokwi</option><option value="virtual">Níveis e boias do simulador React</option></select></label>
      <p className="sim-help">{virtualInput ? 'Envio a cada 2 s, inclusive em pausa. As bombas obedecem ao ESP32; sem resposta recente o motor hidráulico aguarda.' : 'Altere a distância no HC-SR04 do Wokwi. O simulador hidráulico aguarda neste modo.'} Ao sair, o firmware retorna ao sensor em até 8 s caso a conexão seja interrompida.</p>
      {mqtt.error && <p role="alert">{mqtt.error}</p>}
      {t && <><p>{fresh ? 'Leitura atual' : 'Última leitura — não representa o estado atual'} • {mqtt.receivedAt ? new Date(mqtt.receivedAt).toLocaleTimeString('pt-BR') : 'aguardando nova transmissão'}</p>
        <dl className="sim-summary"><div><dt>Nível ESP32</dt><dd>{t.sensor_ok ? `${t.level_cm.toFixed(1)} cm (${t.level_pct.toFixed(1)}%)` : 'Sensor inválido'}</dd></div><div><dt>Distância</dt><dd>{t.distance_cm.toFixed(1)} cm</dd></div><div><dt>Sensor</dt><dd>{t.sensor_ok ? 'OK' : 'Falha'}</dd></div><div><dt>Drenagem / reúso</dt><dd>{fresh ? `${t.drain_on ? 'Ligada' : 'Desligada'} / ${t.reuse_on ? 'Ligada' : 'Desligada'}` : 'Desconhecidos'}</dd></div><div><dt>Boias cheio / vazio</dt><dd>{String(t.tank_full)} / {String(t.tank_empty)}</dd></div><div><dt>Entrada confirmada</dt><dd>{t.input_mode}</dd></div></dl>
        {fresh && t.input_mode !== (virtualInput ? 'virtual' : 'sensor') && <p role="alert">Aguardando o ESP32 confirmar a entrada selecionada.</p>}
        <p role={t.alarm ? 'alert' : 'status'}>Alarme ESP32: {t.alarm ? alarmLabels[t.alarm_code] ?? t.alarm_code : 'Nenhum'} • código: {t.alarm_code}</p>
      </>}
      <p className="sim-help">Último comando transmitido: {mqtt.lastCommandAt ? new Date(mqtt.lastCommandAt).toLocaleTimeString('pt-BR') : 'nenhum'} (a confirmação da entrada vem na telemetria).</p>
      {mqtt.samples.length > 0 && <figure className="esp32-chart"><figcaption>Nível recebido do ESP32 • últimas {mqtt.samples.length} amostras • escala 0–30 cm</figcaption><svg viewBox="0 0 600 100" role="img" aria-label="Evolução do nível da estação virtual ESP32, de zero a trinta centímetros"><path d="M0 1H600M0 99H600" stroke="#c4dce3" /><path fill="none" stroke="#0789b0" strokeWidth="2" d={chartPath} /></svg><small>Histórico da sessão; lacunas maiores que 6 s indicam perda de telemetria. {fresh ? 'Recebendo' : 'Sem dados atuais'}</small></figure>}
    </>}
  </div>
}
