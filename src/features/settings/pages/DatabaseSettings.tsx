import { useState } from 'react'
import { Check, Database, RefreshCw } from 'lucide-react'
import { isDatabaseConfigured } from '@/lib/supabase'
import { fetchMonitoringPoints } from '@/features/dashboard/data/monitoringRepository'

export function DatabaseSettings() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState('')
  async function testConnection() {
    setTesting(true); setResult('')
    try {
      const points = await fetchMonitoringPoints(AbortSignal.timeout(10_000))
      setResult(`Conexão confirmada. ${points.length} ponto(s) publicado(s).`)
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Não foi possível conectar.')
    } finally { setTesting(false) }
  }
  return <div className="settings-card settings-wide-card"><div className="settings-card-heading"><h3>Fonte dos dados</h3><span className="settings-status"><Database size={14}/>{isDatabaseConfigured ? 'Configurado' : 'Demonstração'}</span></div><p className="settings-card-description">{isDatabaseConfigured ? 'O painel consulta os pontos publicados no seu banco.' : 'Explore o painel com dados de exemplo enquanto prepara seu banco.'}</p><div className="settings-info-note"><Check size={18}/><span>{isDatabaseConfigured ? 'Use o teste para confirmar a conexão e as permissões de leitura.' : 'A integração está preparada. Consulte o guia docs/database.md para ativar.'}</span></div>{isDatabaseConfigured && <button type="button" className="settings-outline-button" onClick={testConnection} disabled={testing}><RefreshCw size={14}/>{testing ? 'Testando…' : 'Testar conexão'}</button>}<p role="status">{result}</p></div>
}
