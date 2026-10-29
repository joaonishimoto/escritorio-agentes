// Traduz o erro técnico de um passo para o que aconteceu e o que fazer, na linguagem do dono.

export interface Explicacao {
  titulo: string
  texto: string
  /** IA que resolve, quando o problema é do serviço de agora */
  trocarPara?: string
  rotuloTroca?: string
  /** o problema não é da IA: o painel não oferece trocar de IA */
  semTrocaDeIA?: boolean
}

/** Traduz o erro técnico para o que aconteceu e o que fazer. */
export function explicarErro(agente: string, erro: string): Explicacao {
  const e = erro.toLowerCase()
  if (/kling/.test(e) && /cr[ée]dito|saldo|balance|insufficient|quota/.test(e))
    return { titulo: 'A Kling está sem créditos', texto: 'O vídeo não saiu porque acabou o saldo da conta na Kling. Dá para fazer agora com a animação do Claude, ou recarregar a Kling e tentar de novo.', trocarPara: 'claude', rotuloTroca: 'Fazer o vídeo com o Claude' }
  if (/vídeos pagos/.test(e))
    return { titulo: 'Limite de vídeos pagos do post', texto: 'Este post já pagou dois vídeos e cada ajuste pagaria outro inteiro. Faça o vídeo com a animação do Claude (só custo de texto) ou volte para a aprovação com o vídeo que já existe.', trocarPara: 'claude', rotuloTroca: 'Fazer o vídeo com o Claude' }
  if (/fal\.ai/.test(e) && /saldo|cr[ée]dito|balance|acesso/.test(e))
    return { titulo: 'O fal.ai está sem saldo', texto: 'O serviço de vídeo recusou o pedido por falta de saldo ou de acesso ao modelo. Dá para fazer agora com a animação do Claude.', trocarPara: 'claude', rotuloTroca: 'Fazer o vídeo com o Claude' }
  if (/elevenlabs/.test(e) && /permiss|permission|id da chave|recusou a chave|falta configurar|créditos/.test(e))
    return {
      titulo: /permiss/.test(e) ? 'A chave da ElevenLabs não pode gerar voz' : /créditos/.test(e) ? 'A ElevenLabs está sem créditos' : 'A chave da ElevenLabs não funcionou',
      texto: /permiss/.test(e)
        ? 'A chave foi criada sem a permissão "Text to Speech". Na ElevenLabs, em Developers → API Keys, libere essa permissão (ou crie outra chave), troque ELEVENLABS_API_KEY na Vercel e tente de novo. O vídeo já está pronto: dá também para seguir sem narração.'
        : 'A narração não saiu por causa da conta da ElevenLabs. O vídeo já está pronto: dá para seguir sem narração agora, ou arrumar a chave e tentar de novo.',
      trocarPara: 'nenhum',
      rotuloTroca: 'Seguir sem narração',
    }
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
  if (/free space in temporary|espaço livre no servidor: \d{1,2} mb|no space left|enospc/.test(e))
    return { titulo: 'Faltou espaço no servidor', texto: 'O servidor que desenha os slides ficou sem espaço temporário e o navegador caiu. A limpeza é automática: tente de novo que ele desenha só as imagens, sem gastar com a IA.', semTrocaDeIA: true }
  if (/chromium|render|navegador|browser has been closed|target page|context or browser|^page\.\w+:|frame\.\w+:|protocol error|websocket/.test(e))
    return { titulo: 'O desenho dos slides caiu no meio', texto: 'O navegador que transforma o layout em imagens fechou sozinho no servidor. O texto e o layout estão guardados; tente de novo que ele desenha só as imagens, sem gastar com a IA. A IA não tem a ver com esse erro.', semTrocaDeIA: true }
  if (/falha ao subir|storage|bucket/.test(e))
    return { titulo: 'Não deu para guardar o arquivo', texto: 'O arquivo foi feito, mas não subiu para o armazenamento do app. Tente de novo; se repetir, o detalhe técnico abaixo diz o motivo.', semTrocaDeIA: true }
  if (/fora do formato esperado|schema|json/.test(e))
    return { titulo: 'A IA respondeu fora do formato', texto: 'A resposta veio incompleta ou num formato que o app não entendeu, mesmo depois de pedir de novo. Tentar de novo costuma resolver; se repetir, troque de IA.' }
  return { titulo: 'Algo deu errado', texto: 'O funcionário parou com um erro inesperado. Tente de novo; o detalhe técnico abaixo diz o que aconteceu e, se repetir, vale trocar de IA.' }
}
