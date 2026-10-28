import { useEffect, useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'

interface Midia {
  id: string
  caminho: string
  descricao: string | null
  tags: string[]
}

const urlDe = (caminho: string) => supabase!.storage.from('marcas').getPublicUrl(caminho).data.publicUrl

const slug = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')

/** Fotos aprovadas da marca: são as únicas que o designer pode usar. */
export function Biblioteca({ marcaId, aoFechar }: { marcaId: string; aoFechar: () => void }) {
  const [midias, setMidias] = useState<Midia[]>([])
  const [progresso, setProgresso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = () =>
    supabase
      ?.from('midias')
      .select('id, caminho, descricao, tags')
      .eq('marca_id', marcaId)
      .order('criado_em')
      .then(({ data }) => setMidias((data as Midia[]) ?? []))

  useEffect(() => {
    carregar()
  }, [marcaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!supabase || !e.target.files) return
    const arquivos = Array.from(e.target.files)
    setErro(null)
    for (const [i, f] of arquivos.entries()) {
      setProgresso(`Enviando ${i + 1} de ${arquivos.length}: ${f.name}`)
      const caminho = `${marcaId}/${slug(f.name)}`
      const { error } = await supabase.storage.from('marcas').upload(caminho, f, { contentType: f.type })
      // arquivo com o mesmo nome já enviado antes: reaproveita
      if (error && !/exists/i.test(error.message)) {
        setErro(`${f.name}: ${error.message}`)
        continue
      }
      const nome = f.name.replace(/\.[^.]+$/, '')
      if (!midias.some((m) => m.caminho === caminho)) {
        await supabase.from('midias').insert({
          marca_id: marcaId,
          caminho,
          descricao: nome.replace(/[-_]+/g, ' '),
          tags: /icone|logo/i.test(nome) ? ['icone'] : [],
        })
      }
    }
    setProgresso(null)
    e.target.value = ''
    carregar()
  }

  const remover = async (m: Midia) => {
    await supabase?.from('midias').delete().eq('id', m.id)
    carregar()
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal modal-largo" onClick={(e) => e.stopPropagation()}>
        <h2>Fotos da marca</h2>
        <p className="muted">O designer só usa as fotos daqui. Arquivos com "icone" ou "logo" no nome viram o ícone da marca.</p>
        <label className="secundario envio" htmlFor="fotos">
          Escolher fotos
          <input id="fotos" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={enviar} hidden />
        </label>
        {progresso && <p className="mono muted">{progresso}</p>}
        {erro && <p className="aviso">{erro}</p>}
        <div className="biblioteca">
          {midias.length === 0 && <p className="muted">Nenhuma foto ainda.</p>}
          {midias.map((m) => (
            <figure key={m.id}>
              <img src={urlDe(m.caminho)} alt={m.descricao ?? ''} loading="lazy" />
              <figcaption>
                {m.descricao}
                {m.tags.includes('icone') && <span className="chip">ícone</span>}
              </figcaption>
              <button className="link" onClick={() => remover(m)}>Remover</button>
            </figure>
          ))}
        </div>
        <div className="acoes">
          <button className="primario" onClick={aoFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
