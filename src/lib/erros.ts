// Traduz o erro técnico de um passo para o que aconteceu e o que fazer, na linguagem do dono.

export interface Explicacao {
  titulo: string
  texto: string
  /** IA que resolve, quando o problema é do serviço de agora */
  trocarPara?: string
  rotuloTroca?: string
}

/** Traduz o erro técnico para o que aconteceu e o que fazer. */
export function explicarErro(agente: string, erro: string): Explicacao {
  const e = erro.toLowerCase()
  if (/kling/.test(e) && /cr[ée]dito|saldo|balance|insufficient|quota/.test(e))
    return { titulo: 'A Kling está sem créditos', texto: 'O vídeo não saiu porque acabou o saldo da conta na Kling. Dá para fazer agora com a animação do Claude, ou recarregar a Kling e tentar de novo.', trocarPara: 'claude', rotuloTroca: 'Fazer o vídeo com o Claude' }
  if (/fal\.ai/.test(e) && /saldo|cr[ée]dito|balance|acesso/.test(e))
    return { titulo: 'O fal.ai está sem saldo', texto: 'O serviço de vídeo recusou o pedido por falta de saldo ou de acesso ao modelo. Dá para fazer agora com a animação do Claude.', trocarPara: 'claude', rotuloTroca: 'Fazer o vídeo com o Claude' }
  if (/falta configurar|recusou a chave/.test(e))
    return { titulo: 'Falta uma chave de acesso', texto: 'O serviço que este funcionário usa não está configurado na Vercel. Escolha outra IA abaixo ou peça para configurar a chave.' }
  if (/demais sendo gerado|ao mesmo tempo/.test(e))
    return { titulo: 'A Kling está ocupada', texto: 'Já tem vídeo demais sendo gerado no seu pacote. Espere alguns minutos e tente de novo.' }
  if (/não entregou|demorou|timeout|timed out/.test(e))
    return { titulo: 'O serviço demorou demais', texto: 'A resposta não chegou a tempo. Normalmente uma nova tentativa resolve.' }
  if (/overloaded|sobrecarreg|529|rate limit|429/.test(e))
    return { titulo: 'A IA está sobrecarregada', texto: 'O serviço pediu para esperar um pouco. Tente de novo em instantes ou troque de IA.' }
  if (agente === 'publicador' && /token|oauth|session|permiss/.test(e))
    return { titulo: 'O Instagram desconectou', texto: 'A conexão com o Instagram expirou. Reconecte a conta no menu (···) e publique de novo.' }
  if (agente === 'publicador') return { titulo: 'O Instagram não aceitou', texto: 'A publicação foi recusada. Veja o detalhe abaixo e tente de novo, ou volte para aprovação para ajustar.' }
  if (/chromium|render|navegador|browser has been closed|target page|context or browser/.test(e)) return { titulo: 'O desenho dos slides caiu no meio', texto: 'O navegador que transforma o layout em imagens fechou sozinho, geralmente quando vários posts são desenhados ao mesmo tempo. O texto e o layout estão prontos; tente de novo que ele desenha só as imagens.' }
  return { titulo: 'Algo deu errado', texto: 'O funcionário parou com um erro. Tente de novo; se repetir, troque de IA.' }
}
