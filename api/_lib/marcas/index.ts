import * as drinfy from './drinfy.js'

/** Perfis de marca guardados no código, pelo nome da marca em minúsculas. */
const PERFIS: Record<string, { TOM_DE_VOZ: string; MODELO_SLIDES_HTML: string }> = { drinfy }

/**
 * Completa a marca do banco com o perfil do código: o modelo de slides entra quando o banco não tem um,
 * e o tom de voz detalhado entra quando o do banco é só um resumo.
 */
export function completarMarca<
  T extends { nome: string; tom_de_voz: string; modelo_slides_html: string | null; identidade?: Record<string, unknown> | null },
>(marca: T): T {
  const perfil = PERFIS[marca.nome.trim().toLowerCase()]
  if (!perfil) return marca
  // depois que o dono edita o tom pelo app, vale o que ele escreveu
  const editado = Boolean(marca.identidade?.tom_editado)
  return {
    ...marca,
    modelo_slides_html: marca.modelo_slides_html || perfil.MODELO_SLIDES_HTML,
    tom_de_voz: editado || marca.tom_de_voz.length >= perfil.TOM_DE_VOZ.length ? marca.tom_de_voz : perfil.TOM_DE_VOZ,
  }
}
