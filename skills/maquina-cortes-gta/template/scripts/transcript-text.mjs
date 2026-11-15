#!/usr/bin/env node
// Imprime a transcrição como linhas "[mm:ss] frase", para o Claude ler sem despejar o JSON.
// Uso: node scripts/transcript-text.mjs <pasta_de_trabalho> [offset_em_segundos]
// Com offset (modo ao vivo: o `offset` do bloco.json), o horário impresso é o da live: [h:mm:ss].
import fs from 'node:fs';
import path from 'node:path';

const work = process.argv[2];
if (!work) {
  console.error('Uso: node scripts/transcript-text.mjs <pasta_de_trabalho> [offset_em_segundos]');
  process.exit(1);
}
const offset = Number(process.argv[3] || 0);
const words = JSON.parse(fs.readFileSync(path.join(work, 'captions.json'), 'utf8'));
const mmss = (ms) => {
  const s = Math.floor(ms / 1000 + offset);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h || offset ? `${h}:${m}:${ss}` : `${m}:${ss}`;
};

let line = [];
let lineStart = 0;
const flush = () => {
  if (line.length) console.log(`[${mmss(lineStart)}] ${line.join(' ')}`);
  line = [];
};
words.forEach((w, i) => {
  const prev = words[i - 1];
  if (!line.length) lineStart = w.startMs;
  else if (prev && w.startMs - prev.endMs > 900) {
    flush();
    lineStart = w.startMs;
  }
  line.push(w.text);
  if (/[.!?…]$/.test(w.text) || line.length >= 28) flush();
});
flush();
