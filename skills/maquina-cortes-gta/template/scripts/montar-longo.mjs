#!/usr/bin/env node
// Monta um vídeo LONGO horizontal (YouTube, 1920×1080) a partir da live gravada: uma missão inteira, uma sessão de
// exploração etc. Sem limite de duração. Usa o FFmpeg direto (bem mais rápido que o Remotion para horas de vídeo).
//
//   node montar-longo.mjs <pasta_da_live> <id_do_video> [--qualidade rapida|normal]
//
// Lê <live>/longos.json (tempos em SEGUNDOS DA LIVE, os mesmos que o transcript-text imprime com offset):
// {
//   "videos": [{
//     "id": "missao-assalto-ao-banco", "tipo": "missao", "titulo": "...", "status": "aberto",
//     "trechos":  [{"inicio": 3605.2, "fim": 9120.0, "capitulo": "O plano"}],      partes que entram, em ordem
//     "remover":  [{"inicio": 4100.0, "fim": 4390.5, "motivo": "morreu e repetiu"}], partes tiradas de dentro dos trechos
//     "acelerar": [{"inicio": 5000.0, "fim": 5180.0, "vezes": 2}]                    partes aceleradas (viagens longas)
//   }]
// }
// Saídas: <live>/longos/<id>.mp4 e <id>-capitulos.txt (para colar na descrição do YouTube).
// No fim, marca o vídeo como "renderizado" no longos.json.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PROBE, drawtextFont, filterPath, hms, listBlocks, probeDuration, readJson, writeJson} from './live-comum.mjs';

const args = process.argv.slice(2);
const [live, id] = args;
if (!live || !id) {
  console.error('Uso: node montar-longo.mjs <pasta_da_live> <id_do_video> [--qualidade rapida|normal]');
  process.exit(1);
}
const qi = args.indexOf('--qualidade');
const preset = qi >= 0 && args[qi + 1] === 'normal' ? 'medium' : 'veryfast';
const W = 1920;
const H = 1080;
const FPS = 30;

const longosFile = path.join(live, 'longos.json');
const longos = readJson(longosFile, {videos: []});
const video = longos.videos.find((v) => v.id === id);
if (!video) {
  console.error(`Vídeo "${id}" não está em ${longosFile}`);
  process.exit(1);
}
const blocks = listBlocks(live).filter((b) => b.dur > 0);
const fimGravado = blocks.length ? blocks[blocks.length - 1].fim : 0;

// 1) intervalos finais: trechos − remover, divididos onde a velocidade muda
const cortes = (video.remover || []).map((r) => [r.inicio, r.fim]);
const vel = video.acelerar || [];
const pecas = [];
for (const [ti, t] of (video.trechos || []).entries()) {
  const a0 = Math.max(0, t.inicio);
  const b0 = Math.min(fimGravado, t.fim);
  if (b0 - a0 < 0.3) {
    console.warn(`Trecho ${ti} (${hms(t.inicio)}–${hms(t.fim)}) fora do que foi gravado; pulado.`);
    continue;
  }
  // pontos onde algo muda dentro do trecho
  const pts = new Set([a0, b0]);
  for (const [x, y] of cortes) [x, y].forEach((p) => p > a0 && p < b0 && pts.add(p));
  for (const v of vel) [v.inicio, v.fim].forEach((p) => p > a0 && p < b0 && pts.add(p));
  const sorted = [...pts].sort((x, y) => x - y);
  let primeira = true;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const meio = (a + b) / 2;
    if (b - a < 0.3 || cortes.some(([x, y]) => meio > x && meio < y)) continue;
    const v = vel.find((s) => meio > s.inicio && meio < s.fim);
    const vezes = v ? Math.min(8, Math.max(1, v.vezes || 2)) : 1;
    const ultima = pecas.length && pecas[pecas.length - 1];
    // junta com a peça anterior se for contínua e na mesma velocidade
    if (ultima && !primeira && Math.abs(ultima.b - a) < 0.01 && ultima.vezes === vezes) ultima.b = b;
    else pecas.push({a, b, vezes, capitulo: primeira ? t.capitulo : undefined});
    primeira = false;
  }
}
if (!pecas.length) {
  console.error('Nada para montar: confira os trechos e o que foi removido.');
  process.exit(1);
}

// 2) cada peça pode atravessar vários blocos: divide por bloco (tempo local de cada arquivo)
const partes = [];
for (const p of pecas) {
  let cap = p.capitulo;
  for (const bl of blocks) {
    const a = Math.max(p.a, bl.inicio);
    const b = Math.min(p.b, bl.fim);
    if (b - a < 0.1) continue;
    partes.push({arquivo: bl.arquivo, ss: a - bl.inicio, dur: b - a, vezes: p.vezes, capitulo: cap});
    cap = undefined;
  }
}

// 3) marca d'água (logo redonda + nome do perfil) como PNG, uma vez só
const HOME = path.join(os.homedir(), '.maquina-cortes-gta');
const cfg = readJson(path.join(HOME, 'config.json'), {});
const outDir = path.join(live, 'longos');
const tmp = path.join(outDir, `.tmp-${id}`);
fs.rmSync(tmp, {recursive: true, force: true});
fs.mkdirSync(tmp, {recursive: true});
let wm = null;
const logo = cfg.logo && path.join(HOME, cfg.logo);
if (logo && fs.existsSync(logo)) {
  wm = path.join(tmp, 'wm.png');
  const font = drawtextFont();
  const L = 84;
  // o nome vai por arquivo, sem expansão: qualquer caractere (%, :, aspas) aparece como está
  const nameFile = path.join(tmp, 'nome.txt');
  if (cfg.profileName) fs.writeFileSync(nameFile, cfg.profileName);
  const name = font && cfg.profileName
    ? `,drawtext=fontfile='${font}':textfile='${filterPath(nameFile)}':expansion=none:fontsize=34:fontcolor=white:borderw=3:bordercolor=black@0.8:x=${L + 18}:y=(h-text_h)/2`
    : '';
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', logo,
    '-f', 'lavfi', '-i', `color=c=black@0.0:s=700x${L},format=rgba`,
    '-filter_complex',
    `[0:v]scale=${L}:${L}:force_original_aspect_ratio=increase,crop=${L}:${L},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${L / 2},Y-${L / 2}),${L / 2}),255,0)'[lg];[1:v][lg]overlay=0:0${name}[o]`,
    '-map', '[o]', '-frames:v', '1', wm,
  ]);
} else {
  console.warn('Sem logo configurada: o vídeo sai sem marca d\'água (configure com setup.mjs --profile/--logo).');
}

// 4) renderiza cada parte com o mesmo formato (para juntar sem recodificar)
const atempo = (v) => {
  const f = [];
  let r = v;
  while (r > 2) {
    f.push('atempo=2');
    r /= 2;
  }
  f.push(`atempo=${r.toFixed(4)}`);
  return f.join(',');
};
const lista = [];
const capitulos = [];
let tOut = 0;
console.log(`> Montando "${video.titulo || id}": ${partes.length} partes, ${hms(partes.reduce((s, p) => s + p.dur / p.vezes, 0))} no final`);
for (const [i, p] of partes.entries()) {
  const out = path.join(tmp, `p${String(i).padStart(4, '0')}.mp4`);
  const durOut = p.dur / p.vezes;
  const fade = Math.min(0.06, durOut / 4);
  const vf = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}${p.vezes > 1 ? `,setpts=PTS/${p.vezes}` : ''}[v0]`;
  const wmF = wm ? `;[v0][1:v]overlay=W-w-40:36[v]` : ';[v0]null[v]';
  const af = `[0:a]aresample=48000${p.vezes > 1 ? `,${atempo(p.vezes)}` : ''},afade=t=in:d=${fade},afade=t=out:st=${Math.max(0, durOut - fade).toFixed(3)}:d=${fade}[a]`;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', ...PROBE, '-ss', p.ss.toFixed(3), '-t', p.dur.toFixed(3), '-i', p.arquivo, ...(wm ? ['-i', wm] : []),
    '-filter_complex', `${vf}${wmF};${af}`,
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', preset, '-crf', '21', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-t', durOut.toFixed(3), out,
  ]);
  if (p.capitulo) capitulos.push({t: tOut, nome: p.capitulo});
  tOut += probeDuration(out);
  lista.push(`file '${path.resolve(out).replace(/\\/g, '/')}'`);
  if (i % 10 === 9) console.log(`  ${i + 1}/${partes.length} partes`);
}

// 5) junta tudo
fs.writeFileSync(path.join(tmp, 'lista.txt'), lista.join('\n'));
const final = path.join(outDir, `${id}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'lista.txt'), '-c', 'copy', '-movflags', '+faststart', final]);
const duracao = probeDuration(final);

// capítulos no formato da descrição do YouTube (o primeiro precisa ser 0:00)
if (capitulos.length && capitulos[0].t > 1) capitulos.unshift({t: 0, nome: 'Início'});
const capTxt = capitulos.map((c) => `${hms(c.t).replace(/^0(\d:)/, '$1')} ${c.nome}`).join('\n');
if (capTxt) fs.writeFileSync(path.join(outDir, `${id}-capitulos.txt`), capTxt + '\n');
fs.rmSync(tmp, {recursive: true, force: true});

const atual = readJson(longosFile, {videos: []});
const v = atual.videos.find((x) => x.id === id);
if (v) Object.assign(v, {status: 'renderizado', arquivo: path.resolve(final), duracao: Number(duracao.toFixed(1))});
writeJson(longosFile, atual);
console.log(JSON.stringify({id, arquivo: path.resolve(final), duracao: hms(duracao), capitulos: capitulos.length}));
