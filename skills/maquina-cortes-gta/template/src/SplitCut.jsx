import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Img,
  Loop,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Montserrat';

const {fontFamily} = loadFont('normal', {weights: ['800', '900'], subsets: ['latin']});

const W = 1080;
const H = 1920;
const TOP_H = H / 2; // metade de cima (streamer) e metade de baixo (vídeo)
const YELLOW = '#FFD400';

// Zoom curto a cada corte: o 1º plano entra mais "apertado", os ímpares dão um leve punch-in.
const Punch = ({index, children}) => {
  const frame = useCurrentFrame();
  const from = index === 0 ? 1.12 : index % 2 === 1 ? 1.06 : 1.0;
  const s = interpolate(frame, [0, 9], [from, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return <AbsoluteFill style={{transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};

// Flash branco bem rápido, só nas viradas de seção (`turns`); o swoosh toca junto, via props.sfx.
const Flash = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 5], [0.38, 0], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: '#fff', opacity: o}} />;
};

// Estilo do vídeo de cima. Sem `crop`: preenche a metade (cover) e usa `focus` para enquadrar.
// Com `crop` ({x, y, w, h} em pixels do vídeo de origem): amplia só essa região (ex.: a câmera do streamer
// numa live com várias câmeras e a tela do jogo) até preencher a metade.
const topVideoStyle = (crop, srcW, srcH, focus) => {
  if (!crop) {
    return {width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${focus.x}% ${focus.y}%`};
  }
  const s = Math.max(W / crop.w, TOP_H / crop.h);
  return {
    position: 'absolute',
    width: srcW * s,
    height: srcH * s,
    left: -crop.x * s + (W - crop.w * s) / 2,
    top: -crop.y * s + (TOP_H - crop.h * s) / 2,
    objectFit: 'fill',
  };
};

const Top = ({segments, fps, sourceFile, focus, crop, srcW, srcH}) => {
  let offset = 0;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: TOP_H, overflow: 'hidden', background: '#000'}}>
      {segments.map((seg, i) => {
        const frames = Math.max(1, Math.round((seg.to - seg.from) * fps));
        const start = Math.round(seg.from * fps);
        const from = offset;
        offset += frames;
        return (
          <Sequence key={i} from={from} durationInFrames={frames}>
            <Punch index={i}>
              <OffthreadVideo
                src={staticFile(sourceFile)}
                startFrom={start}
                endAt={start + frames}
                style={topVideoStyle(crop, srcW, srcH, focus)}
              />
            </Punch>
            {seg.turn ? <Flash /> : null}
          </Sequence>
        );
      })}
    </div>
  );
};

const Bottom = ({file, start, duration, fps, total}) => {
  const startFrame = Math.round(start * fps);
  const loopFrames = duration > 0 ? Math.max(30, Math.floor(duration * fps) - 2) : total;
  return (
    <div style={{position: 'absolute', left: 0, top: TOP_H, width: W, height: H - TOP_H, overflow: 'hidden', background: '#000'}}>
      <Loop durationInFrames={loopFrames}>
        <OffthreadVideo
          src={staticFile(file)}
          startFrom={startFrame}
          endAt={startFrame + loopFrames}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </Loop>
    </div>
  );
};

// Imagem que aparece na metade de baixo (ex.: print ou foto do GTA): entra com escala 0,9 → 1 e fade, sai com fade.
const PopImage = ({file, durationInFrames}) => {
  const frame = useCurrentFrame();
  const inn = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.6))});
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], {extrapolateLeft: 'clamp'});
  const scale = 0.9 + 0.1 * inn;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        width: W,
        top: TOP_H + 70,
        height: H - TOP_H - 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: Math.min(inn, out),
        transform: `scale(${scale})`,
      }}
    >
      <Img
        src={staticFile(file)}
        style={{maxWidth: 800, maxHeight: 620, objectFit: 'contain', borderRadius: 26, border: '5px solid #fff', boxShadow: '0 18px 48px rgba(0,0,0,0.55)'}}
      />
    </div>
  );
};

// Legenda palavra por palavra, na divisa das duas metades, com a palavra falada em amarelo.
const Captions = ({pages, fps}) => {
  const frame = useCurrentFrame();
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 50,
        width: W - 100,
        top: TOP_H,
        transform: 'translateY(-50%)',
        textAlign: 'center',
        fontFamily,
        fontWeight: 900,
        fontSize: 96,
        lineHeight: 1.04,
        textTransform: 'uppercase',
        color: '#fff',
        WebkitTextStroke: '11px #000',
        paintOrder: 'stroke fill',
        textShadow: '0 7px 0 rgba(0,0,0,0.35)',
      }}
    >
      {page.words.map((w, i) => {
        const active = ms >= w.startMs && ms < w.endMs;
        return (
          <span key={i} style={{color: active ? YELLOW : '#fff', display: 'inline-block', margin: '0 12px'}}>
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

// Marca d'água: logo circular à esquerda e o nome do perfil ao lado, no canto superior direito.
const Watermark = ({logo, name}) => (
  <div style={{position: 'absolute', top: 150, right: 40, display: 'flex', alignItems: 'center', gap: 14}}>
    <Img
      src={staticFile(logo)}
      style={{width: 104, height: 104, borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 6px 18px rgba(0,0,0,0.45)'}}
    />
    <span
      style={{
        fontFamily,
        fontWeight: 900,
        fontSize: 40,
        textTransform: 'uppercase',
        color: '#fff',
        WebkitTextStroke: '7px #14002a',
        paintOrder: 'stroke fill',
        textShadow: '0 4px 0 rgba(60,0,90,0.6)',
      }}
    >
      {name}
    </span>
  </div>
);

export const SplitCut = (props) => {
  const {fps} = useVideoConfig();
  const total = Math.max(1, Math.round(props.totalSeconds * fps));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Top
        segments={props.segments}
        fps={fps}
        sourceFile={props.sourceFile}
        focus={props.focus}
        crop={props.crop}
        srcW={props.sourceWidth}
        srcH={props.sourceHeight}
      />
      <Bottom file={props.bottomFile} start={props.bottomStart} duration={props.bottomDuration} fps={fps} total={total} />
      {(props.images || []).map((im, i) => {
        const frames = Math.max(12, Math.round(im.dur * fps));
        return (
          <Sequence key={`img${i}`} from={Math.round(im.at * fps)} durationInFrames={frames}>
            <PopImage file={im.file} durationInFrames={frames} />
          </Sequence>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: W,
          top: TOP_H - 170,
          height: 340,
          background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.62) 50%, rgba(0,0,0,0))',
        }}
      />
      <Captions pages={props.pages} fps={fps} />
      <Watermark logo={props.watermark.logo} name={props.watermark.name} />
      {(props.sfx || []).map((s, i) => (
        <Sequence key={`sfx${i}`} from={Math.max(0, Math.round(s.at * fps))} durationInFrames={Math.round(3 * fps)}>
          <Html5Audio src={staticFile(s.file)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
