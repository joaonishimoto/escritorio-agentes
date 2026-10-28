import { useState, type FormEvent } from 'react'
import { chamarApi } from '../lib/api'
import type { Marca } from '../lib/dados'

/** Cria uma sala no andar: uma marca com Instagram próprio ou uma sala neutra, que segue as referências de cada pedido. */
export function NovaSala({ aoCriar, aoFechar }: { aoCriar: (m: Marca) => void; aoFechar: () => void }) {
  const [neutra, setNeutra] = useState(false)
  const [nome, setNome] = useState('')
  const [instagram, setInstagram] = useState('')
  const [cor, setCor] = useState('#1e3d66')
  const [tom, setTom] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const { marca } = await chamarApi<{ marca: Marca }>('marcas', { nome, instagram, cor: neutra ? undefined : cor, tom_de_voz: tom, neutra })
      aoCriar(marca)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para criar a sala')
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <form className="modal" onSubmit={enviar} onClick={(e) => e.stopPropagation()}>
        <header className="painel-topo">
          <h2>Nova sala</h2>
          <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>
        <div className="escolha-tipo" role="radiogroup" aria-label="Tipo de sala">
          <button type="button" role="radio" aria-checked={!neutra} className={!neutra ? 'ativo' : ''} onClick={() => setNeutra(false)}>
            <strong>Marca</strong>
            <span className="muted">Tom de voz, cores e Instagram próprios. A equipe aprende as regras dela.</span>
          </button>
          <button type="button" role="radio" aria-checked={neutra} className={neutra ? 'ativo' : ''} onClick={() => { setNeutra(true); if (!nome) setNome('Sala neutra') }}>
            <strong>Sala neutra</strong>
            <span className="muted">Sem marca fixa: cada post segue as referências que você mandar no pedido.</span>
          </button>
        </div>
        <label htmlFor="sala-nome">Nome</label>
        <input id="sala-nome" required maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={neutra ? 'Sala neutra' : 'Ex.: Nishistack'} />
        <label htmlFor="sala-ig">Instagram onde vai postar (opcional)</label>
        <input id="sala-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@conta" />
        {!neutra && (
          <>
            <label htmlFor="sala-cor">Cor da marca</label>
            <input id="sala-cor" type="color" value={cor} onChange={(e) => setCor(e.target.value)} />
            <label htmlFor="sala-tom">Tom de voz (opcional)</label>
            <textarea id="sala-tom" rows={4} value={tom} onChange={(e) => setTom(e.target.value)} placeholder="Como a marca fala, para quem, o que evitar…" />
          </>
        )}
        <p className="muted">Depois de criar, conecte o Instagram dela pelo menu ⋯ › Conectar Instagram.</p>
        {erro && <p className="aviso">{erro}</p>}
        <div className="acoes">
          <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>
          <button className="primario" disabled={enviando}>{enviando ? 'Criando…' : 'Criar sala'}</button>
        </div>
      </form>
    </div>
  )
}
