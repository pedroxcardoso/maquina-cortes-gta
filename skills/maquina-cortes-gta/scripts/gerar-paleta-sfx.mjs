#!/usr/bin/env node
// Gera a paleta de efeitos sonoros dos cortes (whoosh, impacto, pop) com a ElevenLabs, UMA vez,
// usando o gerador da skill sound-effects (glebis, MIT) que vem junto neste repositório.
// Cada efeito usa créditos da SUA conta ElevenLabs: a skill só roda isto depois de você aprovar.
//
//   node gerar-paleta-sfx.mjs            gera o que ainda não existe
//   node gerar-paleta-sfx.mjs --force    gera tudo de novo
//
// Precisa de: Python 3 e da variável de ambiente ELEVENLABS_API_KEY (a chave nunca é impressa nem gravada).
// Saída: ~/.maquina-cortes-gta/sfx/<nome>.mp3 (+ um .json com o pedido, sem chave)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gen = path.join(here, '..', '..', 'sound-effects', 'scripts', 'generate_sound.py');
const out = path.join(os.homedir(), '.maquina-cortes-gta', 'sfx');
const force = process.argv.includes('--force');

if (!process.env.ELEVENLABS_API_KEY) {
  console.error('Defina a variável de ambiente ELEVENLABS_API_KEY (sua chave da ElevenLabs) e rode de novo.');
  process.exit(1);
}
if (!fs.existsSync(gen)) {
  console.error(`Não achei o gerador em ${gen}. Instale também a pasta skills/sound-effects.`);
  process.exit(1);
}
const py = ['python3', 'python'].find((p) => spawnSync(p, ['--version']).status === 0);
if (!py) {
  console.error('Precisa do Python 3.');
  process.exit(1);
}

// 0,5 s é o mínimo do gerador. Prompts em inglês funcionam melhor.
const palette = [
  {name: 'whoosh', text: 'A fast clean cinematic whoosh swipe for a video transition, short airy swish, no voice, no music', duration: 0.5},
  {name: 'impacto', text: 'A short punchy low impact hit with a tight sub bass thump, no reverb tail, no voice, no music', duration: 0.5},
  {name: 'pop', text: 'A soft crisp interface pop, rounded bubble click, short and bright, no voice, no music', duration: 0.5},
];

fs.mkdirSync(out, {recursive: true});
let failed = 0;
for (const p of palette) {
  const file = path.join(out, `${p.name}.mp3`);
  if (fs.existsSync(file) && !force) {
    console.log(`= ${p.name} já existe`);
    continue;
  }
  const r = spawnSync(py, [gen, '--provider', 'elevenlabs', '--name', p.name, '--text', p.text, '--duration', String(p.duration), '--out', file], {stdio: 'inherit'});
  if (r.status !== 0) failed++;
}
console.log(failed ? `${failed} efeito(s) falharam.` : `Pronto: ${out}`);
process.exit(failed ? 1 : 0);
