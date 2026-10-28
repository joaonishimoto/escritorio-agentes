// Catálogo de estilos que você pode escolher no Novo post. As chaves são as mesmas de api/_lib/variacao.ts.

export const ESTRUTURAS: { id: string; nome: string; desc: string }[] = [
  { id: 'receita-direta', nome: 'Direto ao ponto', desc: 'Uma coisa só, com o essencial e sem enrolação' },
  { id: 'passo-a-passo', nome: 'Passo a passo', desc: 'Uma técnica em passos numerados, um por slide' },
  { id: 'lista', nome: 'Lista', desc: 'Lista curta com um critério claro' },
  { id: 'mito-verdade', nome: 'Mitos e verdades', desc: 'O erro comum e como acertar' },
  { id: 'comparacao', nome: 'Isto ou aquilo', desc: 'Duas versões lado a lado' },
  { id: 'historia', nome: 'História', desc: 'Causo com começo, virada e fim' },
  { id: 'quiz', nome: 'Desafio', desc: 'Pergunta na capa, resposta no fim' },
  { id: 'situacao', nome: 'Situação real', desc: 'Uma cena do dia a dia e a saída para ela' },
  { id: 'um-ingrediente', nome: 'A partir de algo', desc: 'Parte do que a pessoa já tem' },
  { id: 'manifesto', nome: 'Manifesto', desc: 'Uma ideia forte em poucas palavras' },
]

export const LAYOUTS: { id: string; nome: string }[] = [
  { id: 'foto-cheia', nome: 'Foto cheia' },
  { id: 'tipografico-cor', nome: 'Tipográfico' },
  { id: 'editorial-claro', nome: 'Editorial claro' },
  { id: 'dividido', nome: 'Dividido' },
  { id: 'numero-gigante', nome: 'Número gigante' },
  { id: 'ficha-tecnica', nome: 'Ficha técnica' },
  { id: 'minimalista-escuro', nome: 'Minimalista escuro' },
  { id: 'colagem', nome: 'Colagem' },
]

export const VOZES: { id: string; nome: string; desc: string }[] = [
  { id: 'direta', nome: 'Direta', desc: 'Frases secas e afirmativas' },
  { id: 'conversa', nome: 'Conversa', desc: 'Amigo contando, com detalhe pessoal' },
  { id: 'curiosa', nome: 'Curiosa', desc: 'Abre com um fato concreto' },
  { id: 'humor', nome: 'Humor', desc: 'Leve, com autoironia' },
  { id: 'didatica', nome: 'Didática', desc: 'Explica o porquê de cada passo' },
]

export const nomeDe = (lista: { id: string; nome: string }[], id?: string) => lista.find((x) => x.id === id)?.nome
