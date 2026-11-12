#!/usr/bin/env node
// Imprime a transcrição como linhas "[mm:ss] frase", para o Claude ler sem despejar o JSON.
// Uso: node scripts/transcript-text.mjs <pasta_de_trabalho>
import fs from 'node:fs';
import path from 'node:path';

const work = process.argv[2];
if (!work) {
  console.error('Uso: node scripts/transcript-text.mjs <pasta_de_trabalho>');
  process.exit(1);
}
const words = JSON.parse(fs.readFileSync(path.join(work, 'captions.json'), 'utf8'));
const mmss = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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
