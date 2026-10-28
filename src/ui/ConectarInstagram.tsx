import { useState } from 'react'
import { chamarApi } from '../lib/api'
import type { Marca } from '../lib/dados'

/** Liga a conta do Instagram da marca: você cola o token gerado no painel da Meta e o app descobre a conta sozinho. */
export function ConectarInstagram({ marca, aoFechar, aoConectar }: { marca: Marca; aoFechar: () => void; aoConectar: () => void }) {
  const [token, setToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [conectou, setConectou] = useState<string | null>(null)
  const atual = marca.instagram_conta_id ? String(marca.identidade?.instagram ?? 'conta conectada') : null

  const conectar = async () => {
    setEnviando(true)
    setErro(null)
    try {
      const r = await chamarApi<{ usuario: string; tipo?: string }>('conectar-instagram', { marca_id: marca.id, token })
      setToken('')
      setConectou(r.usuario)
      aoConectar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal" role="dialog" aria-label="Conectar Instagram" onClick={(e) => e.stopPropagation()}>
        <header className="painel-topo">
          <h2>Instagram da {marca.nome}</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>

        {conectou ? (
          <>
            <p>Conectado em <strong>@{conectou}</strong>. O publicador já pode publicar e os agendados saem na hora marcada.</p>
            <div className="acoes"><button className="primario" onClick={aoFechar}>Pronto</button></div>
          </>
        ) : (
          <>
            {atual && <p className="muted">Hoje está conectado em <strong>@{atual}</strong>. Cole um token novo para trocar ou renovar.</p>}
            <ol className="passos-meta">
              <li>Abra <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> e entre no app da Meta que você usa para a {marca.nome}.</li>
              <li>Vá em <strong>Instagram</strong> › <strong>API setup with Instagram login</strong>.</li>
              <li>Em <strong>Generate access tokens</strong>, adicione a conta do Instagram da marca (precisa ser profissional) e clique em <strong>Generate token</strong>.</li>
              <li>Copie o token e cole aqui. Ele vale por 60 dias.</li>
            </ol>
            <label htmlFor="token-ig"><h3>Token de acesso</h3></label>
            <input
              id="token-ig"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="IGAA…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="muted">O token vai direto para o cofre criptografado do banco. Ele não fica salvo em nenhuma tabela nem aparece de novo na tela.</p>
            {erro && <p className="aviso">{erro}</p>}
            <div className="acoes">
              <button className="secundario" onClick={aoFechar}>Cancelar</button>
              <button className="primario" disabled={enviando || token.trim().length < 20} onClick={conectar}>
                {enviando ? 'Conferindo…' : 'Conectar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
