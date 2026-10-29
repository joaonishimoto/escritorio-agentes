// Validade do token do Instagram, lida da identidade da marca (o token em si fica só no Vault).
// O servidor renova sozinho; aqui só decide quando o celular da sala avisa. Mesmo critério de api/_lib/token-meta.ts.

const DIA = 86_400_000
export const AVISAR_COM_DIAS = 10

/** Texto do aviso do celular, ou null quando está tudo certo (ou a marca não tem Instagram). */
export function avisoDoToken(identidade: Record<string, unknown> | null | undefined, conectado: boolean, agora = new Date()): string | null {
  if (!conectado) return null
  const info = identidade?.instagram_token as { expira_em?: string | null; erro?: string | null } | undefined
  if (!info || typeof info !== 'object' || !info.expira_em) return null
  const dias = Math.floor((new Date(info.expira_em).getTime() - agora.getTime()) / DIA)
  if (dias < 0) return 'Token do Instagram venceu: reconecte'
  if (dias <= AVISAR_COM_DIAS) return `Token vence em ${dias} dia${dias === 1 ? '' : 's'}: reconecte`
  if (info.erro) return 'A renovação do token falhou: reconecte'
  return null
}
