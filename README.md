<p align="center"><img src="public/favicon.svg" width="96" height="96" alt="Logo do Escritório de Agentes"></p>

# Escritório de Agentes

App web onde uma equipe de agentes de IA cria posts de Instagram para as suas marcas. Cada marca é uma sala num escritório em pixel art: você vê quem está trabalhando, as pastas voando entre as mesas, o calendário na parede, o cofrinho com o gasto do mês e a gaveta de posts guardados. Nada vai para o Instagram sem a sua aprovação.

## Rodar

```bash
npm install
npm run dev
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja `.env.example`) a tela de entrada avisa que falta configurar o Supabase; não há modo de demonstração.

Antes de abrir uma PR: `npm run check` (tipos do app e da API + lint), `npm test` (vitest, funções puras) e `npm run build`. O GitHub Actions roda os três em toda PR (`.github/workflows/checar.yml`).

## Publicar na Vercel

1. Importe o repositório na Vercel (framework: Vite).
2. Em Settings → Environment Variables, cadastre:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (os mesmos do `.env.example`)
   - `SUPABASE_URL` (igual ao de cima) e `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys → service_role / secret)
   - `ANTHROPIC_API_KEY` (console da Anthropic)
   - `EXECUTOR_SECRET` (qualquer texto longo e aleatório; protege a rota que roda os agentes)
   - `FAL_KEY` (recomendada para Reels; fal.ai → API Keys). Libera Kling 3.0, Hailuo e Seedance como IA de vídeo, cobrados por uso. Com ela, o cinegrafista usa o Kling 3.0 por padrão.
   - `KLING_API_KEY` (opcional; console da Kling AI em kling.ai, área de API). Vira o padrão só quando não há `FAL_KEY`. Sem nenhuma das duas, o Claude faz uma animação gravada no próprio app.
   - Depois de configurar, abra o perfil de uma sala → aba **Serviços** → **Testar agora**: ele confere cada chave e o Instagram de cada sala sem gerar nada.
   - `ELEVENLABS_API_KEY` (opcional; elevenlabs.io → API Keys). O narrador usa para gravar a voz dos Reels; a voz de cada marca fica na aba Narração do perfil.
   - `OPENROUTER_API_KEY` (opcional; openrouter.ai → Keys). Libera GPT, Gemini e DeepSeek para os funcionários de texto.
3. No Supabase, em Authentication → URL Configuration, ponha a URL da Vercel em Site URL.
4. Aplique as migrações de `supabase/migrations/` na ordem (SQL Editor ou `supabase db push`).

## Como um post anda

1. **Novo post**: você escreve o pedido, manda referências (imagens e links), escolhe formato, estilo e a IA de cada funcionário só para aquele post (`posts.preferencias`). `/api/posts` cria o post e enfileira o chefe de pauta.
2. **Produção**: chefe de pauta → pesquisador → redator → designer (→ cinegrafista → narrador nos Reels) → revisor. Cada agente lê a versão mais nova do roteiro e as regras ativas da marca quando começa. O revisor devolve até duas vezes para quem precisa refazer.
3. **Sua mesa**: o post pronto aparece na sua mesa (de todas as salas). Dali você publica agora, agenda, pede ajuste, reprova ou guarda na **gaveta** da sala para usar depois.
4. **Ajuste**: o curador transforma o que você escreveu em regras propostas (você aceita ou descarta) e manda a correção para o agente certo; ajuste pequeno vai direto ao designer, que edita os slides prontos.
5. **Publicação**: o publicador usa a Instagram Graph API com o token guardado no Vault do Supabase. Agendados saem na hora marcada: um `pg_cron` no banco chama `/api/publicar-agendados` a cada minuto.

### A fila

`/api/executar` pega um passo (`pegar_proximo_passo`, sem dois executores pegarem o mesmo), roda o agente, grava os eventos que o escritório anima (Realtime) e se chama de novo enquanto houver fila. Erro passageiro (IA sobrecarregada, timeout, rede, navegador que caiu) devolve o passo para a fila até três vezes antes de marcar o post com erro; erro de verdade aparece na sua mesa explicado em português, com "Tentar de novo" e a opção de trocar a IA. Passos presos voltam para a fila depois de 6 minutos. Com o app aberto, ele cutuca a fila (`/api/acordar`) se um post ficar 45 s sem evento; com o app fechado, o cron do banco faz o mesmo quando há passo pendente parado há mais de 2 minutos.

### Vídeo dos Reels

O cinegrafista pede o vídeo na Kling, num modelo do fal.ai ou escreve uma animação em HTML/CSS que o próprio app grava em MP4 (Chromium + WebCodecs, sem serviço pago). O narrador escreve a fala, gera a voz na ElevenLabs e junta ao vídeo com ffmpeg. Serviço sem crédito cai sozinho para a animação do Claude.

## Estrutura

- `src/App.tsx`: monta o escritório, os painéis e os modais.
- `src/pixel/`: o escritório em pixel art (`mapa.ts` desenha salas, móveis e objetos; `EscritorioPixel.tsx` anima personagens, pastas, cartinhas, gatos e a barra de salas).
- `src/ui/`: painéis (agente, sua mesa, aprovação, gaveta, cofrinho, financeiro, calendário, perfil da marca, referências, novo post).
- `src/lib/`: dados do Supabase (`dados.ts`), chamadas à API, catálogo de IAs, ajudantes puros (`erros.ts`, `datas.ts`, `formato.ts`).
- `src/store/escritorio.ts`: estado de cada agente, montado a partir dos eventos.
- `api/`: rotas da Vercel; `api/_lib/agentes/` tem os agentes; `api/_lib/` tem fila, render dos slides, vídeo, voz, Instagram e integrações.
- `supabase/migrations/`: tabelas (marcas, roteiros, regras, posts, passos, eventos, midias, config_app, analises_financeiro) com RLS, fila, Vault e cron.
- `tests/`: testes do vitest.
- `supabase/seed/drinfy.sql`: cadastra a Drinfy com roteiro, checklist e regras aprendidas.
