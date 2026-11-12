# Estilo "metade streamer, metade vídeo"

O visual é fixo (está em `template/src/SplitCut.jsx`). Este arquivo diz o que cada parte faz e o que o usuário pode pedir para mudar.

## Layout (1080×1920, 30 fps)

| Região | O que tem |
|---|---|
| **Metade de cima** (0–960 px) | O vídeo de origem (o streamer), cortado para preencher a metade (`object-fit: cover`). O enquadramento vem de `focus` (`x` e `y`, de 0 a 100): `{"x": 50, "y": 35}` centraliza o rosto um pouco acima do meio. |
| **Metade de baixo** (960–1920 px) | O segundo vídeo (gameplay, trailer ou B-roll), mudo, em loop se for mais curto que o corte. Cada corte começa num ponto diferente dele. |
| **Divisa** (y = 960) | Degradê escuro de ~340 px e a **legenda** por cima. |
| **Canto superior direito** (topo 150 px, margem 40 px) | **Marca d'água:** logo em corte circular à esquerda e o nome do perfil ao lado. |

## Legenda

- Palavra por palavra, **1 a 3 palavras** por vez (até ~20 caracteres, quebra em pausa maior que 0,6 s e em fim de frase).
- Caixa alta, fonte Montserrat Black, 96 px, branca com contorno preto; a **palavra que está sendo falada fica amarela** (`#FFD400`).
- O texto é o que foi falado (whisper.cpp); só muda a caixa. Pontuação final de vírgula/ponto e vírgula é removida.

## Cortes e ritmo

- **Pausas longas saem:** silêncio acima de 0,5 s é removido (guarda 0,12 s de respiro em cada ponta; trecho resultante menor que 0,3 s é descartado).
- **Zoom a cada corte:** o 1º plano começa com zoom de 114% e assenta em 100% em 9 quadros; os planos ímpares dão um punch-in de 107%; os pares ficam em 100%.
- A fala do streamer é o áudio do corte; o vídeo de baixo não tem áudio.

## O que o usuário pode pedir

- **Enquadrar o rosto:** ajuste `focus` no `cuts.json` (olhe um quadro antes: `ffmpeg -ss 5 -i work/source.mp4 -frames:v 1 work/frame.jpg`).
- **Outro vídeo embaixo:** troque `work/bottom.mp4` e rode o `build.mjs` de novo.
- **Cor da palavra, tamanho da legenda, posição da marca d'água:** edite as constantes no topo de `SplitCut.jsx` em `~/.maquina-cortes-gta/engine/src/` (`YELLOW`, `fontSize`, `top`/`right` do `Watermark`). O `setup.mjs` sobrescreve `src/` do motor a cada execução, então para mudanças permanentes edite `template/src/` da skill.
- **Pausas mais ou menos agressivas:** `minSilence` e `pad` em `segmentsFor()` no `build.mjs`.
