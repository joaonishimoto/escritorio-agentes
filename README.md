<p align="center"><img src="public/favicon.svg" width="96" height="96" alt="Logo do Escritório de Agentes"></p>

# Escritório de Agentes

App web onde uma equipe de agentes de IA cria posts de Instagram para qualquer marca, segue um roteiro editável, aprende com as correções e trabalha à vista num escritório 3D.

## Rodar

```bash
npm install
npm run dev
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja `.env.example`) o app abre em **modo demonstração**: o botão "Rodar demonstração" reproduz um post inteiro com eventos simulados.

## Publicar na Vercel

1. Importe o repositório na Vercel (framework: Vite).
2. Em Settings → Environment Variables, cadastre:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (os mesmos do `.env.example`)
   - `SUPABASE_URL` (igual ao de cima) e `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys → service_role / secret)
   - `ANTHROPIC_API_KEY` (console da Anthropic)
   - `EXECUTOR_SECRET` (qualquer texto longo e aleatório; protege a rota que roda os agentes)
   - `KLING_API_KEY` (opcional; console da Kling AI em kling.ai, área de API). Sem ela, escolha outra IA de vídeo no post (por exemplo o Claude, que faz uma animação gravada no próprio app).
   - `FAL_KEY` (opcional; fal.ai → API Keys). Libera Kling 3.0, Hailuo e Seedance como IA de vídeo, com os créditos do fal.ai.
   - `OPENROUTER_API_KEY` (opcional; openrouter.ai → Keys). Libera GPT, Gemini e DeepSeek para os funcionários de texto.
3. No Supabase, em Authentication → URL Configuration, ponha a URL da Vercel em Site URL.

## Como os agentes rodam

No Novo post, em "IAs da equipe", você escolhe a IA de cada funcionário só para aquele post (fica em `posts.preferencias.ias`; o que não for escolhido usa o padrão de `api/_lib/ias.ts`). Num post com erro, dá para tentar de novo com outra IA.

`/api/posts` cria o post e enfileira o chefe de pauta. `/api/executar` pega um passo da fila (`pegar_proximo_passo`), roda o agente, grava os eventos e se chama de novo enquanto houver fila. Cada agente lê a versão mais nova do roteiro e as regras ativas da marca quando começa. `/api/aprovar` recebe sua decisão: publicar (publicador), pedir ajuste (curador propõe regras e devolve ao agente certo) ou reprovar.

## Estrutura

- `src/agents/catalogo.ts`: a equipe (nome, papel, modelo, lugar no escritório).
- `src/store/escritorio.ts`: estado de cada agente, montado a partir dos eventos.
- `src/office/`: cena 3D (React Three Fiber): mesas, bonecos, balões, pastas voando entre mesas.
- `src/ui/`: painel do agente e linha do tempo.
- `src/lib/dados.ts`: marcas, posts, regras e a assinatura Realtime dos eventos.
- `api/`: rotas da Vercel; `api/_lib/agentes/` tem os 7 agentes.
- `supabase/migrations/`: tabelas (marcas, roteiros, regras, posts, passos, eventos, midias) com RLS.
- `public/`: logo (`favicon.svg`, mesma arte de `src/ui/Logo.tsx`), ícones do app, manifest e imagem de compartilhamento.
- `supabase/seed/drinfy.sql`: cadastra a Drinfy com roteiro, checklist e regras aprendidas.
