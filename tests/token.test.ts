import { describe, expect, it } from 'vitest'
import { diasParaVencer, infoAoConectar, precisaRenovar } from '../api/_lib/token-meta'
import { avisoDoToken } from '../src/lib/token'

const agora = new Date('2026-10-29T12:00:00Z')
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString()
const emDias = (n: number) => new Date(agora.getTime() + n * 86_400_000).toISOString()

describe('renovação do token do Instagram', () => {
  it('ao conectar assume 60 dias', () => {
    const info = infoAoConectar(agora)
    expect(diasParaVencer(info, agora)).toBe(60)
    expect(info.estimado).toBe(true)
  })

  it('espera 1 dia depois de conectar, depois renova toda semana', () => {
    expect(precisaRenovar({}, diasAtras(0.5), agora)).toBe(false)
    expect(precisaRenovar({}, diasAtras(1), agora)).toBe(true)
    expect(precisaRenovar({ renovado_em: diasAtras(3) }, diasAtras(40), agora)).toBe(false)
    expect(precisaRenovar({ renovado_em: diasAtras(7) }, diasAtras(40), agora)).toBe(true)
  })

  it('marca conectada antes desta mudança (sem data) renova na hora', () => {
    expect(precisaRenovar({}, undefined, agora)).toBe(true)
  })

  it('o celular avisa com 10 dias ou menos, vencido ou com falha', () => {
    expect(avisoDoToken({ instagram_token: { expira_em: emDias(30) } }, true, agora)).toBeNull()
    expect(avisoDoToken({ instagram_token: { expira_em: emDias(10) } }, true, agora)).toBe('Token vence em 10 dias: reconecte')
    expect(avisoDoToken({ instagram_token: { expira_em: emDias(1.5) } }, true, agora)).toBe('Token vence em 1 dia: reconecte')
    expect(avisoDoToken({ instagram_token: { expira_em: emDias(-1) } }, true, agora)).toBe('Token do Instagram venceu: reconecte')
    expect(avisoDoToken({ instagram_token: { expira_em: emDias(40), erro: 'x' } }, true, agora)).toBe('A renovação do token falhou: reconecte')
    expect(avisoDoToken({ instagram_token: { expira_em: emDias(1) } }, false, agora)).toBeNull()
    expect(avisoDoToken({}, true, agora)).toBeNull()
  })
})
