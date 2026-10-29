import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from './Logo'

// Só a conta do dono existe; novos cadastros são recusados no banco.
export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setEnviando(true)
    setAviso(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) setAviso(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
  }

  return (
    <div className="login">
      <form className="login-caixa" onSubmit={entrar}>
        <Logo />
        <h1>Escritório de Agentes</h1>
        <p className="muted">Entre para ver sua equipe trabalhando.</p>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        {aviso && <p className="aviso">{aviso}</p>}
        {!supabase && <p className="aviso">Falta configurar o Supabase neste ambiente (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).</p>}
        <button className="primario" disabled={enviando || !supabase}>{enviando ? 'Aguarde…' : 'Entrar'}</button>
      </form>
    </div>
  )
}

export function TrocarSenha({ aoFechar }: { aoFechar: () => void }) {
  const [senha, setSenha] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = (await supabase?.auth.updateUser({ password: senha })) ?? {}
    if (error) setAviso(error.message)
    else setOk(true)
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <form className="modal" onSubmit={salvar} onClick={(e) => e.stopPropagation()}>
        <h2>Trocar senha</h2>
        {ok ? (
          <p>Senha trocada.</p>
        ) : (
          <>
            <label htmlFor="nova-senha">Nova senha</label>
            <input id="nova-senha" type="password" autoComplete="new-password" minLength={10} required value={senha} onChange={(e) => setSenha(e.target.value)} />
            {aviso && <p className="aviso">{aviso}</p>}
          </>
        )}
        <div className="acoes">
          <button type="button" className="secundario" onClick={aoFechar}>Fechar</button>
          {!ok && <button className="primario">Salvar</button>}
        </div>
      </form>
    </div>
  )
}
