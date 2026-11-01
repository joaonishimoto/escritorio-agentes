import { useSyncExternalStore } from 'react'

/**
 * Tema da interface: claro, escuro ou automático (segue o aparelho).
 * Fica salvo no aparelho; o index.html aplica antes da primeira pintura (mesma chave).
 * O escritório (3D e pixel) mantém as cores dele; o modo escuro vale para painéis e menus.
 */
export type Tema = 'claro' | 'escuro' | 'automatico'

export const CHAVE_TEMA = 'agentes-tema'
const ESCURO_NO_APARELHO = '(prefers-color-scheme: dark)'
const COR_DA_BARRA = { claro: '#faf9f5', escuro: '#111418' }
const ouvintes = new Set<() => void>()

export function ehTema(v: unknown): v is Tema {
  return v === 'claro' || v === 'escuro' || v === 'automatico'
}

export function lerTema(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA)
    return ehTema(salvo) ? salvo : 'claro'
  } catch {
    return 'claro'
  }
}

function aparelhoEscuro() {
  return typeof window !== 'undefined' && window.matchMedia?.(ESCURO_NO_APARELHO).matches === true
}

export function temaValendo(tema: Tema, escuroNoAparelho: boolean): 'claro' | 'escuro' {
  return tema === 'automatico' ? (escuroNoAparelho ? 'escuro' : 'claro') : tema
}

export function aplicarTema() {
  const valendo = temaValendo(lerTema(), aparelhoEscuro())
  const raiz = document.documentElement
  raiz.classList.toggle('dark', valendo === 'escuro')
  raiz.style.colorScheme = valendo === 'escuro' ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_DA_BARRA[valendo])
}

export function escolherTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema)
  } catch {
    // sem armazenamento (aba privada): vale até recarregar
  }
  aplicarTema()
  ouvintes.forEach((f) => f())
}

function assinar(f: () => void) {
  ouvintes.add(f)
  const midia = window.matchMedia?.(ESCURO_NO_APARELHO)
  const aoMudarAparelho = () => {
    if (lerTema() === 'automatico') aplicarTema()
    f()
  }
  const aoMudarOutraAba = (e: StorageEvent) => {
    if (e.key === CHAVE_TEMA) {
      aplicarTema()
      f()
    }
  }
  midia?.addEventListener('change', aoMudarAparelho)
  window.addEventListener('storage', aoMudarOutraAba)
  return () => {
    ouvintes.delete(f)
    midia?.removeEventListener('change', aoMudarAparelho)
    window.removeEventListener('storage', aoMudarOutraAba)
  }
}

/** Tema escolhido e o que está valendo agora (o automático resolve pelo aparelho). */
export function useTema() {
  const tema = useSyncExternalStore(assinar, lerTema, () => 'claro' as Tema)
  const escuro = useSyncExternalStore(assinar, aparelhoEscuro, () => false)
  return { tema, valendo: temaValendo(tema, escuro), escolher: escolherTema }
}
