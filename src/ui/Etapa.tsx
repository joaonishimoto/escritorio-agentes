import { agentePorId, type AgenteId } from '../agents/catalogo'
import type { Estado } from '../store/escritorio'

/** Em que etapa o post está agora, sempre visível no canto do escritório. Clicar abre a prévia do post. */
export function Etapa({ estados, aguardando, ativo, aoAbrir }: { estados: Record<AgenteId, Estado>; aguardando: boolean; ativo: boolean; aoAbrir?: () => void }) {
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
  const conteudo = (
    <>
      <span className={`etapa-ponto${aguardando ? ' voce' : ''}`} />
      {texto}
    </>
  )
  if (!aoAbrir || aguardando) return <div className="etapa" role="status">{conteudo}</div>
  return (
    <button className="etapa etapa-botao" role="status" onClick={aoAbrir} title="Ver como o post está ficando">
      {conteudo}
      <span className="etapa-ver">ver prévia</span>
    </button>
  )
}
