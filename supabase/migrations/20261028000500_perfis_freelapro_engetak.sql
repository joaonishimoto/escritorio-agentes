-- Perfis de marca do FreelaPRO e da Engetak, tirados dos projetos freelaprobr e engetakhub
-- (cores e fonte do design system de cada um, tom a partir da landing e do produto).
update public.marcas set
  tom_de_voz = $tom$Fala com freelancers, autônomos e pequenas agências do Brasil (design, social media, vídeo, dev). Tom direto, próximo e prático, sempre em "você", em português do dia a dia, sem gíria forçada e sem jargão corporativo.

Começa pela dor real com uma cena concreta: briefing perdido num áudio do WhatsApp, prazo que estoura sem aviso, sinal que não veio, job entregue e não cobrado. Depois mostra a saída simples dentro do FreelaPRO (cada pedido vira um card, portal do cliente, proposta aceita por link, financeiro com o que falta receber).

Frases curtas e verbos de ação: organize, receba, feche, cobre. Nada de promessa milagrosa; use números concretos quando houver (plano Free sem cartão, Solo a partir de R$ 24,90/mês, pronto em 2 minutos). No máximo 1 emoji.

Escreva o nome sempre como FreelaPRO. Primeira linha da legenda é um gancho de até ~12 palavras; termina com chamada para começar grátis, sem cartão, pelo link da bio, ou com uma pergunta sobre a rotina do freela.$tom$,
  identidade = identidade || $j${
    "cores": { "azul": "#0B64F4", "azul_escuro": "#052C6B", "texto": "#14181F", "fundo": "#FCFCFC", "azul_claro": "#ECF3FE" },
    "fonte": "Plus Jakarta Sans (títulos 700, texto 400/500)",
    "nome": "Escreva FreelaPRO com o PRO na cor azul da marca",
    "estilo": "Minimalista: azul, branco e preto. Fundo claro com muito respiro, um destaque azul por slide, cantos arredondados (10px) e sombras suaves.",
    "fotos": "Telas do app (quadro de tarefas, portal do cliente, propostas, financeiro) em celular ou notebook e situações reais de freela. Nada de banco de imagem genérico de escritório."
  }$j$::jsonb,
  hashtags_fixas = array['#freelapro', '#freelancer', '#freela', '#autonomo', '#produtividade'],
  checklist_revisor = checklist_revisor || E'\n- Nome escrito FreelaPRO, com o PRO em azul quando aparece no slide'
where lower(nome) = 'freelapro';

update public.marcas set
  tom_de_voz = $tom$A Engetak é uma empresa de engenharia mecânica: projeto de máquinas e equipamentos, modelagem 3D, detalhamento 2D, lista de peças, documentação técnica e revisão de projeto, com acompanhamento de cada etapa.

Fala com indústrias, gestores de engenharia e manutenção e compradores técnicos. Tom profissional, técnico e confiante, sem ser frio: explica com clareza, usa os termos certos (modelagem 3D, detalhamento, revisão, montagem) e não enrola.

Mostra processo, precisão e entrega no prazo com provas concretas: etapas do projeto, tipo de equipamento, do 3D ao desenho de fabricação, antes e depois. Nada de gíria nem exagero ("o melhor do Brasil"). Emoji: nenhum ou 1 discreto.

Primeira linha da legenda traz o problema técnico ou o benefício para a operação; termina com convite para falar com a equipe pelo direct ou pelo link da bio.$tom$,
  identidade = identidade || $j${
    "cores": { "verde_agua": "#37AEA4", "grafite": "#2C3030", "texto": "#222626", "fundo": "#F7F8F8", "ciano": "#22D3EE" },
    "fonte": "Inter (títulos 700, texto 400)",
    "estilo": "Visual técnico e limpo: fundo grafite escuro ou neutro claro, destaque em verde-água, linhas finas de desenho técnico ou grade ao fundo. Um destaque de cor por slide.",
    "fotos": "Renders 3D, desenhos técnicos e fotos reais de equipamentos e fabricação. Nada de banco de imagem genérico."
  }$j$::jsonb,
  hashtags_fixas = array['#engetak', '#engenhariamecanica', '#projetomecanico', '#modelagem3d', '#industria']
where lower(nome) = 'engetak';
