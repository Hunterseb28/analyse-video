const video = document.getElementById('video');
const videoUrl = document.getElementById('videoUrl');
const loadButton = document.getElementById('loadButton');
const status = document.getElementById('status');
const canvas = document.getElementById('audioGraph');
const ctx = canvas.getContext('2d');
const playhead = document.getElementById('playhead');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const peakCount = document.getElementById('peakCount');
const events = document.getElementById('events');

let audioContext;
let analyser;
let source;
let data;
let animationFrame;
let peaks = [];
let lastPeakTime = -Infinity;
let lastPeakLevel = 0;
let audioReady = false;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.style.color = error ? '#ff7b91' : '';
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setupAudio() {
  if (audioReady) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;
  data = new Uint8Array(analyser.fftSize);

  source = audioContext.createMediaElementSource(video);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  audioReady = true;
}

function drawGraph(level = 0) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  if (!analyser || !data) {
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.strokeStyle = 'rgba(150,160,190,.25)';
    ctx.stroke();
    return;
  }

  analyser.getByteTimeDomainData(data);
  const step = Math.max(1, Math.floor(data.length / width));
  const center = height / 2;
  const amplitude = Math.max(8, (height / 2 - 12) * (0.15 + level * 1.15));

  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const index = Math.min(data.length - 1, x * step);
    const normalized = (data[index] - 128) / 128;
    const y = center + normalized * amplitude;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#7d86ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Current intensity marker.
  const barHeight = level * (height - 24);
  ctx.fillStyle = 'rgba(125,134,255,.12)';
  ctx.fillRect(0, height - 12 - barHeight, width, barHeight);

  for (const peak of peaks) {
    if (!video.duration) continue;
    const x = (peak.time / video.duration) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.strokeStyle = 'rgba(255, 105, 130, .7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function detectPeak(level) {
  const now = video.currentTime;
  const threshold = 0.62;
  const cooldown = 0.28;

  if (level > threshold && level > lastPeakLevel && now - lastPeakTime > cooldown) {
    lastPeakTime = now;
    lastPeakLevel = level;
    peaks.push({ time: now, level });
    renderEvents();
    peakCount.textContent = `${peaks.length} pic${peaks.length > 1 ? 's' : ''}`;
  }

  lastPeakLevel *= 0.96;
}

function renderEvents() {
  if (!peaks.length) {
    events.className = 'events-empty';
    events.textContent = 'Les événements apparaîtront pendant la lecture.';
    return;
  }

  events.className = '';
  events.innerHTML = peaks.slice(-12).reverse().map((peak, index) => `
    <div class="event">
      <strong>🔊 Pic sonore ${peaks.length - index}</strong>
      <span>${formatTime(peak.time)} · ${Math.round(peak.level * 100)}%</span>
    </div>
  `).join('');
}

function animationLoop() {
  if (analyser) {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const value = (data[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / data.length);
    const level = Math.min(1, rms * 3.2);
    detectPeak(level);
    drawGraph(level);
  } else {
    drawGraph();
  }

  if (video.duration) {
    playhead.style.left = `${(video.currentTime / video.duration) * 100}%`;
  }
  currentTime.textContent = formatTime(video.currentTime);
  duration.textContent = formatTime(video.duration);
  animationFrame = requestAnimationFrame(animationLoop);
}

async function loadVideo() {
  const url = videoUrl.value.trim();
  if (!url) {
    setStatus('Colle une URL de vidéo.', true);
    return;
  }

  try {
    if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
    setupAudio();
    video.src = url;
    video.load();
    peaks = [];
    lastPeakTime = -Infinity;
    lastPeakLevel = 0;
    peakCount.textContent = '0 pics';
    renderEvents();
    setStatus('Vidéo chargée. Lance la lecture pour analyser le son.');
    cancelAnimationFrame(animationFrame);
    animationLoop();
  } catch (error) {
    console.error(error);
    setStatus('Impossible d’analyser cette vidéo. Vérifie notamment les permissions CORS.', true);
  }
}

loadButton.addEventListener('click', loadVideo);
video.addEventListener('play', async () => {
  try {
    setupAudio();
    if (audioContext.state === 'suspended') await audioContext.resume();
  } catch (error) {
    console.error(error);
  }
});
video.addEventListener('loadedmetadata', () => {
  duration.textContent = formatTime(video.duration);
  resizeCanvas();
});
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
drawGraph();
