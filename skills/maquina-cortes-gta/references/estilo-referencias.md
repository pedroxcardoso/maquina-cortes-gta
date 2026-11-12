# Estilo de referência dos cortes (dissecado em 12/11/2026)

Resumo do que o usuário pediu depois de analisar três vídeos de referência (`Download(12)` narração com imagens, `Download(13)` e `Download(14)` cortes de streamer) e a edição dele no CapCut. Medido com ffmpeg (cortes de cena, loudness, espectrograma). O que **já está no template** e o que é **meta** (ainda manual ou a implementar) vem marcado.

## Base do corte de streamer (Ref. B e C)
- Streamer em plano fechado e **tela cheia**, com jump cuts de ~1,5–2,7 s por plano (zoom 100% ↔ 120%). **Sem swoosh nos jump cuts.** *(Template: jump cut + zoom, sem flash/swoosh. Feito.)*
- **Três layouts alternando conforme a fala:** (1) streamer em tela cheia; (2) **b-roll do jogo em tela cheia** quando ele descreve algo; (3) **tela dividida** (jogo em cima/streamer embaixo ou o contrário), legenda na divisa. *(Template: só metade/metade. Meta: alternar com `turns`.)*
- **Legenda por frase** (3–6 palavras, 1–2 linhas), maiúscula, **amarelo-limão** com contorno preto, troca a cada ~1,5 s; no terço inferior (ou na divisa quando dividido). *(Template: palavra por palavra, 1–3 palavras, amarelo `#FFD400`. Meta: opção de frase amarelo-limão.)*
- Marca do canal pequena no canto; nada mais fixo na tela. *(Feito: marca d'água.)*

## Virada de seção = swoosh (zoom blur)
- Só em mudança de assunto, entrada de b-roll ou menção a um console. **Menção a PlayStation/PS5/PS2:** swoosh → vídeo do console ~1–2 s → cartão com a capa do jogo citado (opcional) → volta ao ponto onde estava. *(Template: `turns` + `images`.)*
- **Popup do logo do jogo** sobre o streamer quando ele cita o GTA 6.

## Popups com imagem real (vale para narração e cortes)
Capa/arte oficial ao falar "GTA 6"; **logo transparente vindo em direção à tela** (zoom 0,35× → 1,6× com aceleração); **ícone da Rockstar** ao dizer "Rockstar"; mapas/aéreas ao falar de mapa; capas de GTA 5, GTA 4 e Red Dead 2 ao citá-los (sem escrever "3× maior que..." na tela: a legenda basta); **comparação "GTA 5 | GTA 6" com os dois mapas lado a lado**. Imagem buscada e salva com o **Playwright**. Mapa não oficial de fãs leva tarja "não oficial"; **não usar mapa vazado**.

## Som
- Voz na frente. Sem música (ou ≈ −33 LUFS). **Poucos efeitos:** impacto no quadro 0 e em 1–2 viradas, swoosh nas viradas, pop em cada popup, ding no payoff; **menos de 15 por 35 s**.
- Mix final ≈ **−14 LUFS**, pico ≤ −1 dBTP (as referências variam de −8,7 a −17 LUFS; −8,7 estoura).

## Ritmo e silêncio
- **Pausa entre frases > 0,3 s vira 0,2 s** (padrão da edição do usuário no CapCut: ~0,9 s a menos em ~29 s). Pausa dentro da frase fica.
- Velocidade da narração (só vídeos de narração, não os cortes): **1,2×**.

## Final (todos os vídeos)
**Animação "Seguir → Seguindo"** nos últimos ~3 s: pílula branca com o avatar e o **nome do canal (sem @)**, um cursor clica no botão laranja "Seguir" e ele vira "Seguindo ✓". Versões reutilizáveis: com transparência (ProRes 4444) e em tela verde (chroma key `#00FF00`). *(Gerador no projeto Portal GTA 6: `ferramentas/outro_seguir.py`; aqui, sobrepor nos últimos 3 s.)*

## Escolha do trecho
Para live/vídeo longo: Playwright + agent-reach leem o gráfico **"mais reproduzido"** e o corte sai do pico (registrar o minuto).
