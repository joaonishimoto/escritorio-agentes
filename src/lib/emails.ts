// Os "e-mails" da equipe: cada entrega de um agente para outro vira uma mensagem com o assunto da entrega,
// o que ele fez até ali e um trecho do que escreveu. Tudo sai dos eventos do post; nada novo no servidor.
import type { AgenteId } from '../agents/catalogo'
import type { Evento } from '../store/escritorio'

export interface Email {
  id: string
  de: AgenteId | 'voce'
  para: AgenteId | 'voce'
  assunto: string
  quando: string
  /** passos que quem mandou fez desde o e-mail anterior dele */
  feito: string[]
  /** começo do que ele escreveu nesse trabalho (vazio quando não escreveu nada) */
  trecho: string
}

const TAMANHO_TRECHO = 600

/** Junta o texto em streaming e corta num tamanho que dá para ler no painel. */
export function resumir(texto: string, max = TAMANHO_TRECHO) {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const corte = limpo.lastIndexOf(' ', max)
  return `${limpo.slice(0, corte > max * 0.6 ? corte : max)}…`
}

/** Todos os e-mails do post, na ordem em que foram mandados. */
export function emailsDoPost(eventos: Evento[]): Email[] {
  const emails: Email[] = []
  /** onde começa o trabalho atual de cada um: logo depois do último e-mail que mandou */
  const desde = new Map<string, number>()
  eventos.forEach((e, i) => {
    if (e.tipo !== 'entrega' || !e.para) return
    const janela = eventos.slice(desde.get(e.agente) ?? 0, i).filter((x) => x.agente === e.agente)
    emails.push({
      id: e.id,
      de: e.agente,
      para: e.para,
      assunto: e.mensagem,
      quando: e.criado_em,
      feito: janela.filter((x) => x.tipo === 'inicio' || x.tipo === 'acao').map((x) => x.mensagem),
      trecho: resumir(janela.filter((x) => x.tipo === 'texto').map((x) => x.mensagem).join('')),
    })
    desde.set(e.agente, i + 1)
  })
  return emails
}

/** Quantos e-mails cada um recebeu neste post (a caixa de entrada da mesa). */
export function contarRecebidos(eventos: Evento[]): Partial<Record<AgenteId | 'voce', number>> {
  const conta: Partial<Record<AgenteId | 'voce', number>> = {}
  for (const e of eventos) if (e.tipo === 'entrega' && e.para) conta[e.para] = (conta[e.para] ?? 0) + 1
  return conta
}
