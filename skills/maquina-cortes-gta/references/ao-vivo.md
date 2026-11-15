# Modo ao vivo

Use quando o usuário mandar o link de uma **live acontecendo agora** (Twitch, YouTube, Kick) ou pedir "cortes da live enquanto ela rola". A gravação roda no computador do usuário e é processada em blocos, para os cortes saírem **antes da live acabar**.

Saem dois tipos de vídeo:

| Tipo | Formato | Para onde | Duração |
|---|---|---|---|
| **Longo** | 1920×1080, horizontal | YouTube | sem limite: uma missão inteira de 3 h vira um vídeo de 3 h (sem as partes repetitivas) |
| **Curto** | 1080×1920, vertical (o estilo da skill) | Shorts, Reels e TikTok (o mesmo arquivo serve para os três) | 20 a 60 s |

Os **curtos saem de dentro dos longos**: primeiro você decide o que vira vídeo longo, depois escolhe os melhores momentos desses trechos para os curtos.

`E` = `~/.maquina-cortes-gta/engine/scripts`. `L` = a pasta da live: `./lives/<streamer>-<aaaa-mm-dd>/`. Todos os tempos em `longos.json` e no diário são **segundos da live** (desde o começo da gravação).

## Prioridades (o que vale vídeo)

1. **Missão completa**, do começo ao fim, num vídeo só, mesmo que dure horas. Missões principais e secundárias grandes (assaltos, sequências de história).
2. **Exploração e descoberta**: o streamer andando pela cidade, achando lugares, segredos, easter eggs, interações novas, comparando com o GTA V; e **missões secundárias / atividades** curtas. Junte trechos seguidos desse tipo num vídeo de exploração.
3. O resto (conversa com o chat fora do jogo, menus, espera) só entra em curtos se tiver um gancho forte.

## Antes de começar

1. Siga os passos 0 e 1 do `SKILL.md` (instalação e perfil).
2. Pergunte numa mensagem só: o **link da live** e, se quiser, o **vídeo da metade de baixo** dos curtos (sem ele, o trailer oficial). Baixe o de baixo em `L/bottom.mp4` (comando do passo 3 do `SKILL.md`).
3. Avise em 2 linhas: o PC precisa ficar ligado até o fim da live; cortar a live de outra pessoa sem autorização pode gerar strike (a responsabilidade é do usuário).

## Gravar (em segundo plano)

```bash
node E/live-gravar.mjs "LINK_DA_LIVE" L --bloco 600
```

Rode **em segundo plano** (é um processo longo). Blocos de 10 min em `L/blocos/`. Ele reconecta sozinho se o sinal cair e encerra quando a live acaba. Para parar antes: crie o arquivo `L/PARAR`. `--desde-inicio` (só YouTube, experimental) grava desde o começo da live.

## O ciclo de cada bloco

Repita até o `live-bloco.mjs` responder `{"fim": true}`:

**1. Esperar e preparar o próximo bloco** (em segundo plano; você é avisado quando terminar):

```bash
node E/live-bloco.mjs L
```

Ele espera o bloco fechar, junta 60 s do bloco anterior no começo (para não partir um assunto), transcreve e gera o mosaico de quadros. A última linha é um JSON com `trabalho` (a pasta do bloco) e `offset`. Se responder `{"aguardando": true}`, rode de novo. Se vier `"atrasando": true`, a transcrição está mais lenta que a live: avise o usuário e sugira o modelo `base` (troque `whisperModel` em `~/.maquina-cortes-gta/config.json` e rode `setup.mjs` para baixá-lo).

**2. Ler o bloco** sem despejar nada no chat:

```bash
node E/transcript-text.mjs "TRABALHO" OFFSET
```

(imprime `[h:mm:ss] frase` no tempo da live) e **olhe** `TRABALHO/quadros.jpg` (um quadro a cada 20 s, com o horário da live escrito em cada um). É pelos quadros que você vê o que a fala não diz.

**3. Classificar a linha do tempo do bloco**: para cada pedaço, um destes:

| Rótulo | Sinais na fala | Sinais nos quadros |
|---|---|---|
| `missao` | "missão", "objetivo", "vamos fazer o assalto", nome de personagem dando ordem | marcador amarelo no mapa, texto de objetivo, cutscene (barras pretas), tela de missão concluída / falhou |
| `exploracao` | "olha isso", "que lugar é esse", "não sabia que dava pra...", comparação com GTA V | andando/dirigindo sem objetivo na tela, lugares novos, interações |
| `atividade` | missão secundária, evento aleatório, minigame | ícone de atividade, placar |
| `repeticao` | "de novo", "morri", xingando depois de falhar | tela de falha, mesmo trecho visto de novo |
| `morto` | silêncio, "volto já", leitura de chat sem relação | menu, carregamento, pausa, tela parada |

**4. Atualizar o diário** `L/diario.md` (uma seção por bloco, 3 a 8 linhas): o que aconteceu, com os horários e o rótulo de cada pedaço, missão em andamento, momentos com potencial de curto. **O diário é a sua memória**: uma missão de 3 h atravessa 18 blocos; antes de decidir, releia as últimas seções em vez de confiar na conversa.

**5. Atualizar `L/longos.json`** (formato no cabeçalho de `E/montar-longo.mjs`):

- **Missão começou**: crie um vídeo `{"tipo": "missao", "status": "aberto"}` com um trecho a partir de ~10 s antes do começo (a fala que introduz a missão). Enquanto ela continua, **estenda o `fim`** a cada bloco.
- **Durante a missão**, tire o que deixa o vídeo lento, com `remover`:
  - tentativas que falharam: mantenha **a tentativa que deu certo**; das que falharam, deixe no máximo a primeira morte se for engraçada ou tensa (até ~20 s) e tire o resto;
  - carregamento, menu, pausa, AFK, leitura de chat sem relação com o jogo;
  - silêncio longo (mais de ~8 s sem fala nem ação).
- **Viagens longas sem fala** (dirigir até o objetivo): use `acelerar` com `"vezes": 2` a `4` em vez de cortar, para manter a continuidade. Se o streamer estiver falando algo bom durante a viagem, não acelere.
- Um `capitulo` em cada trecho que marca uma etapa (ex.: "O plano", "A fuga"). Para a missão ter capítulos, divida-a em vários trechos seguidos, um por etapa.
- **Missão terminou** (tela de conclusão ou o streamer comemora): feche o trecho ~5 s depois, dê um `titulo` com gancho (ex.: "ZEREI O PRIMEIRO ASSALTO DO GTA 6") e mude `status` para `"fechado"`.
- **Exploração / atividades**: junte pedaços seguidos num vídeo `{"tipo": "exploracao", "status": "aberto"}`, um trecho por descoberta, cada um com `capitulo` (ex.: "A praia de Vice City"). Feche quando começar uma missão ou quando passar de ~40 min de conteúdo bom (não há máximo rígido; o usuário pode pedir outro critério).
- Missão que falhou de vez e foi abandonada: mantenha como `"aberto"` até o streamer retomar; se ele largar, feche e decida com o usuário.

**6. Montar o vídeo longo** assim que ele for `fechado` (em segundo plano; pode levar horas para vídeos de horas, isso é normal):

```bash
node E/montar-longo.mjs L ID_DO_VIDEO
```

Gera `L/longos/ID.mp4` e `L/longos/ID-capitulos.txt` (para colar na descrição do YouTube). `--qualidade normal` dá arquivo menor e demora mais. Enquanto um longo renderiza, continue o ciclo dos blocos normalmente, mas **não renderize dois longos ao mesmo tempo** (o computador não aguenta).

**7. Escolher os curtos do bloco**: de 1 a 4 por bloco, só de momentos **dentro dos trechos dos longos** (o clímax da missão, uma descoberta, uma reação, uma frase forte). Use as regras de gancho do `SKILL.md` (passo 5 e `ganchos.md`): 20 a 60 s, começa no gancho, termina no payoff, nota ≥ 6, sem repetir assunto de um curto anterior (confira no diário). Os tempos do `cuts.json` são **locais do bloco** (tempo da live − `offset`). `id` com o bloco na frente: `b007-01-assalto-ao-banco`. Grave `TRABALHO/cuts.json` e renderize:

```bash
node E/build.mjs "TRABALHO" L/curtos
```

Para ver o enquadramento, use os quadros do mosaico (ou extraia um quadro do `source.mp4`, passo 5.6 do `SKILL.md`). Numa live de jogo, a câmera do streamer costuma ser pequena num canto: use `crop`.

**8. Avisar o usuário em 1 a 3 linhas** a cada curto ou longo pronto (nome do arquivo, gancho ou título). Não mande resumo de bloco sem nada novo.

Volte ao passo 1.

## Fim da live

Quando o `live-bloco.mjs` responder `{"fim": true}`: feche os vídeos que ficaram `aberto` (a missão em andamento termina onde a live terminou), monte os que faltam, um de cada vez, e entregue:

1. **Longos**: tabela com título sugerido, tipo, duração e arquivo, e o caminho dos capítulos.
2. **Curtos**: tabela com assunto, gancho, duração, nota e título curto, como no `SKILL.md`.

## Limites para dizer ao usuário

- Cada curto fica pronto **uns 20 a 30 min depois do momento** (bloco de 10 min + transcrição + render; estimativa, depende do PC). O longo de uma missão só sai depois que ela acaba.
- Render de vídeo longo leva tempo: ordem de grandeza de 30 min a 1 h de render por hora de vídeo no modo rápido, num PC comum, sem placa de vídeo (estimativa).
- Espaço em disco: uma live em 1080p ocupa ~2 a 4 GB por hora. Depois de montar os longos e entregar, ofereça apagar `L/blocos` e `L/trabalho`, **só com o OK do usuário**.
- Sem áudio na live (raro), o `montar-longo.mjs` falha: avise.
