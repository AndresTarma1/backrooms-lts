const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let isAudioUnlocked = false;
const buffers = {};
let ambientSource = null;
let ambientGain = null;

async function loadBuffer(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return audioCtx.decodeAudioData(arrayBuffer);
}

function playBuffer(name, volume = 0.5) {
  if (!isAudioUnlocked || !buffers[name]) return;
  const source = audioCtx.createBufferSource();
  source.buffer = buffers[name];
  const gain = audioCtx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

export async function initAudio() {
  const [f1, f2, hurt, death, amb1, amb4] = await Promise.all([
    loadBuffer('/src/assets/sounds/footstep_01.wav'),
    loadBuffer('/src/assets/sounds/footstep_02.wav'),
    loadBuffer('/src/assets/sounds/player_hurt.wav'),
    loadBuffer('/src/assets/sounds/player_death.wav'),
    loadBuffer('/src/assets/sounds/amb_level1.wav'),
    loadBuffer('/src/assets/sounds/amb_level4.wav'),
  ]);
  buffers.walkStep = f1;
  buffers.runStep = f2;
  buffers.hurt = hurt;
  buffers.death = death;
  buffers.amb1 = amb1;
  buffers.amb4 = amb4;
}

function unlockAudio() {
  if (isAudioUnlocked) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isAudioUnlocked = true;
}

document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

export function playFootstep(isRunning) {
  if (!isAudioUnlocked) return;
  const buf = isRunning ? buffers.runStep : buffers.walkStep;
  if (!buf) return;
  const source = audioCtx.createBufferSource();
  source.buffer = buf;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.35;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(0, 0, 0.15);
}

export function playHurt() {
  playBuffer('hurt', 0.6);
}

export function playDeath() {
  playBuffer('death', 0.7);
}

export function resumeAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isAudioUnlocked = true;
}

export function startAmbient(levelNum) {
  stopAmbient();
  if (!isAudioUnlocked) return;
  const buf = (levelNum === 1 || levelNum === 2) ? buffers.amb1
             : (levelNum === 3 || levelNum === 4) ? buffers.amb4
             : null;
  if (!buf) return;
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0.3;
  ambientGain.connect(audioCtx.destination);
  ambientSource = audioCtx.createBufferSource();
  ambientSource.buffer = buf;
  ambientSource.loop = true;
  ambientSource.connect(ambientGain);
  ambientSource.start();
}

export function stopAmbient() {
  if (ambientSource) {
    try { ambientSource.stop(); } catch (e) {}
    ambientSource.disconnect();
    ambientSource = null;
  }
  if (ambientGain) {
    ambientGain.disconnect();
    ambientGain = null;
  }
}
