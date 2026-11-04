import { useState, type DragEvent } from 'react'
import { chamarApi } from '../lib/api'
import { paraCampo, rotuloHorario } from '../lib/agenda'
import { supabase } from '../lib/supabase'

interface Midia {
  tipo: 'imagem' | 'video'
  url: string
  nome: string
  /** largura ÷ altura, das imagens */
  proporcao?: number
}

const LIMITE_LEGENDA = 2200
const LIMITE_IMAGENS = 10
const TIPOS_VIDEO = ['video/mp4', 'video/quicktime']

/** O feed aceita foto de 4:5 (mais alta) até 1,91:1 (mais larga); fora disso o Instagram recusa. */
const proporcaoAceita = (p: number) => p >= 0.8 - 0.01 && p <= 1.91 + 0.01

/** O Instagram só aceita JPEG pela API: PNG, WebP e HEIC viram JPEG no navegador antes de subir. */
async function emJpeg(f: File): Promise<{ blob: Blob; proporcao?: number }> {
  // JPEG sobe como está; se o navegador não conseguir ler, sobe sem conferir a proporção
  if (f.type === 'image/jpeg') {
    const proporcao = await createImageBitmap(f).then((b) => b.width / b.height, () => undefined)
    return { blob: f, proporcao }
  }
  const bitmap = await createImageBitmap(f)
  const proporcao = bitmap.width / bitmap.height
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const c = canvas.getContext('2d')
  if (!c) throw new Error('o navegador não converteu a imagem')
  c.fillStyle = '#fff'
  c.fillRect(0, 0, canvas.width, canvas.height)
  c.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob>((ok, falhou) => canvas.toBlob((b) => (b ? ok(b) : falhou(new Error('o navegador não converteu a imagem'))), 'image/jpeg', 0.92))
  return { blob, proporcao }
}

const nomeSeguro = (nome: string, ext: string) => (nome.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'arquivo') + ext

/**
 * Na aba "Publicar algo" do publicador: você manda um vídeo ou imagens prontos com a legenda e ele publica no
 * Instagram da marca (agora ou num horário), sem passar pela equipe. Vira um post na sala e no calendário.
 * Nada sai antes de você conferir e confirmar.
 */
export function PublicarDireto({
  marcaId,
  marcaNome,
  conectado,
  aoEnviar,
}: {
  marcaId: string
  marcaNome?: string
  /** a marca tem o Instagram conectado */
  conectado: boolean
  aoEnviar?: (postId: string) => void
}) {
  const [midias, setMidias] = useState<Midia[]>([])
  const [legenda, setLegenda] = useState('')
  const [agendar, setAgendar] = useState(false)
  const [quando, setQuando] = useState(() => paraCampo(new Date(Date.now() + 2 * 3600_000)))
  const [subindo, setSubindo] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const [conferindo, setConferindo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const video = midias.find((m) => m.tipo === 'video')
  const imagens = midias.filter((m) => m.tipo === 'imagem')
  const formato = video ? 'Reel' : imagens.length > 1 ? 'Carrossel' : 'Foto'

  const subir = async (arquivos: File[]) => {
    if (!supabase) return setErro('Entre na sua conta para mandar arquivos')
    setErro(null)
    const videos = arquivos.filter((f) => TIPOS_VIDEO.includes(f.type) || /\.(mp4|mov)$/i.test(f.name))
    const fotos = arquivos.filter((f) => f.type.startsWith('image/'))
    if (arquivos.length > videos.length + fotos.length) setErro('Só dá para mandar imagens ou vídeo MP4/MOV')
    if (videos.length && (video || videos.length > 1)) return setErro('Mande um vídeo só (o Reel). Para trocar, tire o que já está aqui.')
    const temVideo = !!video || videos.length > 0
    const cabem = temVideo ? Math.max(0, 1 - imagens.length) : LIMITE_IMAGENS - imagens.length
    if (fotos.length > cabem) setErro(temVideo ? 'Com vídeo, vai só uma imagem: a capa do Reel' : `O Instagram aceita até ${LIMITE_IMAGENS} imagens num carrossel`)
    const fila: { f: File; tipo: Midia['tipo'] }[] = [...videos.map((f) => ({ f, tipo: 'video' as const })), ...fotos.slice(0, cabem).map((f) => ({ f, tipo: 'imagem' as const }))]
    setSubindo((n) => n + fila.length)
    for (const { f, tipo } of fila) {
      try {
        const jpeg = tipo === 'imagem' ? await emJpeg(f) : null
        const corpo = jpeg?.blob ?? f
        const ext = tipo === 'imagem' ? '.jpg' : /\.mov$/i.test(f.name) || f.type === 'video/quicktime' ? '.mov' : '.mp4'
        const caminho = `${marcaId}/publicar/${Date.now()}-${nomeSeguro(f.name, ext)}`
        const { error } = await supabase.storage.from('marcas').upload(caminho, corpo, { contentType: tipo === 'imagem' ? 'image/jpeg' : f.type || 'video/mp4' })
        if (error) throw error
        const url = supabase.storage.from('marcas').getPublicUrl(caminho).data.publicUrl
        setMidias((m) => [...m, { tipo, url, nome: f.name, proporcao: jpeg?.proporcao }])
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erro'
        setErro(`Não subiu ${f.name}: ${/exceeded|too large|maximum/i.test(msg) ? 'arquivo grande demais para o armazenamento' : msg}`)
      } finally {
        setSubindo((n) => n - 1)
      }
    }
  }

  const tirar = (url: string) => setMidias((m) => m.filter((x) => x.url !== url))
  const mover = (i: number, d: -1 | 1) =>
    setMidias((m) => {
      const lista = m.filter((x) => x.tipo === 'imagem')
      const j = i + d
      if (j < 0 || j >= lista.length) return m
      ;[lista[i], lista[j]] = [lista[j], lista[i]]
      return [...m.filter((x) => x.tipo === 'video'), ...lista]
    })

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    void subir(Array.from(e.dataTransfer.files))
  }

  // capa de Reel pode ser vertical; foto e carrossel no feed, não
  const foraDoFeed = !video && imagens.some((m) => m.proporcao !== undefined && !proporcaoAceita(m.proporcao))
  const data = agendar ? new Date(quando) : null
  // Reel sempre com capa escolhida por você: sem ela o Instagram pega um quadro qualquer do vídeo
  const faltaCapa = !!video && imagens.length === 0
  const podeConferir = !foraDoFeed && !faltaCapa && conectado && midias.length > 0 && subindo === 0 && legenda.length <= LIMITE_LEGENDA && (!agendar || (!!data && !Number.isNaN(data.getTime())))

  const publicar = async () => {
    setEnviando(true)
    setErro(null)
    try {
      const r = await chamarApi<{ post: { id: string } }>('posts', {
        marca_id: marcaId,
        direto: { legenda, midias: [...(video ? [video] : []), ...imagens].map(({ tipo, url }) => ({ tipo, url })), quando: data ? data.toISOString() : undefined },
      })
      setPronto(agendar && data ? `Agendado para ${rotuloHorario(data)}. O publicador sobe na hora marcada e o post já está no calendário.` : 'O publicador já está subindo no Instagram. Quando sair, o post aparece no calendário como publicado.')
      setMidias([])
      setLegenda('')
      setConferindo(false)
      aoEnviar?.(r.post.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setEnviando(false)
    }
  }

  if (pronto)
    return (
      <section className="ideias publicar-direto">
        <p className="pd-pronto"><span>✓</span> {pronto}</p>
        <div className="ideia-acoes">
          <button className="secundario" onClick={() => setPronto(null)}>Publicar outro</button>
        </div>
      </section>
    )

  if (conferindo)
    return (
      <section className="ideias publicar-direto">
        <h3>Confira antes de publicar</h3>
        <p className="muted">
          {formato} no Instagram {marcaNome ? `da marca ${marcaNome}` : 'da marca'}, {agendar && data ? `em ${rotuloHorario(data)}` : 'agora'}. Depois de publicado, só dá para apagar pelo Instagram.
        </p>
        <div className="pd-previa">
          {video && <video src={video.url} controls playsInline muted poster={imagens[0]?.url} />}
          {!video && imagens.map((m, i) => <img key={m.url} src={m.url} alt={`Imagem ${i + 1}`} />)}
        </div>
        {video && imagens[0] && (
          <figure className="pd-capa">
            <img src={imagens[0].url} alt="Capa do Reel" />
            <figcaption className="muted pd-nota">Capa do Reel</figcaption>
          </figure>
        )}
        <div className="ag-texto pd-legenda">{legenda || <span className="muted">Sem legenda</span>}</div>
        <div className="ideia-acoes">
          <button className="primario" disabled={enviando} onClick={publicar}>
            {enviando ? 'Mandando…' : agendar ? 'Confirmar e agendar' : 'Confirmar e publicar'}
          </button>
          <button className="secundario" disabled={enviando} onClick={() => setConferindo(false)}>Voltar e mudar</button>
        </div>
        {erro && <p className="aviso">{erro}</p>}
      </section>
    )

  return (
    <section className="ideias publicar-direto">
      <h3>Publicar algo pronto</h3>
      <p className="muted">Mande um vídeo com a imagem da capa (vira Reel) ou de 1 a 10 imagens, com a legenda. Ele publica sem passar pela equipe e cria o post na sala e no calendário.</p>
      {!conectado && <p className="aviso">Esta marca ainda não tem o Instagram conectado. Conecte no perfil da sala para publicar.</p>}

      <label
        className={`pd-soltar${arrastando ? ' arrastando' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
      >
        <input
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,.mov"
          onChange={(e) => {
            void subir(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <strong>{subindo ? `Enviando ${subindo} ${subindo === 1 ? 'arquivo' : 'arquivos'}…` : 'Escolha ou arraste o vídeo ou as imagens'}</strong>
        <small className="muted">{video ? 'Agora mande a imagem da capa do Reel' : 'MP4 ou MOV para Reel (com a imagem da capa); JPG, PNG ou WebP para foto e carrossel'}</small>
      </label>

      {midias.length > 0 && (
        <ul className="pd-lista">
          {video && (
            <li>
              <video src={video.url} muted playsInline preload="metadata" />
              <span>Vídeo do Reel</span>
              <button className="link" onClick={() => tirar(video.url)}>Tirar</button>
            </li>
          )}
          {faltaCapa && (
            <li className="pd-falta-capa">
              <span className="pd-capa-vazia" aria-hidden />
              <span>Falta a capa do Reel</span>
              <label className="link pd-escolher-capa">
                Escolher capa
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    void subir(Array.from(e.target.files ?? []).slice(0, 1))
                    e.target.value = ''
                  }}
                />
              </label>
            </li>
          )}
          {imagens.map((m, i) => (
            <li key={m.url}>
              <img src={m.url} alt="" />
              <span>{video ? 'Capa' : imagens.length > 1 ? `${i + 1}ª imagem` : 'Imagem'}</span>
              {!video && imagens.length > 1 && (
                <>
                  <button className="link" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Mover para antes">↑</button>
                  <button className="link" disabled={i === imagens.length - 1} onClick={() => mover(i, 1)} aria-label="Mover para depois">↓</button>
                </>
              )}
              <button className="link" onClick={() => tirar(m.url)}>Tirar</button>
            </li>
          ))}
        </ul>
      )}

      {faltaCapa && subindo === 0 && <p className="aviso">Mande a imagem da capa do Reel: é ela que aparece no perfil e no feed.</p>}
      {foraDoFeed && <p className="aviso">O Instagram recusa foto mais alta que 4:5 (ou mais larga que 1,91:1) no feed. Recorte a imagem, ou mande um vídeo se for um Reel.</p>}

      <textarea rows={6} placeholder="Legenda do post, com hashtags se quiser" value={legenda} onChange={(e) => setLegenda(e.target.value)} />
      <small className={legenda.length > LIMITE_LEGENDA ? 'aviso' : 'muted'}>{legenda.length} de {LIMITE_LEGENDA} caracteres</small>

      <div className="pd-quando" role="radiogroup" aria-label="Quando publicar">
        <label><input type="radio" checked={!agendar} onChange={() => setAgendar(false)} /> Agora</label>
        <label><input type="radio" checked={agendar} onChange={() => setAgendar(true)} /> Agendar</label>
        {agendar && <input type="datetime-local" value={quando} min={paraCampo(new Date())} onChange={(e) => setQuando(e.target.value)} />}
      </div>

      <div className="ideia-acoes">
        <button className="primario" disabled={!podeConferir} onClick={() => setConferindo(true)}>Revisar antes de publicar</button>
      </div>
      {erro && <p className="aviso">{erro}</p>}
    </section>
  )
}
