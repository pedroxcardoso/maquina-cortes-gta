#!/usr/bin/env node
// Gera um mosaico de quadros do vídeo (1 quadro a cada N segundos), cada um com o horário da live escrito em cima.
// Serve para o Claude "ver" o bloco: se é missão, cutscene, exploração, menu, tela de carregamento ou AFK.
//
//   node live-quadros.mjs <video> <saida.jpg> [--cada 20] [--offset 0] [--colunas 6]
//
// --offset soma esse valor (s) ao horário escrito (para mostrar o tempo da live, não o do bloco).
// Mosaicos com mais de 48 quadros são divididos em várias imagens (saida-1.jpg, saida-2.jpg...).
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {drawtextFont, probeDuration} from './live-comum.mjs';

const args = process.argv.slice(2);
const [video, saida] = args;
if (!video || !saida) {
  console.error('Uso: node live-quadros.mjs <video> <saida.jpg> [--cada 20] [--offset 0] [--colunas 6]');
  process.exit(1);
}
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const cada = opt('--cada', 20);
const offset = opt('--offset', 0);
const cols = opt('--colunas', 6);
const POR_IMAGEM = 48;

const dur = probeDuration(video);
const total = Math.max(1, Math.ceil(dur / cada));
const font = drawtextFont();
const saidas = [];
for (let parte = 0; parte * POR_IMAGEM < total; parte++) {
  const n = Math.min(POR_IMAGEM, total - parte * POR_IMAGEM);
  const ini = parte * POR_IMAGEM * cada;
  const rows = Math.ceil(n / cols);
  const label = font
    ? `,drawtext=fontfile='${font}':text='%{pts\\:hms\\:${(offset + ini).toFixed(2)}}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4`
    : '';
  const out = total > POR_IMAGEM ? saida.replace(/(\.\w+)$/, `-${parte + 1}$1`) : saida;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-ss', String(ini), '-t', String(n * cada), '-i', video,
    '-vf', `fps=1/${cada},scale=320:-2${label},tile=${cols}x${rows}:padding=4:color=black`,
    '-frames:v', '1', '-q:v', '4', out,
  ]);
  saidas.push(path.resolve(out));
}
console.log(JSON.stringify({mosaicos: saidas, quadros: total, cadaSegundos: cada}));
