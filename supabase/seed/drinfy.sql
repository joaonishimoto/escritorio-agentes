-- Cadastra a Drinfy como primeira marca do dono mais antigo (você, no uso pessoal). Já aplicado no projeto.
-- Rode no SQL Editor depois de criar sua conta no app. Pode rodar de novo: não duplica.
do $seed$
declare
  dono uuid := (select id from auth.users order by created_at limit 1);
  marca uuid;
begin
  if dono is null then raise exception 'Crie sua conta no app antes de rodar este seed.'; end if;
  select id into marca from public.marcas where dono_id = dono and nome = 'Drinfy';
  if marca is not null then raise notice 'Drinfy já cadastrada (%).', marca; return; end if;

  insert into public.marcas (dono_id, nome, instagram_usuario, tom_de_voz, identidade, hashtags_fixas, aviso_final, checklist_revisor)
  values (
    dono, 'Drinfy', 'drinfyapp',
    $t$Frases curtas, português do dia a dia ("dá pra", "bora"), sem tom de bartender metido. Primeira linha da legenda é um gancho de até ~12 palavras. 1 ou 2 emojis no máximo. Termina com pergunta ou chamada simples (comentar / salvar). Orgânico usa "link da bio", nunca "Saiba mais". Número de receitas = "duzentas"; oferta = 7 dias grátis.$t$,
    '{"cores": {"vermelho": "#EE382B", "grafite": "#121212", "texto": "#F2F2F2", "funcionais": ["verde", "azul", "âmbar"]}, "fonte": "Inter", "destaque": "Um destaque vermelho por slide", "fotos": "Só fotos oficiais aprovadas; sem pessoas, mãos ou excesso de bebida", "icone": "icone-app-512.png (PNG, nunca SVG)", "formatos": {"carrossel": "JPEG 1080x1350, 2 a 10 slides", "reel": "1080x1920, 30 fps, H.264 + AAC"}}'::jsonb,
    array['#drinfy', '#drinks', '#drinksemcasa', '#coquetelaria', '#receitasdedrinks'],
    'Aprecie com moderação. Proibido para menores de 18 anos.',
    $c$# Checklist do revisor

O post só vai para o João quando TODOS os itens passam. Se algum falha, devolve ao agente responsável dizendo qual item e por quê.

## Conteúdo e fatos
- [ ] Doses e ingredientes batem com o app (tabelas `drinks` / `drink_ingredients` do Supabase do Drinfy).
- [ ] Fato histórico tem duas fontes; o que é incerto aparece como "dizem" ou "segundo X".
- [ ] Nenhuma promessa que o app não cumpre (número de receitas = "duzentas", oferta = 7 dias grátis).

## Texto (tom-de-voz.md)
- [ ] Primeira linha da legenda é um gancho de até ~12 palavras.
- [ ] Frases curtas, português do dia a dia ("dá pra", "bora"), sem tom de bartender metido.
- [ ] 1 ou 2 emojis no máximo.
- [ ] Termina com pergunta ou chamada simples (comentar / salvar). Orgânico usa "link da bio", nunca "Saiba mais".
- [ ] Aviso no fim da legenda E no último slide: "Aprecie com moderação. Proibido para menores de 18 anos."
- [ ] 5 a 14 hashtags, incluindo as fixas `#drinfy #drinks #drinksemcasa #coquetelaria #receitasdedrinks`.
- [ ] Português revisado: acentos, crase, sem erro de digitação.

## Visual
- [ ] Carrossel: JPEG 1080 × 1350, 2 a 10 slides. Reel: 1080 × 1920, 30 fps, H.264 + AAC.
- [ ] Cores da marca: vermelho #EE382B, grafite #121212, texto #F2F2F2. Verde/azul/âmbar só como cor funcional.
- [ ] Fonte Inter. Um destaque vermelho por slide.
- [ ] Fotos só de `03-fotos-drinks/oficiais/`; sem pessoas, mãos ou excesso de bebida.
- [ ] Texto legível no celular (corpo ≥ 28 px) e sem cobrir o drink.
- [ ] Ícone e "DrinfyApp" aparecem (exceto série HISTÓRIA DOS DRINKS).

## Regras aprendidas
- [ ] Cada item de `regras-aprendidas.md` foi respeitado.
$c$
  ) returning id into marca;

  insert into public.roteiros (marca_id, versao, nota, etapas) values (marca, 1, 'Versão inicial, importada da skill post-instagram-drinfy', $r$[
    {"agente": "chefe", "ativo": true, "instrucoes": "Leia o pedido. Se vier só \"faz um post\", proponha 3 ângulos e escolha o mais forte. Defina ângulo, público, promessa em uma frase e formato (carrossel 1080x1350, foto ou Reel 1080x1920). Regras aprendidas têm prioridade sobre todo o resto."},
    {"agente": "pesquisador", "ativo": true, "instrucoes": "Doses e ingredientes vêm SEMPRE do app (tabelas drinks, drink_ingredients, ingredients; só is_published = true). Fato histórico precisa de duas fontes; o que divergir fica de fora ou vira \"dizem\"."},
    {"agente": "redator", "ativo": true, "instrucoes": "Escreva o texto de cada slide e a legenda no tom de voz da marca. Legenda: gancho na 1ª linha, corpo curto, chamada (salvar/comentar), aviso final da marca, 5 a 14 hashtags incluindo as fixas. Orgânico usa \"link da bio\"."},
    {"agente": "designer", "ativo": true, "instrucoes": "Use o modelo de slides da marca (classes cover, drink, cta). Fotos só da biblioteca aprovada. Ícone em PNG. Texto não pode cobrir o drink. Renderize em JPEG e olhe cada imagem antes de passar adiante."},
    {"agente": "revisor", "ativo": true, "instrucoes": "Confira item por item do checklist e das regras aprendidas, olhando as imagens de verdade. Se algo falhar, devolva ao agente responsável com o motivo. No máximo 2 voltas; depois disso, mande para aprovação explicando o que ficou pendente."},
    {"agente": "publicador", "ativo": true, "instrucoes": "Só depois da aprovação. Suba as imagens no bucket público, crie os containers na Graph API, espere FINISHED, publique e devolva o permalink. Horário padrão de agendamento: 19h de Brasília."},
    {"agente": "curador", "ativo": true, "instrucoes": "Transforme cada correção ou reprovação em uma regra curta e verificável no formato \"[agente] · regra (motivo)\". Junte regras parecidas em vez de duplicar."}
  ]$r$::jsonb);

  insert into public.regras (marca_id, agente, regra, motivo, status, criado_em) values
    (marca, 'designer', $q$Usar só as fotos de `03-fotos-drinks/oficiais/`. As de `criativos-reels/img/` foram reprovadas.$q$, null, 'ativa', '2026-10-25'),
    (marca, 'redator', $q$Vídeos da série HISTÓRIA DOS DRINKS não mostram o nome do app na voz nem na tela.$q$, null, 'ativa', '2026-10-26'),
    (marca, 'roteiro', $q$Narração só com voz masculina por enquanto (Mário nos vídeos 3D).$q$, null, 'ativa', '2026-10-26'),
    (marca, 'designer', $q$O ícone do app vai como PNG (`icone-app-512.png`); o SVG renderiza quebrado no Chromium.$q$, null, 'ativa', '2026-10-27'),
    (marca, 'designer', $q$Texto não pode cobrir o copo do drink; foto desce ou sobe para abrir espaço.$q$, null, 'ativa', '2026-10-27');

  raise notice 'Drinfy cadastrada (%).', marca;
end
$seed$;
