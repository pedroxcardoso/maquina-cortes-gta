---
name: maquina-cortes-gta
description: Transforma um vídeo de streamer ou podcast (link ou arquivo) em vários cortes verticais de Shorts sobre GTA 6, cada um com um assunto e um gancho diferente, no estilo metade streamer e metade vídeo, com legenda palavra por palavra, pausas cortadas, zoom nos cortes e a marca d'água do seu perfil (logo + nome). Use com /maquina-cortes-gta ou quando o usuário pedir cortes de GTA, "cortar esse vídeo" ou "máquina de cortes".
---

# máquina-cortes-gta

Você recebe um vídeo longo e entrega **vários cortes prontos** em 9:16, cada um sobre um assunto diferente, com o gancho escolhido por você a partir da transcrição. Edição feita em Remotion; transcrição local com whisper.cpp. Tudo roda no computador do usuário.

Escreva pouco no chat: nunca despeje a transcrição nem JSON inteiro; mostre só o que o usuário precisa decidir ou receber.

`<skill>` = a pasta onde este SKILL.md está. `~/.maquina-cortes-gta` = pasta de dados do usuário (motor, whisper, nome do perfil e logo).

## 0. Conferir a instalação

```bash
node "<skill>/scripts/setup.mjs" --check
```

- `engine: false` ou `whisperModel: false`: rode `node "<skill>/scripts/setup.mjs"` (instala o Remotion e o whisper.cpp; leva alguns minutos e baixa arquivos grandes; avise o usuário antes).
- `ffmpeg: false`: peça para o usuário instalar o FFmpeg (o script mostra o comando do sistema dele) e pare.
- `ytdlp: false`: só aceite arquivo de vídeo (não link) e diga como instalar o yt-dlp.
- Opcionais: `efeitosGerados: 0` (sem efeitos sonoros ainda), `elevenlabsKey` e `python` (para gerá-los) e `googleImagens` (para buscar imagens). Veja a seção "Cortes rápidos, imagens e efeitos sonoros".
- **Avise uma vez, em 3 linhas, e dê as opções** quando faltar algo opcional (não pare o trabalho por isso):
  - `efeitosGerados: 0` e `elevenlabsKey: false`: "Sem efeitos sonoros. Opções: (a) criar uma chave na ElevenLabs e definir `ELEVENLABS_API_KEY` (gasta créditos seus, 3 efeitos curtos); (b) colocar sons seus em `~/.maquina-cortes-gta/sfx/` (`impacto`, `whoosh`, `pop`, mp3 ou wav); (c) seguir sem efeitos."
  - `googleImagens: false`: "Sem busca de imagens no Google. Opções: (a) configurar `GOOGLE_API_KEY` e `GOOGLE_CSE_ID` (gratuito até 100 buscas por dia); (b) mandar as imagens como arquivo; (c) seguir sem imagens." O Google bloqueia a pesquisa por navegador automático (CAPTCHA), então não tente raspar a página; se você achar uma imagem por outro meio permitido (ex.: arte oficial no site da Rockstar), baixe e use como `file`.
  - Depois da escolha do usuário, não pergunte de novo na mesma conversa.

## 1. Perfil (só na primeira vez)

Se `perfilConfigurado` for `false`, peça **numa única mensagem**:

1. o **nome do perfil** como deve aparecer na marca d'água (ex.: `SEU CANAL`);
2. a **logo** (o usuário anexa a imagem; PNG ou JPG, de preferência quadrada).

Ache o caminho do arquivo anexado na conversa e rode:

```bash
node "<skill>/scripts/setup.mjs" --profile "NOME DO PERFIL" --logo "CAMINHO/DA/LOGO.png"
```

A marca d'água é a logo em **corte circular à esquerda e o nome ao lado**, no canto superior direito, em todos os cortes. Depois disso **não pergunte de novo**, a menos que o usuário peça para trocar.

## 2. Pedir o vídeo

Peça ao usuário o **vídeo de origem** (o streamer ou podcast): um **link** ou um **arquivo**. Na mesma mensagem, ofereça o **vídeo da metade de baixo** (gameplay, trailer ou B-roll, link ou arquivo). Se ele não tiver um, use o trailer oficial da Rockstar: `https://www.youtube.com/watch?v=rz1B4B2yBZY` (se o link falhar, peça outro).

## 3. Preparar a pasta de trabalho

Use `./cortes/<slug>/work/` na pasta atual (`<slug>` = o assunto do vídeo, em minúsculas e com hífen).

```bash
yt-dlp -S "res:1080" -f "bv*+ba/b" --merge-output-format mp4 --no-playlist -o "work/source.%(ext)s" "LINK_DA_ORIGEM"
yt-dlp -S "res:720"  -f "bv*+ba/b" --merge-output-format mp4 --no-playlist -o "work/bottom.%(ext)s" "LINK_DA_METADE_DE_BAIXO"
```

Se for arquivo, copie-o para `work/source.mp4` (e `work/bottom.mp4`); se não for mp4, converta com `ffmpeg -i ARQ -c:v libx264 -c:a aac work/source.mp4`. Se o yt-dlp devolver HTTP 429, espere um pouco e tente de novo; se persistir, peça o arquivo. Se disser que o vídeo tem **restrição de idade** ("Sign in to confirm your age"), peça o arquivo de vídeo ao usuário: **não use os cookies do navegador dele sem ele pedir**.

## 4. Transcrever

```bash
node ~/.maquina-cortes-gta/engine/scripts/transcribe.mjs work/source.mp4 work pt
```

(Troque `pt` pelo idioma do vídeo. Um 4º argumento opcional limita a transcrição aos primeiros N segundos, útil para testar rápido em vídeo longo; no meu teste, 6 minutos de áudio levaram ~3,5 min com o modelo `small`.) Gera `captions.json` (palavra por palavra), `silences.json` e `meta.json`. Para **ler** a transcrição sem despejar o JSON:

```bash
node ~/.maquina-cortes-gta/engine/scripts/transcript-text.mjs work
```

Isso imprime linhas `[mm:ss] frase`. Leia em blocos.

## 5. Analisar os ganchos e escolher os cortes (você faz isso sozinho)

O usuário **não escolhe** os trechos. Você lê a transcrição e decide, seguindo `references/ganchos.md`. Resumo:

1. **Mapeie os assuntos** do vídeo: divida a conversa em blocos por tema e anote o minuto de cada um.
2. **Escolha de 3 a 5 cortes** (2 se o vídeo tiver menos de 5 minutos), de **20 a 60 s**, cada um sobre um **assunto diferente** e com um **gancho diferente**. Sem sobreposição de tempo e sem dois cortes abrindo com a mesma ideia.
3. **Procure o gancho de cada um** numa frase que já abre uma curiosidade, traz um fato específico (número, nome, comparação com GTA V), um conflito ou uma opinião forte. **Comece o corte nessa frase**, sem "então, galera" nem aquecimento.
4. **Termine no payoff**: a frase que responde o gancho, sem deixar a ideia pela metade.
5. Dê uma **nota de 0 a 10** a cada gancho (ver o guia) e **descarte** o que ficar abaixo de 6. Se faltar corte bom, entregue menos e diga por quê.
6. Se o streamer não estiver no centro da imagem, extraia um quadro (`ffmpeg -ss 5 -i work/source.mp4 -frames:v 1 work/frame.jpg`), olhe e ajuste `focus` (`x` e `y`, de 0 a 100) para o rosto ficar enquadrado na metade de cima.
7. Grave `work/cuts.json`:

```json
{
  "clips": [
    {
      "id": "01-tamanho-do-mapa",
      "start": 312.4,
      "end": 358.0,
      "focus": {"x": 50, "y": 35},
      "assunto": "tamanho do mapa",
      "hook": "O mapa do GTA 6 é a soma de três mapas.",
      "nota": 8
    }
  ]
}
```

(`id` com número e assunto; `bottomStart` é opcional e dá um ponto de partida diferente para o vídeo de baixo.)

**Live com várias câmeras ou tela do jogo ocupando o quadro** (ex.: um react com 4 câmeras pequenas ao lado do jogo): o `focus` sozinho não acha o streamer. Olhe o quadro extraído e adicione `"crop": {"x": 1092, "y": 118, "w": 146, "h": 130}` ao corte, em **pixels do vídeo de origem**, em volta da câmera de quem está falando (proporção ~1,125:1 para preencher a metade de cima). Câmera pequena ampliada fica borrada; avise o usuário e sugira uma origem com o streamer em plano grande.

## Cortes rápidos, imagens e efeitos sonoros

**Cortes (padrão, estilo dos cortes de referência de 12/11):** além de tirar pausas, o `build.mjs` quebra planos longos a cada ~2,8 s, sempre no começo de uma palavra (não remove conteúdo). **Cada quebra é um jump cut seco: muda só o zoom (107% ↔ 100%), sem flash e sem swoosh.** O swoosh (e o flash) é só para **virada de seção**: liste os segundos (do vídeo de origem) em `"turns": [312.8, 331.0]` no corte (3 a 5 por corte): quando o assunto muda, quando entra um b-roll ou quando o streamer cita um console. `"ritmo": "normal"` só tira as pausas; `"ritmo": "rapido"` volta ao estilo antigo (swoosh em todo corte; **não use**, o usuário achou repetitivo). **Pausas:** entre frases, acima de 0,3 s fica em 0,2 s (padrão aprovado pelo usuário no CapCut, 12/11); dentro da frase não mexa.

**Menção a console (PlayStation, PS5, PS2, Xbox):** quando o streamer citar, marque o segundo em `turns` e liste uma `image` (ou o vídeo do console, curto, achado e baixado com o Playwright/yt-dlp): swoosh → vídeo/foto do console por ~1–2 s → volta ao ponto onde estava, com a fala e a legenda sem perder a sincronia (exemplo: `Download(14)`).

**Escolha do trecho pelo "mais reproduzido":** para live ou vídeo longo do YouTube, use o **Playwright** (e o `agent-reach` para ler a página) para abrir o vídeo e ler o gráfico **"mais reproduzido"** (mapa de calor da barra de tempo). O pico mais alto é candidato a corte (mais retenção e engajamento); cruze com o gancho da transcrição e registre o minuto do pico. Se o gráfico não aparecer, diga e siga só pela transcrição.

**Imagens aparecendo (GTA, mapas, prints):** escolha 1 a 3 momentos do corte em que a fala cita algo mostrável (ex.: "mapa", "PS5", um personagem) e liste em `images` no `cuts.json`, com `at` em **segundos do vídeo de origem** e `dur` em segundos:

```json
"images": [
  {"query": "GTA 6 mapa Leonida", "at": 312.8, "dur": 2.2},
  {"file": "C:/imagens/ps5.png", "at": 318.0}
]
```

**Popups com imagem real, nunca só texto:** capa/arte do jogo quando falar o nome dele (ex.: "GTA 6"), **logo com fundo transparente vindo em direção à tela** quando o jogo é citado pela primeira vez, **ícone da Rockstar quando disser "Rockstar"**, mapa/aérea quando falar de mapa, personagem quando falar dele; para comparar, **dois mapas lado a lado** ("GTA 5" e "GTA 6"). Sem as chaves do Google, use arquivos do usuário ou arte oficial baixada (o Google bloqueia a pesquisa de imagens por navegador automático). A imagem entra na metade de baixo com animação e um pop. `file` usa uma imagem do usuário. `query` busca no **Google** pela API oficial (Custom Search) e baixa a primeira imagem que servir; precisa das variáveis `GOOGLE_API_KEY` e `GOOGLE_CSE_ID` do usuário (gratuito até 100 buscas por dia; veja o cabeçalho de `template/scripts/buscar-imagens.mjs`). Sem elas, a imagem é pulada com um aviso: peça arquivos ao usuário. Prefira buscas que tragam material oficial (trailer, arte de divulgação).

**Efeitos sonoros (whoosh, impacto, pop):** ficam em `~/.maquina-cortes-gta/sfx/` e o `build.mjs` os usa sozinho: impacto no quadro 0, **whoosh só nas viradas de seção (`turns`)**, pop em cada popup de imagem, **menos de 15 efeitos por 35 s**, bem abaixo da voz (mix final ≈ −14 LUFS) (`sfxGain` no `config.json`, padrão 0,6). Se `efeitosGerados` for 0, **pergunte uma vez** se o usuário quer gerar (usa créditos da conta ElevenLabs dele, 3 efeitos curtos) e, só com o OK, rode:

```bash
node "<skill>/scripts/gerar-paleta-sfx.mjs"
```

Isso usa a skill `sound-effects` (glebis, MIT) que vem junto no repositório e a variável `ELEVENLABS_API_KEY`. Nunca peça nem escreva a chave no chat. Sem efeitos gerados, o corte sai mudo de efeitos.

## 6. Renderizar

```bash
node ~/.maquina-cortes-gta/engine/scripts/build.mjs work .
```

O `build.mjs` tira as pausas longas, refaz as legendas na nova linha do tempo e renderiza cada corte com o Remotion em `./01-....mp4`, `./02-....mp4` etc. (1080×1920, 30 fps, H.264). O **primeiro render** pode baixar o Chrome headless do Remotion. Se algum corte falhar, mostre o erro e renderize os outros.

## 7. Entregar

Responda curto: a lista dos arquivos gerados e uma tabela com **assunto, gancho (a frase), duração e nota** de cada corte, mais um **título curto sugerido** por corte. Nada além disso.

## Regras

- **Estilo de referência (12/11/2026, ver `references/estilo-referencias.md`):** corte seco sem swoosh; swoosh só em virada de seção e junto de popups; popups com imagem real; pausas ≤ 0,2 s; **final "Seguir → Seguindo"** (animação de seguir, reutilizável) nos últimos ~3 s.
- Estilo fixo: metade de cima o streamer (corte com zoom nos cortes), metade de baixo o vídeo; legenda palavra por palavra na divisa, caixa alta, palavra falada em amarelo; marca d'água no canto superior direito. Detalhes em `references/estilo-metade-metade.md`.
- Não mude a marca d'água nem peça a logo de novo depois da primeira vez.
- Cada execução é independente: não reaproveite `cuts.json` de outro vídeo.
- Se algo falhar, veja `references/problemas.md`.
