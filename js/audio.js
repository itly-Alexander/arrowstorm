// ═══════════════════════════════════════════
//  BEAT-REACTIVE VISUALS — driven by delayed audio (what the player hears)
// ═══════════════════════════════════════════
let beatEnergy = 0;    // overall energy 0-1
let beatBass = 0;      // bass energy 0-1
let beatHigh = 0;      // high energy 0-1
let beatPulse = 0;     // decaying pulse triggered on strong beats
let beatBassHit = 0;   // fast-attack fast-decay bass — spikes on each kick
let _bassBuf = null;   // reusable buffer for bass analyser
let prevBeatEnergy = 0;

// EQ band levels for visualizer bars (0-1 each), driven by bassAnalyser (low smoothing)
const EQ_BAND_COUNT = 20;
const eqBands = new Float32Array(EQ_BAND_COUNT);     // current smoothed levels
const _eqPeaks = new Float32Array(EQ_BAND_COUNT);    // peak-hold for snappy attack

let _vizBuf = null; // reusable buffer for beat visuals

function sampleBeatVisuals() {
  if (!vizAnalyser) { beatEnergy = 0; beatBass = 0; beatHigh = 0; return; }

  if (!_vizBuf || _vizBuf.length !== vizAnalyser.frequencyBinCount) {
    _vizBuf = new Uint8Array(vizAnalyser.frequencyBinCount);
  }
  vizAnalyser.getByteFrequencyData(_vizBuf);
  const fd = _vizBuf;

  const bins = fd.length;
  // Bass: first 10% of bins, High: 30-60% of bins
  let bassSum = 0, highSum = 0, totalSum = 0;
  const bassEnd = Math.floor(bins * 0.1);
  const highStart = Math.floor(bins * 0.3);
  const highEnd = Math.floor(bins * 0.6);

  for (let i = 0; i < bins; i++) {
    totalSum += fd[i];
    if (i < bassEnd) bassSum += fd[i];
    if (i >= highStart && i < highEnd) highSum += fd[i];
  }

  beatEnergy = Math.min(1, (totalSum / bins) / 140);
  beatBass = Math.min(1, (bassSum / Math.max(1, bassEnd)) / 180);
  beatHigh = Math.min(1, (highSum / Math.max(1, highEnd - highStart)) / 150);

  // Fast bass tracker + EQ bands — read from dedicated low-smoothing analyser
  if (bassAnalyser) {
    if (!_bassBuf || _bassBuf.length !== bassAnalyser.frequencyBinCount) {
      _bassBuf = new Uint8Array(bassAnalyser.frequencyBinCount);
    }
    bassAnalyser.getByteFrequencyData(_bassBuf);
    const bBins = _bassBuf.length;

    // Bass hit tracking (first 10% of bins)
    const bassBins = Math.floor(bBins * 0.1);
    let rawSum = 0;
    for (let i = 0; i < bassBins; i++) rawSum += _bassBuf[i];
    const rawBass = Math.min(1, (rawSum / Math.max(1, bassBins)) / 110);
    if (rawBass > beatBassHit) {
      beatBassHit = rawBass;
    } else {
      beatBassHit *= 0.92;
    }

    // EQ bands — logarithmic frequency distribution across 20 bands
    // Maps bins to bands so low frequencies get more bands (perceptually correct)
    for (let b = 0; b < EQ_BAND_COUNT; b++) {
      const f0 = Math.floor(bBins * Math.pow(b / EQ_BAND_COUNT, 1.8));
      const f1 = Math.max(f0 + 1, Math.floor(bBins * Math.pow((b + 1) / EQ_BAND_COUNT, 1.8)));
      let sum = 0;
      for (let i = f0; i < f1 && i < bBins; i++) sum += _bassBuf[i];
      const level = Math.min(1, (sum / Math.max(1, f1 - f0)) / 180);
      // Instant attack, smooth decay
      if (level > _eqPeaks[b]) {
        _eqPeaks[b] = level;
      } else {
        _eqPeaks[b] *= 0.88;
      }
      // Blend peak (punchy) with current level (smooth) for best visual
      eqBands[b] = _eqPeaks[b] * 0.7 + level * 0.3;
    }
  }

  // Detect beats: sharp rise in bass energy
  const delta = beatBass - prevBeatEnergy;
  if (delta > 0.08) {
    beatPulse = Math.min(1, beatPulse + delta * 2.5);
  }
  beatPulse *= 0.88; // decay
  prevBeatEnergy = beatBass;
}

// ═══════════════════════════════════════════
//  REAL-TIME ONSET DETECTION — Percussive transients only
//  Sustained sounds (vocals, pads, strings) are filtered out.
//  Only sharp attacks (drums, plucks, hits) trigger arrows.
// ═══════════════════════════════════════════
let recentFluxes = []; // short ring buffer for transient detection
let _onsetBuf = null;  // reusable buffer for onset detection

// Precomputed dB-to-linear table: Math.pow(10, dB/20) for dB in [-128..0]
// Avoids Math.pow in the hot onset loop (~740 calls/frame)
const _dbToLin = new Float32Array(256);
for (let i = 0; i < 256; i++) _dbToLin[i] = Math.pow(10, (i - 128) / 20);

function detectOnsets() {
  if (!analyser || !audioCtx) return;

  const C = DIFF[curDiff];
  if (!_onsetBuf || _onsetBuf.length !== analyser.frequencyBinCount) {
    _onsetBuf = new Float32Array(analyser.frequencyBinCount);
  }
  analyser.getFloatFrequencyData(_onsetBuf);
  const fd = _onsetBuf;

  const now = audioCtx.currentTime - liveRecordStart - analyserLatency;
  if (now < 0) return;

  const bins = analyser.frequencyBinCount;
  const binHz = (audioCtx.sampleRate / 2) / bins;
  const subBassEnd = Math.floor(80 / binHz);
  const bassEnd = Math.floor(250 / binHz);
  const midEnd = Math.floor(3000 / binHz);
  const highEnd = Math.floor(8000 / binHz);
  const topEnd = Math.min(bins, Math.floor(16000 / binHz));

  // Spectral flux (half-wave rectified)
  let flux = 0, bassFlux = 0, midFlux = 0, highFlux = 0;
  for (let i = 0; i < topEnd; i++) {
    const dbi = (fd[i] + 128) | 0; // fd[i] is float dB in ~[-128,0], shift to [0,255]
    const lin = _dbToLin[dbi < 0 ? 0 : dbi > 255 ? 255 : dbi];
    const diff = lin - prevSpec[i];
    if (diff > 0) {
      flux += diff;
      if (i < bassEnd) bassFlux += diff;
      else if (i < midEnd) midFlux += diff;
      else if (i < highEnd) highFlux += diff;
    }
    prevSpec[i] = lin;
  }

  // === TRANSIENT vs SUSTAINED filter ===
  // Percussive hits: sharp spike that decays quickly.
  // Sustained sounds (vocals, pads): gradual flux that stays elevated.
  // Track short history (~10 frames ≈ 110ms) and require current frame
  // to be a clear spike above the recent baseline.
  recentFluxes.push(flux);
  if (recentFluxes.length > 12) recentFluxes.shift();

  let isTransient = false;
  if (recentFluxes.length >= 6) {
    const curr = flux;
    // Average of frames 3-6 before this one (skip the 2 most recent to avoid including the rise itself)
    const lookback = recentFluxes.length;
    let prevSum = 0, prevCount = 0;
    for (let i = lookback - 4; i >= Math.max(0, lookback - 8); i--) {
      prevSum += recentFluxes[i];
      prevCount++;
    }
    const prevAvg = prevCount > 0 ? prevSum / prevCount : 0;
    // Transient ratio: must exceed difficulty-specific threshold
    // Easy (3.0): only the hardest drum hits. Impossible (1.3): catches most percussive sounds.
    const transientRatio = prevAvg > 0.00005 ? curr / prevAvg : 0;
    // Strike mode: require much sharper transients — only the clearest beats
    const effTransientTh = gameMode === 'strike' ? C.transientTh * 1.5 : C.transientTh;
    isTransient = transientRatio > effTransientTh;
  }

  // Cap energy history to prevent unbounded growth
  if (liveEnergyData.length > 120) liveEnergyData.splice(0, liveEnergyData.length - 80);

  if (!isTransient) {
    liveEnergyData.push({ time: now, flux, bassFlux, midFlux, highFlux });
    runningEnergyAvg = runningEnergyAvg * 0.97 + flux * 0.03;
    return;
  }

  liveEnergyData.push({ time: now, flux, bassFlux, midFlux, highFlux });
  runningEnergyAvg = runningEnergyAvg * 0.97 + flux * 0.03;

  // Adaptive threshold from recent history
  const hist = liveEnergyData;
  const wSize = Math.min(hist.length, 60);
  const start = hist.length - wSize;
  if (wSize < 5) return;

  // === DYNAMIC MIN GAP — busier sections = denser arrows ===
  const energyRatio = runningEnergyAvg > 0.0001 ? Math.min(3, flux / runningEnergyAvg) : 1;
  // Strike mode needs much wider gaps — mouse travel between circles takes real time
  const strikeGapFloor = { easy: 0.9, normal: 0.7, hard: 0.55, extreme: 0.45, impossible: 0.35 };
  // Typing mode needs wider gaps — scanning 26 keys is harder than 4 arrow keys
  const typingGapFloor = { easy: 1.0, normal: 0.75, hard: 0.55, extreme: 0.40, impossible: 0.28 };
  const baseGap = gameMode === 'strike' ? Math.max(C.minGap, strikeGapFloor[curDiff] || 0.7)
               : gameMode === 'typing' ? Math.max(C.minGap, typingGapFloor[curDiff] || 0.50)
               : C.minGap;
  const dynamicGap = baseGap * (1 - C.energyScale * Math.min(1, (energyRatio - 1) / 2));
  const effectiveGap = Math.max(0.04, dynamicGap);

  if (now - lastOnsetTime < effectiveGap) return;

  // Check each band — bass gets priority (kick drums are the backbone)
  // Strike mode: higher sensitivity multiplier so only the strongest onsets pass
  const strikeSensMul = gameMode === 'strike' ? 1.4 : 1.0;
  const bands = [
    { key: 'bassFlux', val: bassFlux, thM: 0.75 * strikeSensMul },
    { key: 'highFlux', val: highFlux, thM: 1.0 * strikeSensMul },
    { key: 'flux', val: flux, thM: 1.1 * strikeSensMul },
  ];

  for (const band of bands) {
    let bSum = 0, bSq = 0;
    for (let i = start; i < hist.length - 1; i++) {
      bSum += hist[i][band.key];
      bSq += hist[i][band.key] * hist[i][band.key];
    }
    const bMean = bSum / (wSize - 1);
    const bStd = Math.sqrt(Math.max(0, bSq / (wSize - 1) - bMean * bMean));
    const bThresh = bMean + bStd * SENS * band.thM;

    if (band.val > bThresh && band.val > 0.0003) {
      const onsetStrength = bThresh > 0 ? band.val / bThresh : 1;
      spawnArrow(now, band.key === 'bassFlux' ? 'bass' : band.key === 'highFlux' ? 'high' : 'mid', onsetStrength);
      lastOnsetTime = now;
      break;
    }
  }
}

// ═══════════════════════════════════════════
//  AUDIO CAPTURE & CLEANUP
// ═══════════════════════════════════════════
function cleanup() {
  if (delayNode) { delayNode.disconnect(); delayNode = null; }
  if (vizAnalyser) { vizAnalyser.disconnect(); vizAnalyser = null; }
  if (bassAnalyser) { bassAnalyser.disconnect(); bassAnalyser = null; }
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close().catch(() => {});
  mediaStream = null; audioCtx = null; analyser = null;
  _onsetBuf = null; _vizBuf = null;
  if (gCanvas) gCanvas.style.cursor = '';
}

async function startLive(diff) {
  if (shouldShowTutorial()) {
    // Show tutorial first; it will call startLiveAfterTutorial when dismissed
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    showTutorial(diff);
    return;
  }
  await startLiveAfterTutorial(diff);
}

async function startLiveAfterTutorial(diff) {
  curDiff = diff;

  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 1, height: 1, frameRate: 1 },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: true
      },
      suppressLocalAudioPlayback: true
    });

    if (!mediaStream.getAudioTracks().length) {
      alert('No audio track. Make sure to check "Share tab audio".');
      mediaStream.getTracks().forEach(t => t.stop());
      return;
    }
    mediaStream.getVideoTracks().forEach(t => t.stop());

    try {
      await mediaStream.getAudioTracks()[0].applyConstraints({
        echoCancellation: false, noiseSuppression: false, autoGainControl: false
      });
    } catch(e) {}

  } catch(e) {
    alert('Screen sharing was cancelled.');
    return;
  }

  // === AUDIO CONTEXT ===
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
  const src = audioCtx.createMediaStreamSource(mediaStream);

  // === ANALYSER — real-time onset detection (NOT connected to speakers) ===
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.25;
  analyserLatency = analyser.fftSize / audioCtx.sampleRate / 2;
  src.connect(analyser);

  // === DELAY NODE — player hears audio AUDIO_DELAY seconds after capture ===
  delayNode = audioCtx.createDelay(AUDIO_DELAY + 1);
  delayNode.delayTime.value = AUDIO_DELAY;
  src.connect(delayNode);
  delayNode.connect(audioCtx.destination);

  // === VIZ ANALYSER — connected to delayed audio for beat-synced visuals ===
  vizAnalyser = audioCtx.createAnalyser();
  vizAnalyser.fftSize = 512; // small FFT = fast, we just need energy levels
  vizAnalyser.smoothingTimeConstant = 0.7; // smooth for visuals
  delayNode.connect(vizAnalyser);

  // === BASS ANALYSER — near-zero smoothing for sharp transient detection ===
  bassAnalyser = audioCtx.createAnalyser();
  bassAnalyser.fftSize = 512;
  bassAnalyser.smoothingTimeConstant = 0.05; // almost raw — preserves transients
  delayNode.connect(bassAnalyser);

  // Init state
  prevSpec = new Float32Array(analyser.frequencyBinCount);
  liveEnergyData = [];
  liveRecordStart = audioCtx.currentTime;
  lastOnsetTime = -Infinity;
  prevDir = -1; ppDir = -1;
  typingWord = ''; typingWordIdx = 0;
  typingLetters = ''; typingLettersPos = 0; typingScrollX = 0;
  noteIdCounter = 0;
  streamEnded = false;
  runningEnergyAvg = 0;
  recentFluxes = [];
  lastDirTime = [0, 0, 0, 0];
  patternType = 'random'; patternCounter = 0; patternLen = 0; patternData = null;

  // Setup game
  gNotes = [];
  gScore = 0; gCombo = 0; gMaxCombo = 0;
  gJdg = {perfect:0,great:0,good:0,miss:0};
  rFlash = {left:0,down:0,up:0,right:0};
  jTimer = 0;
  particles = []; perfectRings = []; perfectCount = 0;

  // Strike mode state
  sCursorX = 0; sCursorY = 0;
  sLastX = innerWidth / 2; sLastY = innerHeight / 2;

  document.getElementById('menu').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  document.getElementById('hsong').textContent = DIFF[diff].label;
  musicDetected = false;

  // Show waiting overlay
  const waitEl = document.getElementById('waiting');
  waitEl.classList.remove('hidden');

  gCanvas = document.getElementById('gc');
  gCtx = gCanvas.getContext('2d');
  resizeC();

  // Hide system cursor in strike mode (custom cursor drawn on canvas)
  gCanvas.style.cursor = gameMode === 'strike' ? 'none' : '';

  // Move HUD to bottom in typing mode so word display has room at top
  document.querySelector('.hud').classList.toggle('hud-bottom', gameMode === 'typing');

  cacheHudElements();
  gActive = true;
  gStart = performance.now();
  gRAF = requestAnimationFrame(gameLoop);

  // When sharing stops, wait for delay buffer to drain then show results
  mediaStream.getAudioTracks()[0].onended = () => {
    streamEnded = true;
    // Wait for the AUDIO_DELAY buffer to finish playing + time for last arrows
    setTimeout(() => {
      gActive = false;
      showResults();
    }, (AUDIO_DELAY + 2) * 1000);
  };
}
