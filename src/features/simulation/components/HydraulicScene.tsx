import { useId } from 'react'
import { galleryHeight, pumpLabels, SIMULATION_CONFIG, type PumpState, type SimulationState } from '../engine/simulation'

function Pump({ x, y, state, label }: { x: number; y: number; state: PumpState; label: string }) {
  return <g transform={`translate(${x} ${y})`} className={`sim-pump sim-pump-${state}`}>
    <circle r="23" /><g className="sim-rotor"><path d="M0,-16 Q15,-16 3,-2 Q22,4 9,14 Q0,20 -2,3 Q-20,12 -16,-3 Q-14,-14 0,-2Z" /></g>
    <text y="94" textAnchor="middle">{label}</text><text y="112" textAnchor="middle" className="sim-svg-muted">{pumpLabels[state]}</text>
  </g>
}
export function HydraulicScene({ state: s, connected = false }: { state: SimulationState; connected?: boolean }) {
  const id = useId().replaceAll(':', '')
  const height = galleryHeight(s)
  const galleryY = 370 - height / SIMULATION_CONFIG.maxHeightCm * 150
  const tankHeight = s.tankLiters / s.capacityLiters * 200
  return <div tabIndex={0} role="region" aria-label="Circuito hidráulico; em telas pequenas, role horizontalmente para explorar" className={`sim-scene ${s.running || connected ? 'sim-running' : ''}`}>
    <svg viewBox="0 0 1000 490" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Circuito hidráulico da estação virtual</title>
      <desc id={`${id}-desc`}>Chuva de {s.rain}%. Galeria a {height.toFixed(1)} cm. Drenagem {pumpLabels[s.drainage]}. Reservatório com {s.tankLiters.toFixed(1)} litros. Reúso {pumpLabels[s.reuse]}. {s.running ? 'Em execução.' : 'Tempo pausado.'}</desc>
      <defs>
        <clipPath id={`${id}-gallery`}><rect x="80" y="220" width="240" height="150" rx="5" /></clipPath>
        <clipPath id={`${id}-tank`}><rect x="665" y="170" width="180" height="200" rx="6" /></clipPath>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#22bdcf" stopOpacity=".75" /><stop offset="1" stopColor="#0789b0" stopOpacity=".9" /></linearGradient>
      </defs>
      <path d="M40 150H350" stroke="#c4dce3" strokeWidth="3" />
      <g className="sim-buildings"><path d="M60 149V90H110V149M122 149V65H180V149M192 149V103H240V149M256 149V80H310V149" /><path d="M70 107H99M137 83H164M137 101H164M137 119H164M204 121H228M268 99H297M268 119H297" /></g>
      {s.rain > 0 && <g className="sim-rain" style={{ opacity: s.rain / 100, animationDuration: `${1.4 - s.rain / 100}s` }}>
        {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${55 + i * 14} ${20 + i % 4 * 23}l-5 13`} />)}
      </g>}
      <text x="195" y="185" textAnchor="middle">Área urbana • chuva {s.rain}%</text>
      <path d="M85 157V208M315 157V208" className="sim-pipe" />
      {s.rain > 0 && <path d="M85 157V208M315 157V208" className="sim-flow" />}
      <rect x="70" y="210" width="260" height="170" rx="10" className="sim-vessel" />
      <g clipPath={`url(#${id}-gallery)`}>
        <rect x="80" y={galleryY} width="240" height={370 - galleryY} fill={`url(#${id}-water)`} />
        {height > 0 && <path d="M50 0 Q65 -4 80 0T110 0T140 0T170 0T200 0T230 0T260 0T290 0T320 0T350 0" transform={`translate(0 ${galleryY})`} className="sim-wave" />}
      </g>
      {[12, 20, 30].map(level => <g key={level}><path d={`M80 ${370 - level * 5}H320`} className="sim-threshold" /><text x="60" y={374 - level * 5} textAnchor="end" className="sim-svg-muted">{level}</text></g>)}
      <rect x="188" y="203" width="25" height="15" rx="4" fill={s.sensorFault ? '#df455d' : '#087f95'} />
      {!s.sensorFault && <path d={`M200 220V${galleryY}`} className="sim-sensor-beam" />}
      <text x="200" y="408" textAnchor="middle">Galeria de coleta • {height.toFixed(1)} / 30 cm</text>
      <text x="200" y="430" textAnchor="middle" className="sim-svg-muted">Sensor ultrassônico: {s.sensorFault ? 'falha' : `${(30 - height).toFixed(1)} cm até a água`}</text>
      <path d="M330 345H405V285H475V230H665" className="sim-pipe" />
      {s.drainage === 'on' && <path d="M330 345H405V285H475V230H665" className="sim-flow" />}
      <Pump x={405} y={285} state={s.drainage} label="Drenagem" />
      <rect x="520" y="198" width="74" height="64" rx="8" className={`sim-filter ${s.drainage === 'on' ? 'active' : ''}`} />
      <path d="M535 210H579M535 220H579M535 230H579M535 240H579M535 250H579" className="sim-filter-grid" />
      <text x="557" y="289" textAnchor="middle">Filtragem</text><text x="557" y="310" textAnchor="middle" className="sim-svg-muted">Ideal • sem perdas</text>
      <rect x="655" y="160" width="200" height="220" rx="12" className="sim-vessel" />
      <g clipPath={`url(#${id}-tank)`}>
        <rect x="665" y={370 - tankHeight} width="180" height={tankHeight} fill={`url(#${id}-water)`} />
        {tankHeight > 0 && <path d="M640 0 Q655 -4 670 0T700 0T730 0T760 0T790 0T820 0T850 0T880 0" transform={`translate(0 ${370 - tankHeight})`} className="sim-wave" />}
      </g>
      <text x="755" y="134" textAnchor="middle">Reservatório de armazenamento</text>
      <text x="755" y="408" textAnchor="middle">{s.tankLiters.toFixed(1)} / {s.capacityLiters} L</text>
      <text x="755" y="430" textAnchor="middle" className="sim-svg-muted">{(s.tankLiters / s.capacityLiters * 100).toFixed(0)}% da capacidade</text>
      <path d="M855 345H900V230H960" className="sim-pipe" />
      {s.reuse === 'on' && <path d="M855 345H900V230H960" className="sim-flow" />}
      <Pump x={900} y={285} state={s.reuse} label="Reúso" />
      <path d="M950 220L960 230L950 240" fill="none" stroke="#078ca3" strokeWidth="3" />
      <text x="925" y="192" textAnchor="middle">Saída para reúso</text>
      <text x="500" y="473" textAnchor="middle" className="sim-svg-muted">{connected ? 'ESTAÇÃO DE DEMONSTRAÇÃO • decisões do ESP32 • volumes do reservatório estimados' : 'ESTAÇÃO DE DEMONSTRAÇÃO • níveis e fluxos calculados pelo motor virtual'}</text>
    </svg>
  </div>
}
