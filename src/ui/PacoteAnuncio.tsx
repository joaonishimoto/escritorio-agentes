import { useState, type MouseEvent } from 'react'
import { ARTES, baixarArquivo, LIMITES, nomeDaEtapa, nomeDoArquivo, nomeDoObjetivo, type Anuncio } from '../lib/anuncio'
import { VerSlides } from './VerSlides'

/** Um texto do pacote com o botão de copiar e a contagem de caracteres contra o limite que o Meta mostra. */
function Campo({ rotulo, texto, limite, primeiraLinha }: { rotulo: string; texto: string; limite?: number; primeiraLinha?: boolean }) {
  const [copiado, setCopiado] = useState<'ok' | 'selecione' | null>(null)
  const medido = primeiraLinha ? (texto.split('\n')[0] ?? '') : texto
  const passou = limite !== undefined && medido.length > limite
  const copiar = async (e: MouseEvent<HTMLButtonElement>) => {
    const bloco = e.currentTarget.closest('.pa-campo')?.querySelector('.pa-texto')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado('ok')
    } catch {
      // sem permissão de área de transferência: deixa o texto selecionado para copiar no teclado
      if (bloco) window.getSelection()?.selectAllChildren(bloco)
      setCopiado('selecione')
    }
    setTimeout(() => setCopiado(null), 2000)
  }
  return (
    <div className="pa-campo">
      <div className="pa-rotulo">
        <span>{rotulo}</span>
        {limite !== undefined && (
          <small className={passou ? 'pa-passou' : ''} title={primeiraLinha ? 'Caracteres da primeira linha, que aparece antes do "ver mais"' : undefined}>
            {medido.length}/{limite}
          </small>
        )}
        <button type="button" className="secundario pa-copiar" onClick={copiar}>
          {copiado === 'ok' ? 'Copiado' : copiado === 'selecione' ? 'Selecionado: ⌘C' : 'Copiar'}
        </button>
      </div>
      <p className="pa-texto">{texto}</p>
    </div>
  )
}

/**
 * O que um anúncio precisa para subir no Gerenciador de Anúncios: as duas artes para baixar e os textos com
 * botão de copiar. Aparece na sua mesa e na gaveta.
 */
export function PacoteAnuncio({ anuncio, slides }: { anuncio: Anuncio; slides: { ordem: number; url: string }[] }) {
  const [vendo, setVendo] = useState<number | null>(null)
  const [baixando, setBaixando] = useState(false)
  const artes = [...slides].sort((a, b) => a.ordem - b.ordem)
  const p = anuncio.pacote
  const baixarTodas = async () => {
    setBaixando(true)
    for (const [i, a] of artes.entries()) await baixarArquivo(a.url, nomeDoArquivo(p, i))
    setBaixando(false)
  }

  return (
    <div className="pa">
      <p className="pa-objetivo">
        <span className="chip">{nomeDoObjetivo(anuncio.objetivo)}</span>
        {anuncio.etapa && <span className="chip">{nomeDaEtapa(anuncio.etapa)}</span>}
        {p?.botao && <span className="chip">Botão: {p.botao}</span>}
      </p>

      {artes.length > 0 && (
        <section>
          <div className="pa-cabeca">
            <h3>Artes</h3>
            {artes.length > 1 && (
              <button type="button" className="link" disabled={baixando} onClick={baixarTodas}>
                {baixando ? 'Baixando…' : 'Baixar as duas'}
              </button>
            )}
          </div>
          <div className="pa-artes">
            {artes.map((a, i) => (
              <figure key={a.ordem} className={i === 1 ? 'story' : ''}>
                <button type="button" className="pa-arte" onClick={() => setVendo(i)} aria-label={`Ver a arte de ${ARTES[i]?.nome ?? `número ${i + 1}`}`}>
                  <img src={a.url} alt="" loading="lazy" />
                </button>
                <figcaption>
                  <strong>{ARTES[i]?.nome ?? `Arte ${i + 1}`}</strong>
                  <small>{ARTES[i]?.medida ?? ''}</small>
                  <button type="button" className="secundario" onClick={() => void baixarArquivo(a.url, nomeDoArquivo(p, i))}>
                    Baixar
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="muted pa-dica">No Gerenciador de Anúncios, suba a de 4:5 no Feed e a de 9:16 em Stories e Reels (Personalizar posicionamentos).</p>
        </section>
      )}

      {p ? (
        <section>
          <h3>Textos para colar no Meta</h3>
          {p.texto_principal.map((t, i) => (
            <Campo key={`tp${i}`} rotulo={p.texto_principal.length > 1 ? `Texto principal ${i + 1}` : 'Texto principal'} texto={t} limite={LIMITES.texto_principal} primeiraLinha />
          ))}
          {p.titulo.map((t, i) => (
            <Campo key={`ti${i}`} rotulo={p.titulo.length > 1 ? `Título ${i + 1}` : 'Título'} texto={t} limite={LIMITES.titulo} />
          ))}
          {p.descricao && <Campo rotulo="Descrição" texto={p.descricao} limite={LIMITES.descricao} />}
          <Campo rotulo="Botão" texto={p.botao} />
          {anuncio.destino && <Campo rotulo="Link de destino" texto={anuncio.destino} />}
          {p.nome && <Campo rotulo="Nome do anúncio" texto={p.nome} />}
          <p className="muted pa-dica">Com mais de um texto principal e título, cole todos: o Meta testa as combinações. Desligue os aprimoramentos que mudam texto ou imagem se quiser o criativo como está.</p>
        </section>
      ) : (
        <p className="muted">O copywriter ainda não entregou os textos do anúncio.</p>
      )}

      {vendo !== null && <VerSlides urls={artes.map((a) => a.url)} inicial={vendo} aoFechar={() => setVendo(null)} />}
    </div>
  )
}
