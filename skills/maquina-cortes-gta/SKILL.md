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

## 1. Perfil (só na primeira vez)

Se `perfilConfigurado` for `false`, peça **numa única mensagem**:

1. o **nome do perfil** como deve aparecer na marca d'água (ex.: `PORTAL GTA 6`);
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

Se for arquivo, copie-o para `work/source.mp4` (e `work/bottom.mp4`); se não for mp4, converta com `ffmpeg -i ARQ -c:v libx264 -c:a aac work/source.mp4`. Se o yt-dlp devolver HTTP 429, espere um pouco e tente de novo; se persistir, peça o arquivo.

## 4. Transcrever

```bash
node ~/.maquina-cortes-gta/engine/scripts/transcribe.mjs work/source.mp4 work pt
```

(Troque `pt` pelo idioma do vídeo.) Gera `captions.json` (palavra por palavra), `silences.json` e `meta.json`. Para **ler** a transcrição sem despejar o JSON:

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

## 6. Renderizar

```bash
node ~/.maquina-cortes-gta/engine/scripts/build.mjs work .
```

O `build.mjs` tira as pausas longas, refaz as legendas na nova linha do tempo e renderiza cada corte com o Remotion em `./01-....mp4`, `./02-....mp4` etc. (1080×1920, 30 fps, H.264). O **primeiro render** pode baixar o Chrome headless do Remotion. Se algum corte falhar, mostre o erro e renderize os outros.

## 7. Entregar

Responda curto: a lista dos arquivos gerados e uma tabela com **assunto, gancho (a frase), duração e nota** de cada corte, mais um **título curto sugerido** por corte. Nada além disso.

## Regras

- Estilo fixo: metade de cima o streamer (corte com zoom nos cortes), metade de baixo o vídeo; legenda palavra por palavra na divisa, caixa alta, palavra falada em amarelo; marca d'água no canto superior direito. Detalhes em `references/estilo-metade-metade.md`.
- Não mude a marca d'água nem peça a logo de novo depois da primeira vez.
- Cada execução é independente: não reaproveite `cuts.json` de outro vídeo.
- Se algo falhar, veja `references/problemas.md`.
