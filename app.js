const video = document.querySelector('#video');
const urlInput = document.querySelector('#videoUrl');
const loadButton = document.querySelector('#loadButton');
const status = document.querySelector('#status');
const canvas = document.querySelector('#audioGraph');
const ctx = canvas.getContext('2d');
const peakCount = document.querySelector('#peakCount');

let audioContext;
let analyser;
let source;
let data;
let peaks = [];
let animationFrame;
let lastPeakAt = -Infinity;

function setStatus(message) {
  status.textContent = message;
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setupAudio() {
  if (audioContext) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;
  data = new Uint8Array(analyser.fftSize);

  source = audioContext.createMediaElementSource(video);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
}

function drawGraph() {
  if (!analyser) return;

  analyser.getByteTimeDomainData(data);

  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const center = height / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#090b12';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#202435';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, center);
  ctx.lineTo(width, center);
  ctx.stroke();

  ctx.strokeStyle = '#7c86ff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const step = Math.max(1, Math.floor(data.length / width));
  let sum = 0;
  let max = 0;

  for (let x = 0; x < width; x++) {
    const index = Math.min(data.length - 1, x * step);
    const normalized = (data[index] - 128) / 128;
    const amplitude = Math.abs(normalized);
    sum += amplitude;
    max = Math.max(max, amplitude);
    const y = center + normalized * center * 0.82;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const rms = sum / width;
  const now = video.currentTime;
  if (max > 0.62 && now - lastPeakAt > 0.18) {
    peaks.push({ time: now, value: max });
    lastPeakAt = now;
    peakCount.textContent = `${peaks.length} pic${peaks.length > 1 ? 's' : ''}`;
  }

  drawPeaks(width, height);
  animationFrame = requestAnimationFrame(drawGraph);
}

function drawPeaks(width, height) {
  if (!video.duration) return;

  ctx.fillStyle = '#ff687d';
  for (const peak of peaks) {
    const x = (peak.time / video.duration) * width;
    ctx.beginPath();
    ctx.arc(x, height - 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

loadButton.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus('Entre une URL vidéo.');
    return;
  }

  peaks = [];
  lastPeakAt = -Infinity;
  peakCount.textContent = '0 pics';
  video.src = url;
  video.load();
  setStatus('Vidéo chargée. Lance la lecture pour commencer l’analyse audio.');
});

video.addEventListener('play', async () => {
  try {
    setupAudio();
    await audioContext.resume();
    cancelAnimationFrame(animationFrame);
    drawGraph();
    setStatus('Analyse audio en cours…');
  } catch (error) {
    console.error(error);
    setStatus('Impossible d’analyser cet audio. Vérifie notamment les règles CORS de l’URL vidéo.');
  }
});

video.addEventListener('pause', () => {
  cancelAnimationFrame(animationFrame);
  setStatus('Analyse en pause.');
});

video.addEventListener('ended', () => {
  cancelAnimationFrame(animationFrame);
  setStatus(`Analyse terminée : ${peaks.length} pic${peaks.length > 1 ? 's' : ''} détecté${peaks.length > 1 ? 's' : ''}.`);
});

video.addEventListener('error', () => {
  setStatus('La vidéo n’a pas pu être chargée. Pour cette V1, utilise une URL directe vers un fichier vidéo accessible par le navigateur (ex. .mp4).');
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
