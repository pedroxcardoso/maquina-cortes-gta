#!/usr/bin/env node
// Instala (e confere) tudo que a skill maquina-cortes-gta precisa. Pode rodar quantas vezes quiser.
//
//   node setup.mjs                      instala o motor (Remotion) e o whisper.cpp se faltarem
//   node setup.mjs --check              só confere e imprime um JSON com o estado
//   node setup.mjs --profile "NOME" --logo "C:\caminho\logo.png"
//                                       grava o nome do perfil e a logo (primeira vez)
//
// Tudo fica em ~/.maquina-cortes-gta (motor, whisper, config, logo). Nada é instalado fora dessa pasta,
// a não ser o que você já tem (Node, ffmpeg, yt-dlp), que o script só confere.
import {execFileSync, execSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HOME = path.join(os.homedir(), '.maquina-cortes-gta');
const ENGINE = path.join(HOME, 'engine');
const WHISPER = path.join(HOME, 'whisper.cpp');
const CONFIG = path.join(HOME, 'config.json');
const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template');
const WHISPER_VERSION = '1.5.5';

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (n) => args.includes(n);

const readConfig = () => {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch {
    return {};
  }
};
const writeConfig = (c) => {
  fs.mkdirSync(HOME, {recursive: true});
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2));
};
const which = (bin) => {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], {encoding: 'utf8'});
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
};
const nodeMajor = Number(process.versions.node.split('.')[0]);

function status() {
  const c = readConfig();
  const model = c.whisperModel || 'small';
  return {
    node: process.versions.node,
    nodeOk: nodeMajor >= 18,
    ffmpeg: !!which('ffmpeg'),
    ffprobe: !!which('ffprobe'),
    ytdlp: !!which('yt-dlp'),
    // efeitos sonoros (opcional): Python + chave da ElevenLabs; imagens do Google (opcional): chave e id da API
    python: !!(which('python3') || which('python')),
    elevenlabsKey: !!process.env.ELEVENLABS_API_KEY,
    googleImagens: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
    efeitosGerados: fs.existsSync(path.join(HOME, 'sfx')) ? fs.readdirSync(path.join(HOME, 'sfx')).filter((f) => /\.(mp3|wav)$/.test(f)).length : 0,
    engine: fs.existsSync(path.join(ENGINE, 'node_modules', 'remotion')),
    whisperModel: fs.existsSync(path.join(WHISPER, `ggml-${model}.bin`)),
    perfilConfigurado: !!(c.profileName && c.logo && fs.existsSync(path.join(HOME, c.logo))),
    config: c,
    pasta: HOME,
  };
}

// 1) perfil e logo
if (flag('--profile') || flag('--logo')) {
  const c = readConfig();
  if (flag('--profile')) c.profileName = flag('--profile');
  if (flag('--logo')) {
    const src = flag('--logo');
    if (!fs.existsSync(src)) {
      console.error(`Logo não encontrada: ${src}`);
      process.exit(1);
    }
    const ext = path.extname(src).toLowerCase() || '.png';
    fs.mkdirSync(HOME, {recursive: true});
    fs.copyFileSync(src, path.join(HOME, `logo${ext}`));
    c.logo = `logo${ext}`;
  }
  writeConfig(c);
  console.log(JSON.stringify({ok: true, perfil: c.profileName, logo: c.logo}));
  process.exit(0);
}

// 2) só conferir
if (has('--check')) {
  console.log(JSON.stringify(status(), null, 2));
  process.exit(0);
}

// 3) instalar
const s0 = status();
if (!s0.nodeOk) {
  console.error('Precisa do Node 18 ou mais novo (recomendado 22+): https://nodejs.org');
  process.exit(1);
}
if (!s0.ffmpeg || !s0.ffprobe) {
  console.error('Precisa do FFmpeg (ffmpeg e ffprobe no PATH). Windows: winget install Gyan.FFmpeg · macOS: brew install ffmpeg · Linux: apt install ffmpeg');
  process.exit(1);
}
if (!s0.ytdlp) {
  console.warn('Aviso: yt-dlp não encontrado. Sem ele a skill só aceita arquivo de vídeo, não link. Windows: winget install yt-dlp · macOS: brew install yt-dlp · Linux: pipx install yt-dlp');
}

fs.mkdirSync(HOME, {recursive: true});
const cfg = readConfig();
cfg.whisperModel = cfg.whisperModel || 'small';
cfg.language = cfg.language || 'pt';
writeConfig(cfg);

// motor (Remotion): copia o template e instala as dependências
if (!s0.engine) {
  console.log('> Copiando o motor para', ENGINE);
  fs.cpSync(TEMPLATE, ENGINE, {recursive: true});
  console.log('> npm install (Remotion e dependências; leva alguns minutos)');
  execSync('npm install --no-audit --no-fund', {cwd: ENGINE, stdio: 'inherit'});
  console.log('> Baixando o Chrome headless do Remotion');
  try {
    execSync('npx remotion browser ensure', {cwd: ENGINE, stdio: 'inherit'});
  } catch {
    console.warn('Não consegui pré-baixar o Chrome; o Remotion tenta de novo no primeiro render.');
  }
} else {
  // mantém scripts e componentes atualizados sem mexer em node_modules
  for (const d of ['src', 'scripts']) {
    fs.cpSync(path.join(TEMPLATE, d), path.join(ENGINE, d), {recursive: true});
  }
}

// whisper.cpp + modelo
if (!status().whisperModel) {
  console.log(`> Instalando whisper.cpp ${WHISPER_VERSION} e o modelo "${cfg.whisperModel}" (download grande)`);
  const code = `
    import {installWhisperCpp, downloadWhisperModel} from '@remotion/install-whisper-cpp';
    await installWhisperCpp({to: ${JSON.stringify(WHISPER)}, version: ${JSON.stringify(WHISPER_VERSION)}});
    await downloadWhisperModel({model: ${JSON.stringify(cfg.whisperModel)}, folder: ${JSON.stringify(WHISPER)}});
  `;
  fs.writeFileSync(path.join(ENGINE, 'scripts', '_install-whisper.mjs'), code);
  execFileSync(process.execPath, [path.join(ENGINE, 'scripts', '_install-whisper.mjs')], {cwd: ENGINE, stdio: 'inherit'});
}

console.log(JSON.stringify(status(), null, 2));
console.log('\nPronto. Falta só o perfil (nome + logo) se ainda não foi configurado.');
