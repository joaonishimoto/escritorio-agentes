// Validação da identidade da marca ao salvar pelo app: os campos que o código lê têm tipo certo,
// o resto (anotações livres da marca, como "estilo" ou "fotos") pode ser texto, número, lista ou objeto.
import { z } from 'zod'

const HEX = /^#[0-9a-f]{6}$/i
const texto = (max: number) => z.string().max(max, `texto com mais de ${max} caracteres`)
const dinheiro = z.number().positive().max(10_000).nullable()

export const Identidade = z
  .object({
    cor_sala: z.string().regex(HEX, 'cor da sala precisa ser #RRGGBB').optional(),
    cores: z.record(z.string(), z.union([texto(200), z.array(z.unknown()), z.record(z.string(), z.unknown())])).optional(),
    fonte: texto(500).optional(),
    neutra: z.boolean().optional(),
    tom_editado: z.boolean().optional(),
    teto: z.object({ por_post_usd: dinheiro.optional(), por_mes_usd: dinheiro.optional() }).optional(),
    narracao: z
      .object({
        ativa: z.boolean().optional(),
        voz: texto(100).optional(),
        velocidade: z.number().min(0.5).max(2).optional(),
        estabilidade: z.number().min(0).max(1).optional(),
      })
      .passthrough()
      .optional(),
    posicao: z.number().optional(),
  })
  .catchall(z.union([texto(4000), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.string(), z.unknown())]))

/** Valida e devolve a identidade, ou uma mensagem em português dizendo o que está errado. */
export function validarIdentidade(x: unknown): { ok: true; identidade: Record<string, unknown> } | { ok: false; erro: string } {
  if (JSON.stringify(x ?? {}).length > 60_000) return { ok: false, erro: 'A identidade da marca ficou grande demais (mais de 60 mil caracteres)' }
  const r = Identidade.safeParse(x ?? {})
  if (r.success) return { ok: true, identidade: r.data }
  const p = r.error.issues[0]
  return { ok: false, erro: `Campo "${p.path.join('.') || 'identidade'}" inválido: ${p.message}` }
}
