#!/usr/bin/env node
// Espera o próximo bloco FECHADO da live que ainda não foi processado, prepara a pasta de trabalho dele,
// transcreve e gera o mosaico de quadros. Rode em segundo plano: quando terminar, o bloco está pronto para análise.
//
//   node live-bloco.mjs <pasta_da_live> [--esperar 1800] [--sobreposicao 60] [--idioma pt] [--sem-transcrever]
//
// --esperar        quanto tempo (s) esperar por um bloco novo antes de desistir (padrão 1800)
// --sobreposicao   segundos do fim do bloco anterior colocados no começo deste, para não partir um assunto ao meio (padrão 60)
//
// Pasta de trabalho: <live>/trabalho/<bloco>/ com source.mp4, bottom.mp4 (se <live>/bottom.mp4 existir),
// captions.json, silences.json, meta.json, quadros.jpg e bloco.json.
// bloco.json traz o `offset`: o segundo da live que corresponde ao 0 do source.mp4 (tempo absoluto = offset + tempo local).
// Saída (última linha, JSON): {bloco, trabalho, offset, duracao, ...} | {aguardando: true} | {fim: true}
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROBE, gravacao, listBlocks, probeDuration, readJson, writeJson} from './live-comum.mjs';

const args = process.argv.slice(2);
const live = args[0];
if (!live || live.startsWith('--')) {
  console.error('Uso: node live-bloco.mjs <pasta_da_live> [--esperar 1800] [--sobreposicao 60] [--idioma pt] [--sem-transcrever]');
  process.exit(1);
}
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const esperar = Number(opt('--esperar', 1800));
const overlap = Number(opt('--sobreposicao', 60));
const idioma = opt('--idioma', 'pt');
const transcrever = !args.includes('--sem-transcrever');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const estadoFile = path.join(live, 'estado.json');
const estado = readJson(estadoFile, {preparados: []});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
let alvo = null;
let blocks;
for (;;) {
  blocks = listBlocks(live);
  alvo = blocks.find((b) => b.fechado && b.dur > 1 && !estado.preparados.includes(b.nome));
  if (alvo) break;
  const pendentes = blocks.filter((b) => !estado.preparados.includes(b.nome));
  if (!gravacao(live).ativo && pendentes.every((b) => b.dur <= 1)) {
    console.log(JSON.stringify({fim: true, blocosProcessados: estado.preparados.length}));
    process.exit(0);
  }
  if ((Date.now() - t0) / 1000 > esperar) {
    console.log(JSON.stringify({aguardando: true, gravando: gravacao(live).ativo, blocos: blocks.length}));
    process.exit(0);
  }
  await sleep(10000);
}

const work = path.join(live, 'trabalho', alvo.nome);
fs.mkdirSync(work, {recursive: true});
const idx = blocks.indexOf(alvo);
const prev = idx > 0 ? blocks[idx - 1] : null;
const source = path.join(work, 'source.mp4');
let tail = 0;

console.log(`> Preparando ${alvo.nome}`);
if (prev && overlap > 0) {
  // fim do bloco anterior (corte sem recodificar: começa no keyframe mais próximo, por isso medimos a duração real)
  const tailFile = path.join(work, 'tail.ts');
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...PROBE, '-ss', String(Math.max(0, prev.dur - overlap)), '-i', prev.arquivo, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', tailFile]);
  tail = probeDuration(tailFile);
  const list = path.join(work, 'concat.txt');
  const esc = (p) => path.resolve(p).replace(/\\/g, '/').replace(/'/g, "'\\''");
  fs.writeFileSync(list, `file '${esc(tailFile)}'\nfile '${esc(alvo.arquivo)}'\n`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...PROBE, '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', source]);
  fs.rmSync(tailFile);
  fs.rmSync(list);
} else {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...PROBE, '-i', alvo.arquivo, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', source]);
}
const offset = alvo.inicio - tail;
const bottom = path.join(live, 'bottom.mp4');
if (fs.existsSync(bottom)) fs.copyFileSync(bottom, path.join(work, 'bottom.mp4'));
const info = {bloco: alvo.nome, trabalho: path.resolve(work), offset, inicioBloco: alvo.inicio, sobreposicao: tail, duracao: probeDuration(source)};
writeJson(path.join(work, 'bloco.json'), info);

// mosaico de quadros (1 a cada 20 s), com o horário da live em cada quadro
spawnSync(process.execPath, [path.join(HERE, 'live-quadros.mjs'), source, path.join(work, 'quadros.jpg'), '--cada', '20', '--offset', String(offset)], {stdio: 'inherit'});

if (transcrever) {
  console.log('> Transcrevendo');
  const t1 = Date.now();
  const r = spawnSync(process.execPath, [path.join(HERE, 'transcribe.mjs'), source, work, idioma], {stdio: 'inherit'});
  info.transcricaoOk = r.status === 0;
  info.transcricaoSegundos = Math.round((Date.now() - t1) / 1000);
  // se transcrever demora mais que o próprio bloco, a análise vai ficando para trás da live
  info.atrasando = info.transcricaoSegundos > alvo.dur;
  writeJson(path.join(work, 'bloco.json'), info);
}

estado.preparados.push(alvo.nome);
writeJson(estadoFile, estado);
const restantes = listBlocks(live).filter((b) => b.fechado && !estado.preparados.includes(b.nome)).length;
console.log(JSON.stringify({...info, blocosNaFila: restantes, gravando: gravacao(live).ativo}));
