// O token do Instagram (login do Instagram, graph.instagram.com) vale 60 dias.
// Ele pode ser renovado a qualquer momento depois de 24 h de vida, e cada renovação devolve mais 60 dias.
// Um cron diário do banco chama o app, que renova os tokens com mais de uma semana desde a última vez.

const DIA = 86_400_000
export const VALIDADE_DIAS = 60
/** renova quando a última renovação (ou a conexão) tem pelo menos isso */
export const RENOVAR_A_CADA_DIAS = 7
/** abaixo disso o celular da sala fica amarelo */
export const AVISAR_COM_DIAS = 10

/** O que o app guarda sobre o token na identidade da marca (o token em si fica só no Vault). */
export interface InfoDoToken {
  expira_em?: string | null
  /** true quando a validade é um chute (60 dias da conexão), antes da primeira renovação */
  estimado?: boolean
  renovado_em?: string | null
  erro?: string | null
}

export function infoDoToken(identidade: unknown): InfoDoToken {
  const x = (identidade as Record<string, unknown> | null)?.instagram_token
  return x && typeof x === 'object' ? (x as InfoDoToken) : {}
}

/** Info de um token recém-colado: a Meta não diz quando vence, então assume 60 dias. */
export function infoAoConectar(agora = new Date()): InfoDoToken {
  return { expira_em: new Date(agora.getTime() + VALIDADE_DIAS * DIA).toISOString(), estimado: true, renovado_em: null, erro: null }
}

/** Renova se passou uma semana desde a última renovação, ou pelo menos 1 dia desde a conexão quando nunca renovou. */
export function precisaRenovar(info: InfoDoToken, conectadoEm: string | null | undefined, agora = new Date()): boolean {
  const desde = (iso: string | null | undefined) => (iso ? (agora.getTime() - new Date(iso).getTime()) / DIA : Infinity)
  if (info.renovado_em) return desde(info.renovado_em) >= RENOVAR_A_CADA_DIAS
  return desde(conectadoEm) >= 1
}

/** Dias até vencer (pode ser negativo), ou null se não sabemos. */
export function diasParaVencer(info: InfoDoToken, agora = new Date()): number | null {
  if (!info.expira_em) return null
  return Math.floor((new Date(info.expira_em).getTime() - agora.getTime()) / DIA)
}

/** Pede à Meta um token novo de 60 dias a partir do atual. */
export async function renovarNaMeta(token: string, agora = new Date()): Promise<{ token: string; info: InfoDoToken }> {
  const qs = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?${qs}`, { signal: AbortSignal.timeout(15_000) })
  const json = (await r.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: { message?: string } } | null
  if (!r.ok || !json?.access_token) throw new Error(json?.error?.message ?? `HTTP ${r.status}`)
  const segundos = json.expires_in ?? VALIDADE_DIAS * 86_400
  return {
    token: json.access_token,
    info: { expira_em: new Date(agora.getTime() + segundos * 1000).toISOString(), estimado: false, renovado_em: agora.toISOString(), erro: null },
  }
}
