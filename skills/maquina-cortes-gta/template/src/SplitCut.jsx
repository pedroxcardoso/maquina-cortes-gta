import React from 'react';
import {
  AbsoluteFill,
  Easing,
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
  const from = index === 0 ? 1.14 : index % 2 === 1 ? 1.07 : 1.0;
  const s = interpolate(frame, [0, 9], [from, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return <AbsoluteFill style={{transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};

const Top = ({segments, fps, sourceFile, focus}) => {
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
                style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${focus.x}% ${focus.y}%`}}
              />
            </Punch>
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
      <Top segments={props.segments} fps={fps} sourceFile={props.sourceFile} focus={props.focus} />
      <Bottom file={props.bottomFile} start={props.bottomStart} duration={props.bottomDuration} fps={fps} total={total} />
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
    </AbsoluteFill>
  );
};
