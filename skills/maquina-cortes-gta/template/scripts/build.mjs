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
cuts.clips.forEach((clip, idx) => {
  const start = Math.max(0, clip.start);
  const end = Math.min(sourceTotal, clip.end);
  const segs = segmentsFor(start, end);

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

  const bottomStart = Math.min(clip.bottomStart ?? (8 + idx * 17) % Math.max(1, bottomTotal - 5), Math.max(0, bottomTotal - 5));
  const props = {
    totalSeconds: total,
    segments: segs.map(({from, to}) => ({from, to})),
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
});
console.log(JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
