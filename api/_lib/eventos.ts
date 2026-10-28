import { db } from './db'

type Tipo = 'inicio' | 'acao' | 'texto' | 'fim' | 'entrega' | 'espera' | 'erro'

/**
 * Grava os eventos que o escritório 3D anima. O texto em streaming é agrupado
 * e gravado a cada ~600 ms para não criar uma linha por token.
 */
export class Emissor {
  private buffer = ''
  private ultimoFlush = Date.now()

  constructor(
    private postId: string,
    private agente: string,
  ) {}

  private async gravar(tipo: Tipo, mensagem: string, extra: { para?: string; custo_usd?: number } = {}) {
    const { error } = await db.from('eventos').insert({ post_id: this.postId, agente: this.agente, tipo, mensagem, ...extra })
    if (error) console.error('falha ao gravar evento', error.message)
  }

  inicio(msg: string) {
    return this.gravar('inicio', msg)
  }
  async acao(msg: string) {
    await this.flush()
    return this.gravar('acao', msg)
  }
  async texto(trecho: string) {
    this.buffer += trecho
    if (Date.now() - this.ultimoFlush > 600) await this.flush()
  }
  async flush() {
    this.ultimoFlush = Date.now()
    if (!this.buffer) return
    const t = this.buffer
    this.buffer = ''
    await this.gravar('texto', t)
  }
  async fim(msg: string, custo_usd?: number) {
    await this.flush()
    return this.gravar('fim', msg, { custo_usd })
  }
  async entrega(para: string, msg: string, custo_usd?: number) {
    await this.flush()
    return this.gravar('entrega', msg, { para, custo_usd })
  }
  async espera(msg: string) {
    await this.flush()
    return this.gravar('espera', msg)
  }
  async erro(msg: string) {
    await this.flush()
    return this.gravar('erro', msg)
  }
}
