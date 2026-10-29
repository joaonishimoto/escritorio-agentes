import { db } from './db.js'
import { infoDoToken, precisaRenovar, renovarNaMeta } from './token-meta.js'

/** Renova o token de cada marca conectada que precisa. Erros ficam anotados na marca para o app avisar. */
export async function renovarTokens(agora = new Date()) {
  const { data: marcas, error } = await db.from('marcas').select('id, identidade').not('meta_token_secret_id', 'is', null)
  if (error) throw new Error(error.message)
  const resultado = { renovados: 0, falhas: 0, pulados: 0 }
  for (const m of marcas ?? []) {
    const identidade = (m.identidade ?? {}) as Record<string, unknown>
    const info = infoDoToken(identidade)
    if (!precisaRenovar(info, identidade.instagram_conectado_em as string | undefined, agora)) {
      resultado.pulados++
      continue
    }
    let novaInfo
    try {
      const { data: token, error: e } = await db.rpc('ler_token_meta', { p_marca: m.id })
      if (e || !token) throw new Error('Não consegui ler o token no Vault')
      const renovado = await renovarNaMeta(token as string, agora)
      const { error: e2 } = await db.rpc('trocar_token_meta', { p_marca: m.id, p_token: renovado.token })
      if (e2) throw new Error(`Não consegui guardar o token novo: ${e2.message}`)
      novaInfo = renovado.info
      resultado.renovados++
    } catch (e) {
      novaInfo = { ...info, erro: (e instanceof Error ? e.message : String(e)).slice(0, 200) }
      resultado.falhas++
    }
    // relê a identidade para não apagar o que mudou enquanto a Meta respondia
    const { data: atual } = await db.from('marcas').select('identidade').eq('id', m.id).single()
    await db
      .from('marcas')
      .update({ identidade: { ...((atual?.identidade as Record<string, unknown>) ?? {}), instagram_token: novaInfo } })
      .eq('id', m.id)
  }
  return resultado
}
