# máquina-cortes-gta (fork AYLLA SCOTT)

Fork de [pedroxcardoso/maquina-cortes-gta](https://github.com/pedroxcardoso/maquina-cortes-gta), sob licença MIT (veja `LICENSE` e `THIRD_PARTY.md`).

O que este fork acrescenta:

- **perfil de marca d'água pronto** para o canal AYLLA SCOTT (logo + nome) em `perfil/`;
- **este README em português**, com o passo a passo de instalação e de uso no Windows, macOS e Linux.

O motor, os scripts e o template Remotion são os do projeto original.

## O que a skill faz

Recebe um vídeo longo (streamer ou podcast) e entrega vários cortes verticais 9:16, cada um sobre um assunto diferente:

- transcreve localmente com **whisper.cpp** (nada sai da sua máquina);
- escolhe os trechos com melhor gancho a partir da transcrição;
- gera cortes de 20 a 60 s no estilo metade streamer / metade gameplay;
- legenda palavra por palavra, com a palavra falada em amarelo;
- corta pausas longas, aplica jump cuts e zoom leve;
- queima a marca d'água do perfil (logo circular + nome, canto superior direito);
- renderiza em 1080x1920 com **Remotion**.

## Requisitos

| Item | Versão | Windows | macOS | Linux |
|---|---|---|---|---|
| Node.js | 18 ou mais | `winget install OpenJS.NodeJS.LTS` | `brew install node` | `sudo apt install nodejs npm` |
| FFmpeg | qualquer recente | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `sudo apt install ffmpeg` |
| yt-dlp | mais recente | `winget install yt-dlp.yt-dlp` | `brew install yt-dlp` | `pipx install yt-dlp` |
| Git | opcional | `winget install Git.Git` | `brew install git` | `sudo apt install git` |

Confira com `node -v`, `ffmpeg -version` e `yt-dlp --version`.

## Instalação como plugin do Claude Code

```bash
claude plugin marketplace add clebson-scott/maquina-cortes-gta
claude plugin install maquina-cortes-gta@maquina-cortes-gta
```

Na primeira execução a skill pede o nome do perfil e a logo, e salva em `~/.maquina-cortes-gta`.

## Instalação sem o Claude Code (manual)

```bash
git clone https://github.com/clebson-scott/maquina-cortes-gta.git
cd maquina-cortes-gta
```

1. Confira o ambiente:

```bash
node skills/maquina-cortes-gta/scripts/setup.mjs --check
```

2. Instale o motor (Remotion + whisper.cpp). Demora alguns minutos e baixa centenas de MB:

```bash
node skills/maquina-cortes-gta/scripts/setup.mjs
```

3. Aplique o perfil AYLLA SCOTT já incluído neste fork:

```bash
node skills/maquina-cortes-gta/scripts/setup.mjs --profile "AYLLA SCOTT" --logo perfil/logo-aylla-scott.jpg
```

Para trocar o nome ou a logo depois, rode o mesmo comando com outros valores. Tudo que a skill grava fica em `~/.maquina-cortes-gta` (motor, modelo do whisper, `config.json` e a logo), nada fora dessa pasta.

## Baixar o vídeo do YouTube

O download é feito com `yt-dlp`. Quando o YouTube responde com bloqueio (`HTTP 429`, "This content isn't available", "Sign in to confirm you're not a bot"), ele exige uma sessão autenticada.

Saída recomendada, usando a sua própria conta:

1. instale a extensão **Get cookies.txt LOCALLY** no seu navegador;
2. abra o `youtube.com` logado, exporte o `cookies.txt`;
3. rode o download passando o arquivo:

```bash
yt-dlp --cookies cookies.txt -S "res:1080" -f "bv*+ba/b" --merge-output-format mp4 --no-playlist -o "work/source.%(ext)s" "LINK_DO_VIDEO"
```

Alternativa, quando o navegador está na mesma máquina:

```bash
yt-dlp --cookies-from-browser chrome ...
```

O arquivo `cookies.txt` dá acesso à sua conta: mantenha em pasta privada, não comite no Git e apague quando terminar.

Se o vídeo tiver restrição de idade, o yt-dlp também vai precisar dos cookies.

## Uso no dia a dia

```bash
# 1. pasta de trabalho
mkdir -p cortes/meu-video/work && cd cortes/meu-video

# 2. vídeo de origem (link ou arquivo)
yt-dlp --cookies cookies.txt -S "res:1080" -f "bv*+ba/b" --merge-output-format mp4 --no-playlist -o "work/source.%(ext)s" "LINK"

# 3. vídeo da metade de baixo (gameplay, trailer ou b-roll). Sem um, use o trailer oficial:
#    https://www.youtube.com/watch?v=rz1B4B2yBZY

# 4. transcrição palavra por palavra
node ~/.maquina-cortes-gta/engine/scripts/transcribe.mjs work/source.mp4 work pt

# 5. leitura da transcrição em blocos de frase
node ~/.maquina-cortes-gta/engine/scripts/transcript-text.mjs work
```

Depois disso, escreva `work/cuts.json` com os trechos escolhidos (formato em `skills/maquina-cortes-gta/SKILL.md`, seção 5) e renderize:

```bash
node ~/.maquina-cortes-gta/engine/scripts/build.mjs work
```

Cada corte sai em `work/out/` no formato 1080x1920.

## Estrutura

```
skills/maquina-cortes-gta/
  SKILL.md              instruções que o agente segue
  references/           ganchos, estilo metade-metade, problemas comuns
  scripts/setup.mjs     instala motor, whisper e perfil
  template/             projeto Remotion (build.mjs, SplitCut.jsx)
perfil/
  logo-aylla-scott.jpg  logo usada na marca d'água
```

## Aviso de direitos autorais

A ferramenta é sua; o conteúdo dos cortes não. Cortar vídeo de outro criador e publicar gera reivindicação de reuso e Content ID no YouTube. Peça autorização a quem produziu o vídeo antes de publicar.

## Créditos

- Projeto original: [pedroxcardoso/maquina-cortes-gta](https://github.com/pedroxcardoso/maquina-cortes-gta), licença MIT;
- Remotion, whisper.cpp, yt-dlp e FFmpeg: veja `THIRD_PARTY.md`.
