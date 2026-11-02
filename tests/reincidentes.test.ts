import { describe, expect, it } from 'vitest'
import { reincidentes, sistemaDoAgente, textoReincidentes } from '../api/_lib/contexto'
import { LAYOUTS, textoLayout } from '../api/_lib/variacao'

const marca = { id: 'm', nome: 'Drinfy', instagram_usuario: null, instagram_conta_id: null, meta_token_secret_id: null, tom_de_voz: '', identidade: {}, hashtags_fixas: [], aviso_final: null, modelo_slides_html: null, checklist_revisor: '' }
const regras = [
  { agente: 'designer', regra: 'Foto sem quina seca', vezes: 3 },
  { agente: 'designer', regra: 'Badge alinhado', vezes: 1 },
  { agente: 'designer', regra: 'Drink inteiro', vezes: 2 },
  { agente: 'redator', regra: 'Gancho curto', vezes: 4 },
  { agente: 'designer', regra: 'Ícone em PNG' },
]

describe('regras reincidentes', () => {
  it('pega só as do agente com 2 ou mais vezes, da mais cobrada para a menos', () => {
    expect(reincidentes({ regras }, 'designer').map((r) => r.regra)).toEqual(['Foto sem quina seca', 'Drink inteiro'])
    // as do designer valem para o designer de criativos
    expect(reincidentes({ regras }, 'criativos')).toHaveLength(2)
    expect(textoReincidentes({ regras }, 'designer')).toContain('(3x) Foto sem quina seca')
    expect(textoReincidentes({ regras: regras.slice(1, 2) }, 'designer')).toBe('')
  })
  it('no prompt, os erros que voltaram vêm antes das outras regras e não se repetem', () => {
    const s = sistemaDoAgente({ marca, etapas: [], regras }, 'designer', 'Você monta os slides.')
    const voltaram = s.indexOf('Erros que já voltaram')
    const aprendidas = s.indexOf('Regras aprendidas para você')
    expect(voltaram).toBeGreaterThan(-1)
    expect(aprendidas).toBeGreaterThan(voltaram)
    expect(s.split('Foto sem quina seca').length - 1).toBe(1)
    expect(s.slice(aprendidas)).toContain('Ícone em PNG')
  })
})

describe('layouts', () => {
  it('o número gigante saiu do catálogo', () => {
    expect('numero-gigante' in LAYOUTS).toBe(false)
  })
  it('o layout sorteado é ponto de partida; o escolhido pelo dono vale', () => {
    expect(textoLayout('foto-cheia', [])).toContain('Ponto de partida')
    expect(textoLayout('foto-cheia', [], true)).toContain('escolhido pelo dono')
    expect(textoLayout('numero-gigante', [])).toBe('')
  })
})
