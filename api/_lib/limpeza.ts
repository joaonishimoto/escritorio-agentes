// Faxina diária: apaga o que ninguém mais vai ver, para o banco e o Storage não crescerem sem parar.
// - narração passo a passo (eventos 'acao' e 'inicio') de mais de 60 dias; erros, entregas e textos ficam
// - todas as imagens e vídeos de posts reprovados há mais de 30 dias
// - versões antigas dos slides e vídeos de posts publicados há mais de 7 dias (fica só o que foi publicado)
// - pastas de posts que não existem mais
import { BUCKET_POSTS, db } from './db.js'

const DIA = 86_400_000

/** Arquivos de uma pasta que não estão em uso (os usados vêm como caminho ou URL pública). */
export function arquivosParaApagar(arquivos: string[], usados: string[]) {
  return arquivos.filter((a) => !usados.some((u) => u === a || u.endsWith(`/${a}`)))
}

/** Caminhos que um post ainda usa: os slides e o vídeo. */
export function usadosPeloPost(p: { slides?: { caminho?: string; url?: string }[] | null; video?: { url?: string } | null }) {
  return [...(p.slides ?? []).flatMap((s) => [s.caminho, s.url]), p.video?.url].filter((x): x is string => !!x)
}

/** Todos os arquivos dentro de uma pasta do bucket (desce um nível de subpastas, que é como o app grava). */
async function listar(pasta: string): Promise<string[]> {
  const bucket = db.storage.from(BUCKET_POSTS)
  const { data } = await bucket.list(pasta, { limit: 1000 })
  const arquivos: string[] = []
  for (const item of data ?? []) {
    const caminho = `${pasta}/${item.name}`
    if (item.id) arquivos.push(caminho)
    else {
      const { data: dentro } = await bucket.list(caminho, { limit: 1000 })
      for (const d of dentro ?? []) if (d.id) arquivos.push(`${caminho}/${d.name}`)
    }
  }
  return arquivos
}

async function apagar(caminhos: string[]) {
  let n = 0
  for (let i = 0; i < caminhos.length; i += 100) {
    const lote = caminhos.slice(i, i + 100)
    const { error } = await db.storage.from(BUCKET_POSTS).remove(lote)
    if (!error) n += lote.length
  }
  return n
}

export async function fazerLimpeza(agora = new Date()) {
  const antes = (dias: number) => new Date(agora.getTime() - dias * DIA).toISOString()
  const r = { eventos: 0, arquivos: 0, pastas_orfas: 0, em: agora.toISOString() }

  const { count } = await db.from('eventos').delete({ count: 'exact' }).in('tipo', ['acao', 'inicio']).lt('criado_em', antes(60))
  r.eventos = count ?? 0

  const { data: reprovados } = await db.from('posts').select('id').eq('status', 'reprovado').lt('criado_em', antes(30)).limit(50)
  for (const p of reprovados ?? []) r.arquivos += await apagar(await listar(p.id))

  const { data: publicados } = await db.from('posts').select('id, slides, video').eq('status', 'publicado').lt('publicado_em', antes(7)).limit(50)
  for (const p of publicados ?? []) r.arquivos += await apagar(arquivosParaApagar(await listar(p.id), usadosPeloPost(p)))

  // pastas na raiz do bucket sem post correspondente (post apagado)
  const { data: raiz } = await db.storage.from(BUCKET_POSTS).list('', { limit: 1000 })
  const pastas = (raiz ?? []).filter((i) => !i.id && /^[0-9a-f-]{36}$/.test(i.name)).map((i) => i.name)
  if (pastas.length) {
    const { data: existem } = await db.from('posts').select('id').in('id', pastas)
    const vivos = new Set((existem ?? []).map((p) => p.id))
    for (const pasta of pastas.filter((p) => !vivos.has(p))) {
      const n = await apagar(await listar(pasta))
      r.arquivos += n
      if (n) r.pastas_orfas++
    }
  }

  await db.from('config_app').upsert({ chave: 'ultima_limpeza', valor: JSON.stringify(r), atualizado_em: agora.toISOString() })
  return r
}
