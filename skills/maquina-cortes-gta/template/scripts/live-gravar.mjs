#!/usr/bin/env node
// Grava uma live (Twitch, YouTube, Kick...) em blocos, enquanto ela acontece.
//
//   node live-gravar.mjs <link_da_live> <pasta_da_live> [--bloco 600] [--desde-inicio]
//
// --bloco         tamanho de cada bloco em segundos (padrão 600 = 10 min)
// --desde-inicio  (só YouTube, experimental) grava desde o começo da live, não só a partir de agora
//
// Também aceita um ARQUIVO de vídeo no lugar do link (para testar o fluxo sem live).
//
// Saídas: <pasta>/blocos/bloco-000.ts, bloco-001.ts...; <pasta>/gravacao.json ({ativo, ...}).
// Para parar: crie o arquivo <pasta>/PARAR (ou Ctrl+C). O bloco atual é fechado e a gravação encerra.
// Se a conexão cair, tenta reconectar sozinho (até 6 vezes seguidas, com 20 s de espera); os blocos continuam a numeração.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {readJson, writeJson} from './live-comum.mjs';

const args = process.argv.slice(2);
const [fonte, live] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').match(/^--bloco$/));
if (!fonte || !live) {
  console.error('Uso: node live-gravar.mjs <link_da_live> <pasta_da_live> [--bloco 600] [--desde-inicio]');
  process.exit(1);
}
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const blocoSeg = Number(opt('--bloco', 600));
const desdeInicio = args.includes('--desde-inicio');
const isFile = fs.existsSync(fonte);

const dir = path.join(live, 'blocos');
fs.mkdirSync(dir, {recursive: true});
const stateFile = path.join(live, 'gravacao.json');
const stopFile = path.join(live, 'PARAR');
if (fs.existsSync(stopFile)) fs.rmSync(stopFile);

const state = {...readJson(stateFile, {}), ativo: true, fonte, blocoSegundos: blocoSeg, pid: process.pid, inicio: readJson(stateFile, {}).inicio || new Date().toISOString()};
writeJson(stateFile, state);

let stopping = false;
let current = null; // {ytdlp, ffmpeg}

const stop = () => {
  if (stopping) return;
  stopping = true;
  console.log('> Parando: fechando o bloco atual...');
  if (!current) return;
  if (current.ytdlp) current.ytdlp.kill();
  else current.ffmpeg.stdin.write('q');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const watcher = setInterval(() => fs.existsSync(stopFile) && stop(), 2000);

const nextNumber = () => {
  const nums = fs.readdirSync(dir).map((f) => f.match(/^bloco-(\d+)\.ts$/)).filter(Boolean).map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) + 1 : 0;
};

// Links diretos da live (o YouTube costuma entregar vídeo e áudio separados). Os links expiram em algumas horas;
// cada reconexão pede links novos.
function streamUrls() {
  const r = spawnSync('yt-dlp', ['--no-warnings', '--no-playlist', '-g', '-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', fonte], {encoding: 'utf8'});
  if (r.status !== 0) {
    process.stderr.write(r.stderr || '');
    return [];
  }
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function runOnce() {
  return new Promise((resolve) => {
    const startNumber = nextNumber();
    const urls = isFile || desdeInicio ? [] : streamUrls();
    if (!isFile && !desdeInicio && !urls.length) return resolve({code: 1, seconds: 0});
    const separado = urls.length >= 2; // vídeo e áudio em links diferentes
    const segArgs = [
      '-map', '0:v:0', '-map', separado ? '1:a:0' : '0:a:0?', '-c', 'copy',
      '-f', 'segment', '-segment_time', String(blocoSeg), '-segment_format', 'mpegts',
      '-segment_start_number', String(startNumber), '-reset_timestamps', '1',
      path.join(dir, 'bloco-%03d.ts'),
    ];
    let ytdlp = null;
    let ffmpeg;
    if (isFile) {
      ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', fonte, ...segArgs], {stdio: ['pipe', 'inherit', 'inherit']});
    } else if (!desdeInicio) {
      // o FFmpeg lê a live direto (HLS) e junta vídeo + áudio sem recodificar.
      // -copyts: vídeo e áudio começam em pontos diferentes da live (no YouTube, até ~5 s de diferença); sem manter os
      // tempos originais, os dois seriam zerados separadamente e o som ficaria fora de sincronia com a imagem.
      const inputs = urls.slice(0, 2).flatMap((u) => ['-i', u]);
      ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-copyts', ...inputs, ...segArgs], {stdio: ['pipe', 'inherit', 'inherit']});
    } else {
      ytdlp = spawn(
        'yt-dlp',
        ['-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '--no-playlist', '--no-part', '--hls-use-mpegts', ...(desdeInicio ? ['--live-from-start'] : []), '-o', '-', fonte],
        {stdio: ['ignore', 'pipe', 'inherit']},
      );
      ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', ...segArgs], {stdio: ['pipe', 'inherit', 'inherit']});
      ytdlp.stdout.pipe(ffmpeg.stdin);
      ytdlp.on('exit', () => ffmpeg.stdin.end());
      ffmpeg.stdin.on('error', () => {});
    }
    current = {ytdlp, ffmpeg};
    const t0 = Date.now();
    console.log(`> Gravando ${isFile ? 'o arquivo' : 'a live'} em blocos de ${blocoSeg} s (começando no bloco ${startNumber})`);
    ffmpeg.on('exit', (code) => {
      current = null;
      resolve({code, seconds: (Date.now() - t0) / 1000});
    });
  });
}

let falhas = 0;
while (!stopping) {
  const r = await runOnce();
  if (stopping || isFile) break;
  // a live acabou ou a conexão caiu: tenta de novo algumas vezes antes de desistir
  falhas = r.seconds < 60 ? falhas + 1 : 1;
  if (falhas > 6) {
    console.log('> A live parece ter terminado (sem sinal depois de várias tentativas).');
    break;
  }
  console.log(`> Sinal perdido. Tentando reconectar em 20 s (tentativa ${falhas}/6)...`);
  await new Promise((res) => setTimeout(res, 20000));
}

clearInterval(watcher);
writeJson(stateFile, {...readJson(stateFile, {}), ativo: false, fim: new Date().toISOString(), pid: null});
console.log('> Gravação encerrada.');
