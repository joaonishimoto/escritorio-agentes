import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db.js'
import { origemDaRequisicao, rota } from './_lib/http.js'

// Importação única do kit de marca do FreelaPRO (README do kit, 28/10/2026). Chamada pelo banco com o segredo do agendador.

const TOM = `Fala de igual para igual com quem vive de freela: freelancers, autônomos e agências pequenas (design, social media, vídeo). Português do Brasil, sempre "você", frases curtas, uma ideia por frase. Soa como um colega explicando, não como anúncio.

Parte da dor concreta do dia a dia: briefing perdido no WhatsApp, áudio de 3 minutos, prazo que estoura sem aviso, sinal que não veio, parcela que ninguém cobrou. Contraria o senso comum ("O problema não é falta de trabalho. É trabalho espalhado." / "Freelancer não perde dinheiro por falta de cliente. Perde no meio da bagunça.").

Concreto e com número ("204 horas por ano só em burocracia", "Pronto em 2 minutos", "Leva 20 segundos"). Todo dado de pesquisa vai com fonte. Sem jargão e sem exagero: nada de "revolucionário", "plataforma completa" ou "gestão 360"; prefira card, quadro, portal, link. Sempre tira o medo do próximo passo: grátis, sem cartão, cancele quando quiser, funciona no celular. Não use travessão; use ponto ou vírgula. No máximo 1 emoji.

Nome: sempre FreelaPRO ("Freela" com F maiúsculo, "PRO" todo em maiúsculas).

Mensagens-chave
- Promessa: Organize seus clientes. Receba em dia.
- Apoio: Pedidos, prazos, propostas e pagamentos de todos os seus clientes em um só lugar. Menos tempo caçando mensagem no WhatsApp, mais tempo fazendo o trabalho que paga as contas.
- As três dores: o briefing se perde na conversa (no FreelaPRO cada pedido vira um card com briefing, arquivos e prazo); o prazo estoura sem aviso (alertas do que vence hoje, amanhã e do que já atrasou); o dinheiro fica parado (cada job mostra o que já foi pago e o que falta receber). Fecho: Você não precisa trabalhar mais. Precisa parar de perder o que já trabalhou.
- Os quatro pilares: Organize (todo pedido vira um card, com prazo e responsável), Receba pedidos (o cliente pede pelo portal, não pelo WhatsApp), Feche (proposta enviada por link e aceita online), Receba (saiba quanto vai entrar no mês).
- Em 3 passos, do caos ao controle: crie sua conta grátis (30 s), cadastre clientes e jobs (5 min), mande o portal para o cliente (1 link).
- Calculadora: "Quanto a desorganização custa para você?" O plano Solo se paga no primeiro dia.
- Preços (só cite se o post pedir, e confira antes): Free R$ 0; Solo R$ 29,90/mês (R$ 24,90/mês no anual); Equipe R$ 59,90/mês (R$ 49,90 no anual); Agência R$ 119,90/mês (R$ 99,90 no anual, usuário extra R$ 9,90). Um preço por workspace, sem cobrança por cliente ou tarefa; anual dá 2 meses grátis.
- Selos de confiança: Sem cartão de crédito · Cancele quando quiser · Pronto em 2 minutos · Funciona no celular · Pagamento seguro via Stripe · Segue a LGPD.
- Fecho: Seu próximo cliente merece um freela organizado. Feito no Brasil para quem vive de freela.

Legenda: primeira linha é um gancho que contraria o senso comum ou nomeia a dor, em até 12 palavras. Termina com um CTA da marca: "Criar minha conta grátis →", "Começar agora, é grátis →", "Parar de perder dinheiro, grátis" ou, em Reels, "Faz a conta de graça no link da bio."

Reels: gancho que contraria o senso comum, dores com número, virada ("o prejuízo é invisível"), FreelaPRO em uma frase, CTA para o link da bio.`

const IDENTIDADE = {
  nome: 'Escreva FreelaPRO. No logo e nos slides, "Freela" na cor do texto e "PRO" em azul (ou tudo branco sobre fundo azul ou foto).',
  cores: {
    azul: '#0B64F4',
    azul_icone: '#2563EB',
    azul_profundo: '#052C6B',
    azul_claro: '#ECF3FE',
    fundo: '#FCFCFC',
    cartao: '#FFFFFF',
    texto: '#14181F',
    texto_secundario: '#737B8C',
    borda: '#E2E4E9',
  },
  cores_status: { recebido: '#21C45D', atencao: '#F59F0A', atrasado: '#EF4343' },
  regra_de_cor:
    'Quase tudo branco, preto e azul. O azul é a única cor de destaque; verde, amarelo e vermelho só aparecem para dizer estado (pago, vence hoje, atrasado). Gradiente de destaque: de hsl(217 91% 45%) a #052C6B em 160°.',
  fonte: 'Plus Jakarta Sans (Google Fonts, pesos 400 a 800). Títulos 700 ou 800, letter-spacing -0.025em, line-height 1.15. Texto 400, line-height 1.6. Botões 600.',
  estilo: 'Minimalista e limpo: fundo claro com muito respiro, um destaque azul por slide, cantos arredondados de 10 px em botões e cartões (14 a 16 px em blocos maiores), sombras suaves.',
  logo: 'Maleta (ícone briefcase do Lucide) em traço branco dentro de um quadrado azul #2563EB com cantos arredondados (~19%). Não esticar, não trocar o azul, sem sombra ou contorno, respiro de pelo menos metade da altura do ícone.',
  fotos: 'Telas do app (quadro de tarefas, portal do cliente, propostas, financeiro) em celular ou notebook e situações reais de freela. Nada de banco de imagem genérico de escritório.',
  reels:
    'Vertical 9:16. Paleta dos Reels 3D: fundo azul-noite #0B1220, frente #F5F7FB, azul #0B64F3 e vermelho do prejuízo #F04B4B. Nas cenas do problema o destaque é o vermelho, em um elemento por cena; na solução o vermelho some e o azul assume. Voz ElevenLabs Mário (YU8EsJtXFMyKMxYtheDk), alternativa Elvis (zNEsdgTUa3ndwKry8Xcq), modelo eleven_multilingual_v2, velocidade 0.95, estabilidade 0.5.',
  dominios: 'freelapro.com (app) e use.freelapro.com (landing)',
}

const CHECKLIST_EXTRA = [
  '- Sem travessão no texto (use ponto ou vírgula)',
  '- Dado de pesquisa sempre com a fonte',
  '- Sem jargão nem exagero ("revolucionário", "plataforma completa", "gestão 360")',
  '- Só azul como cor de destaque; verde, amarelo e vermelho apenas para status',
  '- Preço citado confere com a tabela do perfil',
]

const ARQUIVOS: { arquivo: string; descricao: string; tipo: string; novo?: boolean }[] = [
  { arquivo: 'icone-app.png', descricao: 'Ícone do FreelaPRO: maleta branca em quadrado azul #2563EB (avatar, assinatura)', tipo: 'icone', novo: true },
  { arquivo: 'icone-branco.png', descricao: 'Ícone em versão branca (maleta azul) para usar sobre fundo azul ou foto', tipo: 'icone', novo: true },
  { arquivo: 'logo-horizontal-fundo-claro.png', descricao: 'Logo horizontal para fundo claro: ícone + Freela em preto e PRO em azul', tipo: 'icone', novo: true },
  { arquivo: 'logo-horizontal-fundo-escuro.png', descricao: 'Logo horizontal para fundo escuro: ícone + Freela em cinza claro e PRO em azul', tipo: 'icone', novo: true },
  { arquivo: 'logo-horizontal-branco.png', descricao: 'Logo horizontal todo branco, para fundo azul ou foto', tipo: 'icone', novo: true },
  { arquivo: 'paleta.png', descricao: 'Paleta de cores do FreelaPRO com o gradiente da landing', tipo: 'inspiracao', novo: true },
  { arquivo: 'capa-freelapro.jpg', descricao: 'Imagem de compartilhamento: FreelaPRO em branco sobre azul', tipo: 'foto' },
  { arquivo: 'tela-quadro-de-tarefas.png', descricao: 'Tela do quadro de tarefas (A fazer, Em produção, Aprovação, Concluído) com jobs de clientes', tipo: 'produto' },
  { arquivo: 'tela-financeiro.png', descricao: 'Tela do financeiro: recebido, a receber, atrasado e fluxo de caixa do mês', tipo: 'produto' },
  { arquivo: 'tela-propostas.png', descricao: 'Tela de propostas com status (em construção, visualizada, aceita, recusada)', tipo: 'produto' },
  { arquivo: 'tela-cliente.png', descricao: 'Tela de um cliente com visão geral, entregas e pagamentos', tipo: 'produto' },
  { arquivo: 'tela-metricas-modo-escuro.png', descricao: 'Tela de métricas no modo escuro', tipo: 'produto' },
  { arquivo: 'tela-celular.png', descricao: 'O app no celular: área de trabalho, calendário e clientes', tipo: 'produto' },
  { arquivo: 'tela-portal-do-cliente.jpg', descricao: 'Portal do cliente no computador: o cliente vê o que aguarda resposta, entregas e propostas', tipo: 'produto' },
  { arquivo: 'tela-portal-celular.jpg', descricao: 'Portal do cliente no celular', tipo: 'produto' },
]

export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { data: token } = await db.from('config_app').select('valor').eq('chave', 'token_agendador').single()
  if (!token?.valor || req.headers['x-agendador'] !== token.valor) return res.status(401).end()

  const { data: marcas } = await db.from('marcas').select('id, nome, identidade, checklist_revisor')
  const m = (marcas ?? []).find((x) => x.nome.trim().toLowerCase() === 'freelapro')
  if (!m) return res.status(404).json({ erro: 'marca não encontrada' })

  let checklist = String(m.checklist_revisor ?? '')
  for (const linha of CHECKLIST_EXTRA) if (!checklist.includes(linha)) checklist = `${checklist}\n${linha}`.trim()
  const antiga = (m.identidade ?? {}) as Record<string, unknown>
  const { error } = await db
    .from('marcas')
    .update({
      nome: 'FreelaPRO',
      tom_de_voz: TOM,
      // mantém o que o app cuida sozinho (cor e decoração da sala, Instagram)
      identidade: { ...antiga, ...IDENTIDADE, tom_editado: true },
      hashtags_fixas: ['#freelapro', '#freelancer', '#freela', '#designer', '#socialmedia', '#organização'],
      checklist_revisor: checklist,
    })
    .eq('id', m.id)

  const origem = origemDaRequisicao(req)
  const feitos: string[] = []
  const { data: jaTem } = await db.from('midias').select('caminho').eq('marca_id', m.id)
  for (const a of ARQUIVOS) {
    const caminho = `${m.id}/${a.arquivo}`
    if ((jaTem ?? []).some((x) => x.caminho === caminho)) continue
    if (a.novo) {
      const r = await fetch(`${origem}/importar/freelapro-kit/${a.arquivo}`)
      if (!r.ok) {
        feitos.push(`${a.arquivo}: ${r.status}`)
        continue
      }
      const up = await db.storage.from('marcas').upload(caminho, Buffer.from(await r.arrayBuffer()), { contentType: 'image/png', upsert: true })
      if (up.error) {
        feitos.push(`${a.arquivo}: ${up.error.message}`)
        continue
      }
    }
    const { error: e } = await db.from('midias').insert({ marca_id: m.id, caminho, descricao: a.descricao, tags: [a.tipo] })
    feitos.push(e ? `${a.arquivo}: ${e.message}` : a.arquivo)
  }
  return res.status(200).json({ perfil: error ? error.message : 'ok', referencias: feitos })
})
