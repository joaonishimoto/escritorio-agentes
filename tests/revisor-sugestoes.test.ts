import { describe, expect, it } from 'vitest'
import { soParaODono } from '../api/_lib/agentes/producao.js'

describe('revisor: o que só o dono confere não devolve o post', () => {
  it('move dose, receita e quantidade de fontes para sugestão', () => {
    const problemas = [
      { agente: 'redator', problema: 'A legenda diz "junta tudo com gelo" sem a dose certa do app; confirmar as doses com a receita.' },
      { agente: 'pesquisador', problema: 'O fato histórico tem só uma fonte, o checklist pede duas fontes.' },
      { agente: 'designer', problema: 'O título está cortado na borda direita do slide 2.' },
      { agente: 'designer', problema: 'A receita no slide 3 fica sobreposta à foto e ilegível.' },
    ]
    expect(soParaODono(problemas).map((p) => p.agente)).toEqual(['redator', 'pesquisador'])
  })
  it('não mexe em problema visível', () => {
    expect(soParaODono([{ problema: 'Faixa vazia grande embaixo do slide 4.' }])).toEqual([])
  })
})
