// Funções comuns do modo ao vivo: lista de blocos gravados, linha do tempo absoluta da live e fonte para textos.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const readJson = (f, fallback) => {
  try {
    // tira o BOM (editores do Windows e o PowerShell gravam UTF-8 com BOM, e o JSON.parse não aceita)
    return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    if (fs.existsSync(f) && e instanceof SyntaxError) console.warn(`Aviso: ${f} não é um JSON válido (${e.message}).`);
    return fallback;
  }
};
export const writeJson = (f, data) => {
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
};

export const probeDuration = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}).trim());

// Ao ler um bloco gravado: no primeiro bloco de uma live do YouTube o áudio pode começar alguns segundos depois do
// vídeo (é assim na própria live; os tempos originais são mantidos para ficar em sincronia). Com a análise padrão
// (~5 MB) o FFmpeg nem acha o áudio; estas opções o fazem olhar mais longe.
export const PROBE = ['-analyzeduration', '30M', '-probesize', '100M'];

export const gravacao =(live) => readJson(path.join(live, 'gravacao.json'), {ativo: false});

// Blocos gravados, em ordem, com o início de cada um na linha do tempo da live (segundos desde o começo da gravação).
// Só os blocos FECHADOS têm duração definitiva: enquanto a gravação está ativa, o último bloco ainda está crescendo.
// As durações ficam em cache em blocos.json.
export function listBlocks(live) {
  const dir = path.join(live, 'blocos');
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^bloco-\d+\.ts$/.test(f)).sort() : [];
  const ativo = gravacao(live).ativo;
  const cacheFile = path.join(live, 'blocos.json');
  const cache = readJson(cacheFile, {});
  const blocks = [];
  let t = 0;
  names.forEach((nome, i) => {
    const fechado = !ativo || i < names.length - 1;
    const file = path.join(dir, nome);
    let dur = fechado ? cache[nome] : undefined;
    if (dur === undefined) {
      try {
        dur = probeDuration(file);
      } catch {
        dur = 0;
      }
      if (fechado) cache[nome] = dur;
    }
    blocks.push({nome: nome.replace(/\.ts$/, ''), arquivo: file, inicio: t, fim: t + dur, dur, fechado});
    t += dur;
  });
  writeJson(cacheFile, cache);
  return blocks;
}

export const hms = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
};

// Fonte em negrito do sistema, já escapada para o filtro drawtext do FFmpeg (null se não achar).
export function drawtextFont() {
  const candidates = [
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/segoeuib.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  ];
  const f = candidates.find((c) => fs.existsSync(c));
  return f ? filterPath(f) : null;
}

// Caminho de arquivo escapado para usar dentro de um filtro do FFmpeg (entre aspas simples).
export const filterPath = (p) => path.resolve(p).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\\\\\''");
