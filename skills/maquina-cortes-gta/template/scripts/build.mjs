#!/usr/bin/env node
// Monta e renderiza os cortes: tira as pausas, ajusta as legendas à nova linha do tempo e roda o Remotion.
// Uso: node scripts/build.mjs <pasta_de_trabalho> <pasta_de_saida>
// A pasta de trabalho precisa ter: source.mp4, bottom.mp4, captions.json, silences.json, cuts.json
// (e a logo é copiada da config). cuts.json:
//   { "clips": [ { "id": "01-gancho", "start": 12.4, "end": 51.0,
//                  "focus": {"x": 50, "y": 35}, "bottomStart": 0 } ] }
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {searchImages} from './buscar-imagens.mjs';

const [work, outDir] = process.argv.slice(2);
if (!work || !outDir) {
  console.error('Uso: node scripts/build.mjs <pasta_de_trabalho> <pasta_de_saida>');
  process.exit(1);
}
const FPS = 30;
const HOME = path.join(os.homedir(), '.maquina-cortes-gta');
const ENGINE = path.join(HOME, 'engine');
const cfg = JSON.parse(fs.readFileSync(path.join(HOME, 'config.json'), 'utf8'));
const read = (f) => JSON.parse(fs.readFileSync(path.join(work, f), 'utf8'));
const words = read('captions.json');
const silences = read('silences.json');
const cuts = read('cuts.json');
const meta = read('meta.json');
fs.mkdirSync(outDir, {recursive: true});

// logo na pasta pública do render
const logoName = `wm-${cfg.logo}`;
fs.copyFileSync(path.join(HOME, cfg.logo), path.join(work, logoName));

const probeDur = (f) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], {encoding: 'utf8'}).trim());
const bottomTotal = probeDur(path.join(work, 'bottom.mp4'));
const sourceTotal = probeDur(path.join(work, 'source.mp4'));

// tira as pausas longas (guarda um respiro de 0,12 s em cada ponta)
function segmentsFor(start, end, minSilence = 0.5, pad = 0.12) {
  let cursor = start;
  const segs = [];
  for (const s of silences) {
    if (s.end <= start || s.start >= end || s.end - s.start < minSilence) continue;
    const cutFrom = Math.max(s.start + pad, start);
    const cutTo = Math.min(s.end - pad, end);
    if (cutTo - cutFrom < 0.2) continue;
    if (cutFrom - cursor > 0.3) segs.push({from: cursor, to: cutFrom});
    cursor = cutTo;
  }
  if (end - cursor > 0.3) segs.push({from: cursor, to: end});
  return segs.length ? segs : [{from: start, to: end}];
}

// cortes rápidos: quebra planos longos a cada ~`every` segundos, sempre no começo de uma palavra
// (não tira conteúdo; cada quebra é um jump cut com mudança de zoom, SEM flash nem swoosh; só as viradas de seção
// listadas em `turns` ganham flash e swoosh). every = 0 desliga.
function splitSegs(segs, every) {
  if (!every) return segs;
  const out = [];
  for (const s of segs) {
    const starts = words.map((w) => w.startMs / 1000).filter((t) => t > s.from + 1 && t < s.to - 1);
    let cursor = s.from;
    while (s.to - cursor > every * 1.5) {
      const target = cursor + every;
      const cand = starts
        .filter((t) => t > cursor + 1.2 && t < s.to - 1)
        .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      if (!cand) break;
      out.push({from: cursor, to: cand});
      cursor = cand;
    }
    out.push({from: cursor, to: s.to});
  }
  return out;
}

// agrupa as palavras em páginas de até 3 palavras
function makePages(list) {
  const pages = [];
  let cur = [];
  const flush = () => {
    if (cur.length) pages.push({words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs});
    cur = [];
  };
  for (const w of list) {
    const gap = cur.length ? w.startMs - cur[cur.length - 1].endMs : 0;
    const chars = cur.reduce((n, x) => n + x.text.length, 0) + w.text.length;
    if (cur.length >= 3 || chars > 20 || gap > 600) flush();
    cur.push(w);
    if (/[.!?…]$/.test(w.text)) flush();
  }
  flush();
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    p.endMs = Math.min(next ? next.startMs : Infinity, p.endMs + 250);
    p.words = p.words.map((w) => ({...w, text: w.text.replace(/[,;:]$/, '')}));
  });
  return pages;
}

const results = [];
for (const [idx, clip] of cuts.clips.entries()) {
  const start = Math.max(0, clip.start);
  const end = Math.min(sourceTotal, clip.end);
  // `ritmo`: padrão = jump cuts a cada ~2,8 s (zoom muda, corte seco, SEM swoosh); "normal" = só tira as pausas;
  // "rapido" = o estilo antigo (flash + swoosh em TODO corte); `cutEvery` em segundos muda o intervalo.
  // `turns`: lista de segundos (do vídeo de origem) das VIRADAS DE SEÇÃO (muda de assunto, entra b-roll, ex.: o
  // streamer cita PlayStation/PS5): só nelas entram flash e swoosh (3 a 5 por corte).
  const legacy = clip.ritmo === 'rapido';
  const every = clip.ritmo === 'normal' ? 0 : clip.cutEvery ?? (legacy ? 3.2 : 2.8);
  let segs = splitSegs(segmentsFor(start, end), every);
  for (const t of clip.turns || []) {
    const k = segs.findIndex((x) => t > x.from + 0.3 && t < x.to - 0.3);
    if (k >= 0) segs.splice(k, 1, {from: segs[k].from, to: t}, {from: t, to: segs[k].to});
  }
  segs.forEach((x, i) => {
    x.turn = i > 0 && (legacy || (clip.turns || []).some((t) => Math.abs(t - x.from) < 0.05));
  });

  // linha do tempo nova, em quadros inteiros (mesma conta do componente)
  let outFrames = 0;
  const mapped = segs.map((s) => {
    const frames = Math.max(1, Math.round((s.to - s.from) * FPS));
    const m = {...s, outStart: outFrames / FPS};
    outFrames += frames;
    return m;
  });
  const total = outFrames / FPS;

  const remapped = [];
  for (const w of words) {
    const ws = w.startMs / 1000;
    const seg = mapped.find((s) => ws >= s.from - 0.02 && ws < s.to);
    if (!seg) continue;
    const o = seg.outStart + Math.max(0, ws - seg.from);
    const oe = Math.min(seg.outStart + (seg.to - seg.from), o + Math.max(0.12, (w.endMs - w.startMs) / 1000));
    remapped.push({text: w.text.toUpperCase(), startMs: Math.round(o * 1000), endMs: Math.round(oe * 1000)});
  }

  // ---- efeitos sonoros e imagens ----
  const toOut = (t) => {
    const m = mapped.find((x) => t >= x.from - 0.02 && t < x.to) ?? mapped[mapped.length - 1];
    return Math.max(0, m.outStart + (t - m.from));
  };
  const sfxDir = path.join(HOME, 'sfx');
  const gain = cfg.sfxGain ?? 0.6; // volume geral dos efeitos (os efeitos ficam bem abaixo da voz)
  const sfxFile = (name) => {
    const f = ['.mp3', '.wav'].map((e) => path.join(sfxDir, name + e)).find((p) => fs.existsSync(p));
    if (!f) return null;
    const dst = `sfx-${name}${path.extname(f)}`;
    fs.copyFileSync(f, path.join(work, dst));
    return dst;
  };
  const sfx = [];
  const impact = sfxFile('impacto');
  const whoosh = sfxFile('whoosh');
  const pop = sfxFile('pop');
  if (impact) sfx.push({file: impact, at: 0, volume: 0.5 * gain});
  if (whoosh) mapped.filter((m) => m.turn).forEach((m) => sfx.push({file: whoosh, at: Math.max(0, m.outStart - 0.08), volume: 0.45 * gain}));
  const images = [];
  for (const [k, im] of (clip.images || []).entries()) {
    let src = im.file && fs.existsSync(im.file) ? im.file : null;
    if (!src && im.query) {
      try {
        [src] = await searchImages(im.query, path.join(work, 'imgs'), 1, `${clip.id}-${k}`);
      } catch (e) {
        console.warn(`Imagem "${im.query}" ignorada: ${e.message}. Opções: configurar GOOGLE_API_KEY e GOOGLE_CSE_ID, mandar a imagem como arquivo ("file") ou seguir sem ela.`);
      }
    }
    if (!src) continue;
    const dst = `img-${clip.id}-${k}${path.extname(src)}`;
    fs.copyFileSync(src, path.join(work, dst));
    const at = toOut(im.at);
    images.push({file: dst, at, dur: im.dur ?? 2.2});
    if (pop) sfx.push({file: pop, at: Math.max(0, at - 0.05), volume: 0.45 * gain});
  }

  const bottomStart = Math.min(clip.bottomStart ?? (8 + idx * 17) % Math.max(1, bottomTotal - 5), Math.max(0, bottomTotal - 5));
  const props = {
    totalSeconds: total,
    segments: segs.map(({from, to, turn}) => ({from, to, turn: !!turn})),
    sourceFile: 'source.mp4',
    bottomFile: 'bottom.mp4',
    bottomStart,
    bottomDuration: bottomTotal - bottomStart,
    focus: clip.focus || {x: 50, y: 35},
    crop: clip.crop || null,
    sourceWidth: meta.width,
    sourceHeight: meta.height,
    pages: makePages(remapped),
    watermark: {logo: logoName, name: cfg.profileName},
    sfx,
    images,
  };
  const propsFile = path.join(work, `props-${clip.id}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(props));
  const out = path.resolve(outDir, `${clip.id}.mp4`);
  console.log(`> Renderizando ${clip.id} (${total.toFixed(1)} s)`);
  // chama o CLI do Remotion direto pelo Node (sem shell): funciona com espaços no caminho, no Windows e fora dele
  const cli = path.join(ENGINE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  const r = spawnSync(
    process.execPath,
    [cli, 'render', 'src/index.js', 'SplitCut', out, `--props=${propsFile}`, `--public-dir=${path.resolve(work)}`, '--codec=h264', '--crf=20', '--log=error'],
    {cwd: ENGINE, stdio: 'inherit'},
  );
  results.push({id: clip.id, arquivo: out, segundos: Number(total.toFixed(1)), ok: r.status === 0});
}
console.log(JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
