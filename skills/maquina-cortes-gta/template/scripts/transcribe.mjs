#!/usr/bin/env node
// Transcreve o vídeo com whisper.cpp (palavra por palavra) e mede os silêncios.
// Uso: node scripts/transcribe.mjs <video> <pasta_de_trabalho> [idioma]
// Saídas na pasta de trabalho: audio16k.wav, captions.json, silences.json, meta.json
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {transcribe, toCaptions} from '@remotion/install-whisper-cpp';

const [video, work, langArg, maxArg] = process.argv.slice(2);
if (!video || !work) {
  console.error('Uso: node scripts/transcribe.mjs <video> <pasta_de_trabalho> [idioma] [segundos_maximos]');
  process.exit(1);
}
// Opcional: transcrever só os primeiros N segundos (útil para testar rápido em vídeo longo).
const maxSeconds = maxArg ? Number(maxArg) : null;
const HOME = path.join(os.homedir(), '.maquina-cortes-gta');
const cfg = JSON.parse(fs.readFileSync(path.join(HOME, 'config.json'), 'utf8'));
const model = cfg.whisperModel || 'small';
const language = langArg || cfg.language || 'pt';
fs.mkdirSync(work, {recursive: true});

// metadados
const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', video], {encoding: 'utf8'}),
);
const meta = {duration: Number(probe.format.duration), width: probe.streams[0].width, height: probe.streams[0].height, fps: probe.streams[0].r_frame_rate};
fs.writeFileSync(path.join(work, 'meta.json'), JSON.stringify(meta, null, 2));

// áudio 16 kHz mono (formato que o whisper.cpp pede)
const wav = path.join(work, 'audio16k.wav');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, ...(maxSeconds ? ['-t', String(maxSeconds)] : []), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);

// silêncios (para cortar as pausas depois)
const sd = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'silencedetect=noise=-35dB:d=0.45', '-f', 'null', '-'], {encoding: 'utf8'});
const silences = [];
let open = null;
for (const line of sd.stderr.split(/\r?\n/)) {
  const a = line.match(/silence_start: ([0-9.]+)/);
  const b = line.match(/silence_end: ([0-9.]+)/);
  if (a) open = Number(a[1]);
  if (b && open !== null) {
    silences.push({start: open, end: Number(b[1])});
    open = null;
  }
}
if (open !== null) silences.push({start: open, end: meta.duration});
fs.writeFileSync(path.join(work, 'silences.json'), JSON.stringify(silences, null, 2));

// transcrição com tempo por palavra
const out = await transcribe({
  inputPath: wav,
  whisperPath: path.join(HOME, 'whisper.cpp'),
  whisperCppVersion: '1.5.5',
  model,
  tokenLevelTimestamps: true,
  language,
  printOutput: false,
});
const {captions} = toCaptions({whisperCppOutput: out});

// junta os pedaços (tokens) em palavras: um token que começa com espaço abre uma palavra nova
const words = [];
for (const c of captions) {
  const raw = c.text;
  if (/^\s*\[.*\]\s*$/.test(raw)) continue; // [_BEG_], [MÚSICA] etc.
  const startsWord = /^\s/.test(raw) || words.length === 0;
  const t = raw.trim();
  if (!t) continue;
  if (startsWord) words.push({text: t, startMs: c.startMs, endMs: c.endMs});
  else {
    const w = words[words.length - 1];
    w.text += t;
    w.endMs = c.endMs;
  }
}
fs.writeFileSync(path.join(work, 'captions.json'), JSON.stringify(words, null, 2));
console.log(JSON.stringify({palavras: words.length, silencios: silences.length, duracao: meta.duration, idioma: language, modelo: model}));
