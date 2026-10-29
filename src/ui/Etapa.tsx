import { agentePorId, type AgenteId } from '../agents/catalogo'
import type { Estado } from '../store/escritorio'

/** Em que etapa o post está agora, sempre visível no canto do escritório. */
export function Etapa({ estados, aguardando, ativo }: { estados: Record<AgenteId, Estado>; aguardando: boolean; ativo: boolean }) {
  const ids = Object.keys(estados) as AgenteId[]
  const trabalhando = ids.find((id) => estados[id] === 'trabalhando')
  const naFila = ids.find((id) => estados[id] === 'na_fila')
  const texto = aguardando
    ? 'Esperando sua aprovação'
    : trabalhando
      ? `${agentePorId(trabalhando).nome} trabalhando`
      : naFila
        ? `${agentePorId(naFila).nome} vai começar`
        : null
  if (!texto || (!ativo && !aguardando)) return null
  return (
    <div className="etapa" role="status">
      <span className={`etapa-ponto${aguardando ? ' voce' : ''}`} />
      {texto}
    </div>
  )
}
