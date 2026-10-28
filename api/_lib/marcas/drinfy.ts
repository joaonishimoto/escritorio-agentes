// Perfil completo da Drinfy embutido no código. Vale para os campos que estiverem vazios no banco.
export const TOM_DE_VOZ = String.raw`
Quem fala: Drinfy (no perfil e no app: DrinfyApp, @drinfyapp). Site: lp.drinfy.com. Frase-base: "O app de drinks pelo que você tem em casa." Promessa: marque o que tem em casa e veja na hora que drink dá pra fazer, com a dose certa de cada ingrediente. Cerca de 200 receitas.

Como soa:
- Amigo que entende de drink, não bartender metido. Português do dia a dia: "dá pra", "bora", "pra próxima sexta".
- Frases curtas, uma ideia por frase. Pergunta no começo para puxar conversa ("Sentiu nossa falta?").
- Concreto: fala de ingrediente real (limão, açúcar, gelo, gin e tônica no fundo da geladeira).
- Emoji com moderação, um ou dois por legenda (🍹 🍸 🍋 🧊 🔖 👇).
- Termina com pergunta ou chamada simples: "Conta aqui nos comentários", "Salva pra próxima sexta".

Frases que já funcionam:
- "Você já tem um drink em casa. Só não sabe qual."
- "Marque o que tem e veja na hora o que dá pra fazer."
- "Duzentas receitas com dose certa."
- "O Drinfy voltou. Bora brindar de novo?"
- "Limão, açúcar e gelo? Caipirinha. Gin e tônica no fundo da geladeira? Gin tônica."

Orgânico usa "link na bio"; anúncio usa "Toque em Saiba mais". Oferta atual: 7 dias grátis, cancele quando quiser.

Conteúdo educativo: abre com um fato surpreendente, cita fonte quando conta história (Ibrac, Forbes Brasil, Difford's Guide, VinePair), assume quando algo não é provado e fecha com pergunta pessoal ("Açúcar ou mel na sua?").

Obrigatório: todo post termina com "Aprecie com moderação. Proibido para menores de 18 anos." Sem pessoas bebendo em excesso, sem associar a direção, sem menores.

Hashtags: 5 a 14 por post. Por drink: #caipirinha #mojito #negroni #gintonica #aperolspritz #moscowmule. Extras: #drinksfaceis #happyhouremcasa #bartenderemcasa #drinksbrasil #coquetel #historia #cachaca #bartender.
`.trim()

export const MODELO_SLIDES_HTML = String.raw`
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap">
<style>
  :root {
    --red: #ee382b; --red-soft: #ff7b70; --bg: #121212; --card: #1a1a1a;
    --line: #2e2e2e; --fg: #f2f2f2; --muted: #999999;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #000; font-family: 'Inter', system-ui, sans-serif; color: var(--fg); }
  .slide { width: 1080px; height: 1350px; position: relative; overflow: hidden; background: var(--bg); }
  .photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 70%; }
  .shade-top { position: absolute; inset: 0 0 auto 0; height: 620px;
    background: linear-gradient(to bottom, rgba(18,18,18,.92) 0%, rgba(18,18,18,.6) 55%, rgba(18,18,18,0) 100%); }
  .shade-bottom { position: absolute; inset: auto 0 0 0; height: 640px;
    background: linear-gradient(to top, rgba(18,18,18,.97) 0%, rgba(18,18,18,.85) 45%, rgba(18,18,18,0) 100%); }
  .top { position: absolute; left: 80px; right: 80px; top: 88px; }
  .pill { display: inline-block; padding: 12px 26px; border-radius: 999px;
    background: rgba(238,56,43,.16); border: 2px solid rgba(238,56,43,.55); color: var(--red-soft);
    font-weight: 700; font-size: 28px; letter-spacing: .06em; text-transform: uppercase; }
  .pill b { color: var(--fg); font-weight: 800; }
  h1 { font-weight: 900; letter-spacing: -0.035em; line-height: .98; }
  .red { color: var(--red); }
  .brand { position: absolute; right: 64px; bottom: 52px; display: flex; align-items: center; gap: 14px;
    font-weight: 700; font-size: 26px; color: rgba(242,242,242,.75); }
  .brand img { width: 44px; height: 44px; border-radius: 11px; }
  .counter { position: absolute; left: 80px; bottom: 58px; font-weight: 600; font-size: 24px; color: var(--muted); letter-spacing: .08em; }
  .cover h1 { font-size: 104px; margin-top: 36px; }
  .cover .photo { top: 240px; height: 1350px; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 260px); mask-image: linear-gradient(to bottom, transparent 0, #000 260px); }
  .drink .photo { top: -160px; height: 1350px; }
  .drink .recipe li { font-size: 36px; }
  .drink .recipe ul { gap: 10px; }
  .drink .recipe .how { font-size: 29px; margin-top: 22px; padding-top: 20px; }
  .cover .sub { position: absolute; left: 80px; right: 80px; bottom: 150px; font-size: 44px; font-weight: 600; line-height: 1.2; }
  .cover .swipe { display: inline-flex; margin-top: 26px; align-items: center; gap: 14px; background: var(--red);
    color: #fff; padding: 18px 34px; border-radius: 999px; font-weight: 800; font-size: 34px; }
  .drink h1 { font-size: 124px; margin-top: 26px; }
  .drink .glass { margin-top: 18px; font-size: 32px; font-weight: 500; color: rgba(242,242,242,.8); }
  .recipe { position: absolute; left: 56px; right: 56px; bottom: 128px; padding: 40px 44px; border-radius: 32px;
    background: rgba(18,18,18,.82); border: 2px solid rgba(255,255,255,.08); backdrop-filter: blur(14px); }
  .recipe ul { list-style: none; display: grid; gap: 16px; }
  .recipe li { display: flex; align-items: baseline; gap: 22px; font-size: 40px; font-weight: 600; }
  .recipe li .q { min-width: 230px; color: var(--red-soft); font-weight: 800; }
  .recipe li.extra .q { color: #22c55e; }
  .recipe .how { margin-top: 30px; padding-top: 26px; border-top: 2px solid var(--line); font-size: 32px; line-height: 1.35;
    color: rgba(242,242,242,.85); font-weight: 500; }
  .cta { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    background: radial-gradient(900px 700px at 50% 38%, rgba(238,56,43,.22), rgba(18,18,18,0) 70%), var(--bg); }
  .cta .icon { width: 230px; height: 230px; border-radius: 56px; box-shadow: 0 30px 90px rgba(238,56,43,.45); }
  .cta h1 { font-size: 84px; margin: 70px 80px 0; }
  .cta p { font-size: 40px; font-weight: 500; color: rgba(242,242,242,.82); margin: 34px 120px 0; line-height: 1.3; }
  .cta .btn { margin-top: 60px; background: var(--red); color: #fff; padding: 28px 56px; border-radius: 999px; font-weight: 800; font-size: 42px; }
  .cta .legal { position: absolute; bottom: 64px; left: 80px; right: 80px; font-size: 26px; color: var(--muted); font-weight: 500; }
</style>
</head>
<body>
<!-- Modelo: capa (cover), slide de conteúdo (drink) e chamada final (cta). Repita o tipo de slide que precisar. URL_DA_FOTO e URL_DO_ICONE vêm da lista de fotos aprovadas (o ícone tem a tag "icone"). -->
<section class="slide cover" id="s1">
  <img class="photo" src="URL_DA_FOTO">
  <div class="shade-top"></div><div class="shade-bottom"></div>
  <div class="top">
    <span class="pill">Drinks com o que tem em casa</span>
    <h1>Tem limão, açúcar e gelo?<br><span class="red">Só falta a garrafa.</span></h1>
  </div>
  <div class="sub">3 drinks clássicos + 1 bônus,<br>com a dose certa.
    <div><span class="swipe">Arrasta pro lado →</span></div>
  </div>
</section>
<section class="slide drink" id="s2">
  <img class="photo" src="URL_DA_FOTO">
  <div class="shade-top"></div><div class="shade-bottom"></div>
  <div class="top">
    <span class="pill">Tem <b>cachaça</b>?</span>
    <h1>Caipirinha</h1>
    <div class="glass">Copo baixo</div>
  </div>
  <div class="recipe">
    <ul>
      <li><span class="q">50 ml</span>cachaça</li>
      <li><span class="q">1</span>limão</li>
      <li><span class="q">2 colh. chá</span>açúcar</li>
      <li><span class="q">a gosto</span>gelo</li>
    </ul>
    <div class="how">Amasse o limão com o açúcar no copo, complete com gelo e a cachaça. Mexa e pronto.</div>
  </div>
  <div class="counter">01 / 04</div>
  <div class="brand"><img src="URL_DO_ICONE">DrinfyApp</div>
</section>
<section class="slide cta" id="s6">
  <img class="icon" src="URL_DO_ICONE">
  <h1>Você já tem um drink em casa.<br><span class="red">Só não sabe qual.</span></h1>
  <p>Marque o que tem e veja na hora o que dá pra fazer. Duzentas receitas com dose certa.</p>
  <div class="btn">Teste grátis no link da bio</div>
  <div class="legal">Aprecie com moderação. Proibido para menores de 18 anos.</div>
</section>
</body>
</html>
`.trim()
