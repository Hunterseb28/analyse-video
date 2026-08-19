(() => {
  if (window.top !== window || document.getElementById('av-audio-overlay')) return;

  let audioContext = null;
  let analyser = null;
  let source = null;
  let connectedVideo = null;
  let data = null;
  let running = false;
  let raf = 0;
  let peaks = [];
  let lastPeak = -Infinity;

  const overlay = document.createElement('section');
  overlay.id = 'av-audio-overlay';
  overlay.innerHTML = `
    <div class="av-head">
      <div>
        <span class="av-kicker">ANALYSE VIDEO</span>
        <strong>Audio en direct</strong>
      </div>
      <button id="av-close" type="button" aria-label="Fermer">×</button>
    </div>
    <div class="av-status" id="av-status">Prêt — lance la vidéo puis appuie sur Analyser.</div>
    <div class="av-chart-wrap">
      <canvas id="av-chart"></canvas>
      <div id="av-playhead"></div>
    </div>
    <div class="av-controls">
      <button id="av-analyze" type="button">🎧 Analyser</button>
      <span id="av-level">0%</span>
      <span id="av-peaks">0 pics</span>
    </div>
  `;
  document.documentElement.appendChild(overlay);

  const canvas = overlay.querySelector('#av-chart');
  const ctx = canvas.getContext('2d');
  const status = overlay.querySelector('#av-status');
  const levelText = overlay.querySelector('#av-level');
  const peaksText = overlay.querySelector('#av-peaks');
  const playhead = overlay.querySelector('#av-playhead');
  const analyzeButton = overlay.querySelector('#av-analyze');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function findVideo() {
    const videos = [...document.querySelectorAll('video')];
    return videos
      .filter(v => v.readyState >= 1 && v.clientWidth > 0 && v.clientHeight > 0)
      .sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0] || videos[0] || null;
  }

  async function connect() {
    const video = findVideo();
    if (!video) {
      status.textContent = 'Aucune vidéo HTML5 détectée sur cette page.';
      return false;
    }

    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') await audioContext.resume();

      if (connectedVideo !== video) {
        if (source) {
          try { source.disconnect(); } catch (_) {}
        }
        source = audioContext.createMediaElementSource(video);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.7;
        data = new Uint8Array(analyser.fftSize);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        connectedVideo = video;
      }

      status.textContent = 'Analyse active — le graphique suit le son de la vidéo.';
      return true;
    } catch (error) {
      console.error('[Analyse Video]', error);
      status.textContent = 'Audio inaccessible depuis cette vidéo (CORS/HLS ou restriction du lecteur).';
      return false;
    }
  }

  function draw(level) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += h / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (!analyser || !data) return;
    analyser.getByteTimeDomainData(data);
    const step = Math.max(1, Math.floor(data.length / Math.max(1, w)));
    const center = h / 2;
    const amp = Math.max(6, (h / 2 - 8) * (0.12 + level * 1.2));

    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const n = (data[Math.min(data.length - 1, x * step)] - 128) / 128;
      const y = center + n * amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#8c94ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function loop() {
    if (!running) return;
    const video = connectedVideo;
    if (analyser && data && video) {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const n = (value - 128) / 128;
        sum += n * n;
      }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
      levelText.textContent = `${Math.round(level * 100)}%`;
      draw(level);

      if (level > 0.62 && video.currentTime - lastPeak > 0.28) {
        lastPeak = video.currentTime;
        peaks.push(video.currentTime);
        if (peaks.length > 100) peaks.shift();
        peaksText.textContent = `${peaks.length} pic${peaks.length > 1 ? 's' : ''}`;
      }

      if (video.duration) {
        playhead.style.left = `${(video.currentTime / video.duration) * 100}%`;
      }
    }
    raf = requestAnimationFrame(loop);
  }

  analyzeButton.addEventListener('click', async () => {
    const ok = await connect();
    if (!ok) return;
    running = !running;
    analyzeButton.textContent = running ? '⏸ Pause' : '🎧 Analyser';
    if (running) {
      cancelAnimationFrame(raf);
      loop();
    }
  });

  overlay.querySelector('#av-close').addEventListener('click', () => {
    running = false;
    cancelAnimationFrame(raf);
    overlay.remove();
  });

  window.addEventListener('resize', resize);
  resize();
})();
