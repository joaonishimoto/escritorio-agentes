// Instabilidade passageira (IA sobrecarregada, limite de taxa, rede, navegador que caiu): o passo volta para a fila
// em vez de parar o post. Erro de verdade (chave errada, sem crédito, conteúdo recusado) não entra aqui.
const TRANSITORIO = /overloaded|sobrecarreg|rate.?limit|too many requests|\b(429|500|502|503|504|529)\b|timeout|timed out|demorou demais|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|network|browser has been closed|target page, context or browser|internal server error/i
export const MAX_TENTATIVAS = 3

export const eErroTransitorio = (msg: string) => TRANSITORIO.test(msg) && !/sem cr[ée]ditos|sem saldo|saldo insuficiente|recusou a chave|falta configurar/i.test(msg)
