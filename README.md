# Escritório de Agentes

App web onde uma equipe de agentes de IA cria posts de Instagram para qualquer marca, segue um roteiro editável, aprende com as correções e trabalha à vista num escritório 3D.

## Rodar

```bash
npm install
npm run dev
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja `.env.example`) o app abre em **modo demonstração**: o botão "Rodar demonstração" reproduz um post inteiro com eventos simulados.

## Estrutura

- `src/agents/catalogo.ts`: a equipe (nome, papel, modelo, lugar no escritório).
- `src/store/escritorio.ts`: estado de cada agente, montado a partir dos eventos.
- `src/office/`: cena 3D (React Three Fiber): mesas, bonecos, balões, pastas voando entre mesas.
- `src/ui/`: painel do agente e linha do tempo.
- `src/lib/supabase.ts`: assinatura Realtime da tabela `eventos`.
- `supabase/migrations/`: tabelas (marcas, roteiros, regras, posts, passos, eventos, midias) com RLS.
- `supabase/seed/drinfy.sql`: cadastra a Drinfy com roteiro, checklist e regras aprendidas.
