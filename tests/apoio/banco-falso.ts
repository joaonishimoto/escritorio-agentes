// Banco falso em memória com a parte da API do supabase-js que as rotas usam.
// Serve para testar fluxos inteiros (aprovar, fila do executor) sem rede e sem Supabase.
type Linha = Record<string, unknown>
type Filtro = (l: Linha) => boolean

const CHAVES: Record<string, string> = { config_app: 'chave', metricas: 'post_id' }

export class BancoFalso {
  tabelas: Record<string, Linha[]> = {}
  rpcs: Record<string, (args: Record<string, unknown>) => unknown> = {}
  private seq = 0

  novoId() {
    this.seq++
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`
  }
  tabela(nome: string) {
    return (this.tabelas[nome] ??= [])
  }
  from(nome: string) {
    return new Consulta(this, nome)
  }
  async rpc(nome: string, args: Record<string, unknown> = {}) {
    const f = this.rpcs[nome]
    if (!f) return { data: null, error: { message: `rpc ${nome} não existe no banco falso` } }
    return { data: f(args) ?? null, error: null }
  }
}

class Consulta implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }> {
  private filtros: Filtro[] = []
  private op: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select'
  private dados: Linha | Linha[] | null = null
  private um: 'single' | 'maybe' | null = null
  private ordem: { col: string; asc: boolean } | null = null
  private limite: number | null = null
  private contar = false
  private soContar = false

  constructor(
    private banco: BancoFalso,
    private nome: string,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.contar = true
    if (opts?.head) this.soContar = true
    return this
  }
  update(v: Linha) {
    this.op = 'update'
    this.dados = v
    return this
  }
  insert(v: Linha | Linha[]) {
    this.op = 'insert'
    this.dados = v
    return this
  }
  upsert(v: Linha | Linha[]) {
    this.op = 'upsert'
    this.dados = v
    return this
  }
  delete(opts?: { count?: string }) {
    this.op = 'delete'
    if (opts?.count) this.contar = true
    return this
  }
  eq(c: string, v: unknown) {
    this.filtros.push((l) => l[c] === v)
    return this
  }
  neq(c: string, v: unknown) {
    this.filtros.push((l) => l[c] !== v)
    return this
  }
  in(c: string, vs: unknown[]) {
    this.filtros.push((l) => vs.includes(l[c]))
    return this
  }
  lt(c: string, v: string | number) {
    this.filtros.push((l) => l[c] != null && (l[c] as string | number) < v)
    return this
  }
  lte(c: string, v: string | number) {
    this.filtros.push((l) => l[c] != null && (l[c] as string | number) <= v)
    return this
  }
  gte(c: string, v: string | number) {
    this.filtros.push((l) => l[c] != null && (l[c] as string | number) >= v)
    return this
  }
  is(c: string, v: unknown) {
    this.filtros.push((l) => (l[c] ?? null) === v)
    return this
  }
  not(c: string, op: string, v: unknown) {
    if (op === 'is') this.filtros.push((l) => (l[c] ?? null) !== v)
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.ordem = { col, asc: opts?.ascending !== false }
    return this
  }
  limit(n: number) {
    this.limite = n
    return this
  }
  single() {
    this.um = 'single'
    return this
  }
  maybeSingle() {
    this.um = 'maybe'
    return this
  }

  private executar() {
    const tabela = this.banco.tabela(this.nome)
    const casa = (l: Linha) => this.filtros.every((f) => f(l))
    let linhas: Linha[]
    if (this.op === 'insert' || this.op === 'upsert') {
      const novas = (Array.isArray(this.dados) ? this.dados : [this.dados!]).map((d) => ({ ...d }))
      const chave = CHAVES[this.nome] ?? 'id'
      linhas = novas.map((n) => {
        const existente = this.op === 'upsert' && n[chave] != null ? tabela.find((l) => l[chave] === n[chave]) : undefined
        if (existente) return Object.assign(existente, n)
        const linha = { id: this.banco.novoId(), criado_em: new Date().toISOString(), status: this.nome === 'passos' ? 'pendente' : undefined, tentativas: 0, ...n }
        tabela.push(linha)
        return linha
      })
    } else if (this.op === 'update') {
      linhas = tabela.filter(casa)
      for (const l of linhas) Object.assign(l, this.dados)
    } else if (this.op === 'delete') {
      linhas = tabela.filter(casa)
      this.banco.tabelas[this.nome] = tabela.filter((l) => !casa(l))
    } else {
      linhas = tabela.filter(casa)
    }
    if (this.ordem) {
      const { col, asc } = this.ordem
      linhas = [...linhas].sort((a, b) => ((a[col] as string) > (b[col] as string) ? 1 : (a[col] as string) < (b[col] as string) ? -1 : 0) * (asc ? 1 : -1))
    }
    if (this.limite !== null) linhas = linhas.slice(0, this.limite)
    const copia = linhas.map((l) => ({ ...l }))
    if (this.soContar) return { data: null, error: null, count: copia.length }
    if (this.um) {
      if (!copia.length) return this.um === 'single' ? { data: null, error: { message: 'nenhuma linha' } } : { data: null, error: null }
      return { data: copia[0], error: null }
    }
    return { data: copia, error: null, count: this.contar ? copia.length : null }
  }

  then<A, B>(ok?: ((v: { data: unknown; error: { message: string } | null; count?: number | null }) => A | PromiseLike<A>) | null, falha?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve()
      .then(() => this.executar())
      .then(ok, falha)
  }
}
