import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [criando, setCriando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setEnviando(true)
    setAviso(null)
    const { error } = criando
      ? await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) setAviso(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
    else if (criando) setAviso('Conta criada. Se pedir confirmação, abra o link que chegou no seu e-mail e entre aqui.')
  }

  return (
    <div className="login">
      <form className="login-caixa" onSubmit={entrar}>
        <h1>Escritório de Agentes</h1>
        <p className="muted">{criando ? 'Crie sua conta para montar sua equipe.' : 'Entre para ver sua equipe trabalhando.'}</p>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete={criando ? 'new-password' : 'current-password'}
          minLength={8}
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {aviso && <p className="aviso">{aviso}</p>}
        <button className="primario" disabled={enviando}>
          {enviando ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}
        </button>
        <button type="button" className="link" onClick={() => setCriando(!criando)}>
          {criando ? 'Já tenho conta' : 'Criar conta'}
        </button>
      </form>
    </div>
  )
}
