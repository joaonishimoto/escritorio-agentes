// Curadoria das regras aprendidas: com o tempo o curador cria regras parecidas para o mesmo agente.
// Aqui um modelo junta as parecidas numa lista menor, e o dono confirma antes de qualquer mudança.
import { z } from 'zod'

/** Acima disso o app avisa: cada regra entra no prompt do agente em todo post. */
export const MUITAS_REGRAS = 15

export const AGENTES_DE_REGRA = ['chefe', 'pesquisador', 'redator', 'designer', 'cinegrafista', 'narrador', 'revisor', 'publicador', 'todos'] as const

export const Juntadas = z.object({
  regras: z.array(
    z.object({
      regra: z.string().describe('curta e verificável, no imperativo'),
      motivo: z.string().describe('de onde vem a regra, em uma frase'),
      juntou: z.array(z.number().int()).describe('os números das regras antigas que esta regra substitui (pelo menos um)'),
    }),
  ),
})
export type Juntadas = z.infer<typeof Juntadas>

export interface RegraAntiga {
  id: string
  regra: string
  motivo: string | null
}

export interface Proposta {
  /** regras novas, cada uma com as antigas que ela substitui */
  novas: { regra: string; motivo: string; substitui: string[] }[]
  /** antigas que continuam como estão */
  ficam: string[]
}

export const SISTEMA_JUNTAR = [
  'Você organiza as regras que uma equipe de criação de posts de Instagram aprendeu com as correções do dono da marca.',
  'Junte as regras que dizem a mesma coisa ou que se completam numa regra só, sem perder nenhum detalhe verificável (números, cores, tamanhos, palavras proibidas).',
  'Se duas regras se contradizem, fique com a mais recente (número maior).',
  'Regras que não se parecem com nenhuma outra ficam como estão: repita o texto e ponha só o número dela em "juntou".',
  'Toda regra antiga tem que aparecer em exatamente um "juntou". Escreva em português do Brasil.',
].join(' ')

export function pedidoDeJuntar(agente: string, regras: RegraAntiga[]) {
  const lista = regras.map((r, i) => `${i + 1}. ${r.regra}${r.motivo ? ` (motivo: ${r.motivo})` : ''}`).join('\n')
  return `Regras do agente "${agente}", da mais antiga para a mais recente:\n${lista}\n\nJunte as parecidas.`
}

const normal = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Transforma a resposta do modelo numa proposta segura:
 * números que não existem são ignorados, cada antiga vai para uma nova só,
 * e o que o modelo esqueceu (ou só repetiu igual) continua como está.
 */
export function montarProposta(regras: RegraAntiga[], dados: Juntadas): Proposta {
  const usadas = new Set<string>()
  const novas: Proposta['novas'] = []
  for (const n of dados.regras) {
    const texto = n.regra.trim()
    if (!texto) continue
    const substitui = [...new Set(n.juntou)]
      .map((i) => regras[i - 1]?.id)
      .filter((id): id is string => !!id && !usadas.has(id))
    if (!substitui.length) continue
    // repetiu a mesma regra sozinha: não é mudança
    if (substitui.length === 1 && normal(regras.find((r) => r.id === substitui[0])!.regra) === normal(texto)) continue
    substitui.forEach((id) => usadas.add(id))
    novas.push({ regra: texto.slice(0, 600), motivo: n.motivo.trim().slice(0, 300), substitui })
  }
  return { novas, ficam: regras.filter((r) => !usadas.has(r.id)).map((r) => r.id) }
}
