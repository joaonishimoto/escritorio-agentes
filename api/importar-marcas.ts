import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db.js'
import { origemDaRequisicao, rota } from './_lib/http.js'

// Importação única dos perfis e referências do FreelaPRO e da Engetak, tirados dos projetos freelaprobr e engetakhub.
// Chamada pelo banco (pg_net) com o mesmo segredo do agendador; pode rodar de novo sem duplicar nada.

const PERFIS: Record<string, { tom_de_voz: string; identidade: Record<string, unknown>; hashtags_fixas: string[]; checklist_extra?: string }> = {
  freelapro: {
    tom_de_voz: `Fala com freelancers, autônomos e pequenas agências do Brasil (design, social media, vídeo, dev). Tom direto, próximo e prático, sempre em "você", em português do dia a dia, sem gíria forçada e sem jargão corporativo.

Começa pela dor real com uma cena concreta: briefing perdido num áudio do WhatsApp, prazo que estoura sem aviso, sinal que não veio, job entregue e não cobrado. Depois mostra a saída simples dentro do FreelaPRO (cada pedido vira um card, portal do cliente, proposta aceita por link, financeiro com o que falta receber).

Frases curtas e verbos de ação: organize, receba, feche, cobre. Nada de promessa milagrosa; use números concretos quando houver (plano Free sem cartão, Solo a partir de R$ 24,90/mês, pronto em 2 minutos). No máximo 1 emoji.

Escreva o nome sempre como FreelaPRO. Primeira linha da legenda é um gancho de até ~12 palavras; termina com chamada para começar grátis, sem cartão, pelo link da bio, ou com uma pergunta sobre a rotina do freela.`,
    identidade: {
      cores: { azul: '#0B64F4', azul_escuro: '#052C6B', texto: '#14181F', fundo: '#FCFCFC', azul_claro: '#ECF3FE' },
      fonte: 'Plus Jakarta Sans (títulos 700, texto 400/500)',
      nome: 'Escreva FreelaPRO com o PRO na cor azul da marca',
      estilo: 'Minimalista: azul, branco e preto. Fundo claro com muito respiro, um destaque azul por slide, cantos arredondados (10px) e sombras suaves.',
      fotos: 'Telas do app (quadro de tarefas, portal do cliente, propostas, financeiro) em celular ou notebook e situações reais de freela. Nada de banco de imagem genérico de escritório.',
    },
    hashtags_fixas: ['#freelapro', '#freelancer', '#freela', '#autonomo', '#produtividade'],
    checklist_extra: '- Nome escrito FreelaPRO, com o PRO em azul quando aparece no slide',
  },
  engetak: {
    tom_de_voz: `A Engetak é uma empresa de engenharia mecânica: projeto de máquinas e equipamentos, modelagem 3D, detalhamento 2D, lista de peças, documentação técnica e revisão de projeto, com acompanhamento de cada etapa.

Fala com indústrias, gestores de engenharia e manutenção e compradores técnicos. Tom profissional, técnico e confiante, sem ser frio: explica com clareza, usa os termos certos (modelagem 3D, detalhamento, revisão, montagem) e não enrola.

Mostra processo, precisão e entrega no prazo com provas concretas: etapas do projeto, tipo de equipamento, do 3D ao desenho de fabricação, antes e depois. Nada de gíria nem exagero ("o melhor do Brasil"). Emoji: nenhum ou 1 discreto.

Primeira linha da legenda traz o problema técnico ou o benefício para a operação; termina com convite para falar com a equipe pelo direct ou pelo link da bio.`,
    identidade: {
      cores: { verde_agua: '#37AEA4', grafite: '#2C3030', texto: '#222626', fundo: '#F7F8F8', ciano: '#22D3EE' },
      fonte: 'Inter (títulos 700, texto 400)',
      estilo: 'Visual técnico e limpo: fundo grafite escuro ou neutro claro, destaque em verde-água, linhas finas de desenho técnico ou grade ao fundo. Um destaque de cor por slide.',
      logo: 'Quatro retângulos arredondados em contorno verde-água, crescendo da esquerda para a direita (logo-engetak.png). Use sobre fundo grafite ou claro, sem distorcer.',
      fotos: 'Renders 3D, desenhos técnicos e fotos reais de equipamentos e fabricação. Nada de banco de imagem genérico.',
    },
    hashtags_fixas: ['#engetak', '#engenhariamecanica', '#projetomecanico', '#modelagem3d', '#industria'],
  },
}

const ARQUIVOS: Record<string, { arquivo: string; descricao: string; icone?: boolean }[]> = {
  freelapro: [
    { arquivo: 'icone-freelapro.png', descricao: 'Ícone do app FreelaPRO: maleta branca em quadrado azul arredondado', icone: true },
    { arquivo: 'capa-freelapro.jpg', descricao: 'Capa da marca: FreelaPRO em branco sobre azul, "Gestão completa para freelancers e agências"' },
    { arquivo: 'tela-quadro-de-tarefas.png', descricao: 'Tela do quadro de tarefas (A fazer, Em produção, Aprovação, Concluído) com jobs de clientes' },
    { arquivo: 'tela-financeiro.png', descricao: 'Tela do financeiro: recebido, a receber, atrasado e fluxo de caixa do mês' },
    { arquivo: 'tela-propostas.png', descricao: 'Tela de propostas com status (em construção, visualizada, aceita, recusada)' },
    { arquivo: 'tela-cliente.png', descricao: 'Tela de um cliente com visão geral, entregas e pagamentos' },
    { arquivo: 'tela-metricas-modo-escuro.png', descricao: 'Tela de métricas no modo escuro' },
    { arquivo: 'tela-celular.png', descricao: 'O app no celular: área de trabalho, calendário e clientes' },
    { arquivo: 'tela-portal-do-cliente.jpg', descricao: 'Portal do cliente no computador: o cliente vê o que aguarda resposta, entregas e propostas' },
    { arquivo: 'tela-portal-celular.jpg', descricao: 'Portal do cliente no celular' },
  ],
  engetak: [
    { arquivo: 'logo-engetak.png', descricao: 'Logo da Engetak: quatro retângulos em contorno verde-água (fundo transparente)', icone: true },
    { arquivo: 'icone-app-engetakhub.png', descricao: 'Ícone do EngetakHub, mesmo desenho do logo', icone: true },
  ],
}

export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { data: token } = await db.from('config_app').select('valor').eq('chave', 'token_agendador').single()
  if (!token?.valor || req.headers['x-agendador'] !== token.valor) return res.status(401).end()

  const origem = origemDaRequisicao(req)
  const relatorio: Record<string, unknown> = {}
  const { data: marcas } = await db.from('marcas').select('id, nome, identidade, checklist_revisor')
  for (const [chave, perfil] of Object.entries(PERFIS)) {
    const m = (marcas ?? []).find((x) => x.nome.trim().toLowerCase() === chave)
    if (!m) {
      relatorio[chave] = 'marca não encontrada'
      continue
    }
    const checklist = String(m.checklist_revisor ?? '')
    const { error } = await db
      .from('marcas')
      .update({
        tom_de_voz: perfil.tom_de_voz,
        identidade: { ...(m.identidade ?? {}), ...perfil.identidade },
        hashtags_fixas: perfil.hashtags_fixas,
        ...(perfil.checklist_extra && !checklist.includes(perfil.checklist_extra) ? { checklist_revisor: `${checklist}\n${perfil.checklist_extra}` } : {}),
      })
      .eq('id', m.id)
    const enviados: string[] = []
    const { data: jaTem } = await db.from('midias').select('caminho').eq('marca_id', m.id)
    for (const a of ARQUIVOS[chave] ?? []) {
      const caminho = `${m.id}/${a.arquivo}`
      if ((jaTem ?? []).some((x) => x.caminho === caminho)) continue
      const r = await fetch(`${origem}/importar/${chave}/${a.arquivo}`)
      if (!r.ok) {
        enviados.push(`${a.arquivo}: ${r.status}`)
        continue
      }
      const tipo = a.arquivo.endsWith('.png') ? 'image/png' : 'image/jpeg'
      const up = await db.storage.from('marcas').upload(caminho, Buffer.from(await r.arrayBuffer()), { contentType: tipo, upsert: true })
      if (up.error) {
        enviados.push(`${a.arquivo}: ${up.error.message}`)
        continue
      }
      await db.from('midias').insert({ marca_id: m.id, caminho, descricao: a.descricao, tags: a.icone ? ['icone'] : [] })
      enviados.push(a.arquivo)
    }
    relatorio[chave] = { perfil: error ? error.message : 'ok', referencias: enviados }
  }
  return res.status(200).json(relatorio)
})
