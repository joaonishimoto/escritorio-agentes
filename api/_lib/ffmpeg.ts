import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

// FFmpeg estático (o do pacote @ffmpeg-installer/linux-x64) para pôr a narração no vídeo com áudio AAC, que o Instagram exige.
// Na Vercel o binário não vem no pacote da função: baixa do registro do npm na primeira vez e fica em /tmp enquanto a função estiver quente.
const PACOTE = 'https://registry.npmjs.org/@ffmpeg-installer/linux-x64/-/linux-x64-4.1.0.tgz'
const SHA1_PACOTE = 'b4a5d89c4e12e6d9306dbcdc573df716ec1c4323'
const LOCAIS = [join(process.cwd(), 'node_modules/@ffmpeg-installer/linux-x64/ffmpeg')]
let pronto: Promise<string> | null = null

const executavel = (caminho: string) => access(caminho, constants.X_OK).then(() => true, () => false)

/** Tira um arquivo de dentro de um .tar (cabeçalhos de 512 bytes, tamanho em octal). */
function arquivoDoTar(tar: Buffer, nome: string) {
  for (let i = 0; i + 512 <= tar.length; ) {
    const cabecalho = tar.subarray(i, i + 512)
    const n = cabecalho.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '')
    if (!n) break
    const tamanho = parseInt(cabecalho.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim(), 8)
    if (n === nome) return tar.subarray(i + 512, i + 512 + tamanho)
    i += 512 + Math.ceil(tamanho / 512) * 512
  }
  throw new Error(`${nome} não está no pacote do ffmpeg`)
}

async function baixar() {
  const destino = join(tmpdir(), 'ffmpeg-4.1.0')
  if (await executavel(destino)) return destino
  const r = await fetch(PACOTE)
  if (!r.ok) throw new Error(`Não consegui baixar o ffmpeg (HTTP ${r.status})`)
  const tgz = Buffer.from(await r.arrayBuffer())
  if (createHash('sha1').update(tgz).digest('hex') !== SHA1_PACOTE) throw new Error('O pacote do ffmpeg veio diferente do esperado')
  const temporario = `${destino}-${process.pid}`
  await writeFile(temporario, arquivoDoTar(gunzipSync(tgz), 'package/ffmpeg'), { mode: 0o755 })
  await rename(temporario, destino)
  return destino
}

/** Caminho de um ffmpeg executável: o instalado (local) ou o baixado para /tmp. */
async function binario() {
  for (const c of LOCAIS) if (await executavel(c)) return c
  pronto ??= baixar().catch((e) => {
    pronto = null
    throw e
  })
  return pronto
}

async function rodar(args: string[]) {
  const exe = await binario()
  return new Promise<string>((ok, falhou) => {
    const p = spawn(exe, ['-hide_banner', ...args])
    let saida = ''
    p.stderr.on('data', (d) => { saida += d })
    p.on('error', falhou)
    p.on('close', (codigo) => (codigo === 0 ? ok(saida) : falhou(new Error(`ffmpeg saiu com ${codigo}: ${saida.slice(-400)}`))))
  })
}

/** Duração em segundos, lida do que o ffmpeg imprime ao abrir o arquivo. */
async function duracao(arquivo: string) {
  const saida = await rodar(['-i', arquivo, '-f', 'null', '-t', '0', '-']).catch((e: Error) => e.message)
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(saida)
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0
}

/**
 * Junta a narração (MP3) ao vídeo (MP4) e devolve um MP4 com áudio AAC.
 * A voz entra depois de `atraso` segundos; se ela for mais longa que o vídeo, o último quadro fica parado até ela acabar.
 */
export async function juntarNarracao(video: Buffer, voz: Buffer, atraso = 0.3): Promise<{ mp4: Buffer; segundos: number }> {
  const pasta = await mkdtemp(join(tmpdir(), 'narracao-'))
  try {
    const [v, a, saida] = ['video.mp4', 'voz.mp3', 'saida.mp4'].map((n) => join(pasta, n))
    await writeFile(v, video)
    await writeFile(a, voz)
    const [dv, da] = await Promise.all([duracao(v), duracao(a)])
    const total = Math.max(dv, da + atraso + 0.4)
    const ms = Math.round(atraso * 1000)
    const audio = `[1:a]adelay=${ms}|${ms},apad,atrim=0:${total.toFixed(2)}[a]`
    const esticar = total > dv + 0.05
    await rodar([
      '-y',
      '-i', v,
      '-i', a,
      '-filter_complex', esticar ? `[0:v]tpad=stop_mode=clone:stop_duration=${(total - dv).toFixed(2)}[v];${audio}` : audio,
      '-map', esticar ? '[v]' : '0:v',
      '-map', '[a]',
      ...(esticar ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p'] : ['-c:v', 'copy']),
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      '-t', total.toFixed(2),
      '-movflags', '+faststart',
      saida,
    ])
    return { mp4: await readFile(saida), segundos: Math.round(total * 10) / 10 }
  } finally {
    await rm(pasta, { recursive: true, force: true })
  }
}
