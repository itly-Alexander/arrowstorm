// ═══════════════════════════════════════════
//  GAME LOOP & RENDERING
// ═══════════════════════════════════════════
const STRIKE_R = 38;         // hit circle radius
const STRIKE_AR = 2.0;       // approach rate (ring shrink speed per second)
const STRIKE_VISIBLE = 1.8;  // seconds before hit time circles appear

// Cached DOM elements — avoid getElementById in hot loop
let _hudScore, _hudCombo, _hudAcc, _hudJdg, _hudComboWrap;
function cacheHudElements() {
  _hudScore = document.getElementById('hs');
  _hudCombo = document.getElementById('hc');
  _hudAcc = document.getElementById('ha');
  _hudJdg = document.getElementById('jdg');
  _hudComboWrap = _hudCombo;
}

function getElapsed() {
  if (!audioCtx) return 0;
  return audioCtx.currentTime - liveRecordStart;
}

function gameLoop() {
  if (!gActive) return;
  gRAF = requestAnimationFrame(gameLoop);

  detectOnsets();
  sampleBeatVisuals();

  // Prune old processed notes to prevent array growth
  if (gNotes.length > 200) {
    let firstActive = 0;
    while (firstActive < gNotes.length && (gNotes[firstActive].hit || gNotes[firstActive].missed)) firstActive++;
    if (firstActive > 50) gNotes.splice(0, firstActive);
  }

  // Detect when music actually starts playing — hide waiting overlay
  if (!musicDetected && liveEnergyData.length > 10) {
    let fluxSum = 0;
    const len = liveEnergyData.length;
    for (let i = len - 5; i < len; i++) fluxSum += liveEnergyData[i].flux;
    if (fluxSum / 5 > 0.005) {
      musicDetected = true;
      document.getElementById('waiting').classList.add('hidden');
    }
  }

  const elapsed = getElapsed();
  const W = innerWidth, H = innerHeight, ctx = gCtx;
  ctx.clearRect(0, 0, W, H);

  // ── SHARED BEAT-REACTIVE BACKGROUND ──
  const theme = getBgTheme();
  const bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0, `rgba(${theme.base[0]},${theme.base[1]},${Math.floor(theme.base[2] + beatBass * theme.bassShift[2])},1)`);
  bg.addColorStop(.5, `rgba(${Math.floor(theme.mid[0] + beatPulse * theme.pulseShift[0])},${Math.floor(theme.mid[1] + beatPulse * theme.pulseShift[1])},${Math.floor(theme.mid[2] + beatHigh * theme.highShift[2])},1)`);
  bg.addColorStop(1, `rgba(${theme.base[0]},${theme.base[1]},${Math.floor(theme.base[2] + beatBass * theme.midShift[2])},1)`);
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Scan lines — use cached pattern instead of per-line draws
  if (!gameLoop._scanPattern || gameLoop._scanH !== H) {
    const scanCvs = document.createElement('canvas');
    scanCvs.width = 1; scanCvs.height = H;
    const sCtx = scanCvs.getContext('2d');
    sCtx.fillStyle = 'rgba(255,255,255,.008)';
    for (let sy = 0; sy < H; sy += 4) sCtx.fillRect(0, sy, 1, 1);
    gameLoop._scanPattern = ctx.createPattern(scanCvs, 'repeat');
    gameLoop._scanH = H;
  }
  ctx.fillStyle = gameLoop._scanPattern;
  ctx.fillRect(0, 0, W, H);

  // Bass pulse glow
  if (beatPulse > 0.05) {
    const cx = W/2, cy = H * 0.5;
    const pulseR = 100 + beatPulse * 300;
    const pulseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
    pulseGrad.addColorStop(0, `rgba(255,45,85,${beatPulse * 0.08})`);
    pulseGrad.addColorStop(0.5, `rgba(0,229,255,${beatPulse * 0.04})`);
    pulseGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = pulseGrad;
    ctx.fillRect(cx - pulseR, cy - pulseR, pulseR*2, pulseR*2);
  }

  // Side edge glows
  if (beatBass > 0.2) {
    const edgeGrad = ctx.createLinearGradient(0,0,80,0);
    edgeGrad.addColorStop(0, `rgba(255,45,85,${beatBass * 0.12})`);
    edgeGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0,0,80,H);
  }
  if (beatHigh > 0.2) {
    const edgeGrad = ctx.createLinearGradient(W,0,W-80,0);
    edgeGrad.addColorStop(0, `rgba(0,229,255,${beatHigh * 0.1})`);
    edgeGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(W-80,0,80,H);
  }

  // ── MODE-SPECIFIC RENDERING ──
  if (gameMode === 'strike') {
    renderStrike(ctx, elapsed, W, H);
  } else if (gameMode === 'typing') {
    // Lane area (typing — single centered column)
    const lw = TYPING_CW + 40, lx = (W - lw) / 2;
    const lg = ctx.createLinearGradient(lx, 0, lx + lw, 0);
    const laneAlpha = 0.02 + beatEnergy * 0.02;
    lg.addColorStop(0, 'transparent');
    lg.addColorStop(.1, `rgba(255,255,255,${laneAlpha})`);
    lg.addColorStop(.9, `rgba(255,255,255,${laneAlpha})`);
    lg.addColorStop(1, 'transparent');
    ctx.fillStyle = lg; ctx.fillRect(lx, 0, lw, H);

    if (gCombo > 10) {
      ctx.fillStyle = `rgba(118,255,3,${Math.min(.15, gCombo / 500)})`;
      ctx.fillRect(lx, 0, lw, H);
    }

    renderTyping(ctx, elapsed, W, H, lx, lw);
  } else {
    // Lane area (classic only)
    const lw = CW*4+40, lx = (W-lw)/2;
    const lg = ctx.createLinearGradient(lx,0,lx+lw,0);
    const laneAlpha = 0.02 + beatEnergy * 0.02;
    lg.addColorStop(0,'transparent');
    lg.addColorStop(.1,`rgba(255,255,255,${laneAlpha})`);
    lg.addColorStop(.9,`rgba(255,255,255,${laneAlpha})`);
    lg.addColorStop(1,'transparent');
    ctx.fillStyle = lg; ctx.fillRect(lx,0,lw,H);

    // Combo glow (classic)
    if (gCombo > 10) {
      ctx.fillStyle = `rgba(118,255,3,${Math.min(.15, gCombo/500)})`;
      ctx.fillRect(lx,0,lw,H);
    }

    const sx = (W - CW*4) / 2;
    renderClassic(ctx, elapsed, W, H, sx, lx, lw);
  }

  // ── SHARED HUD ──
  _hudScore.textContent = gScore.toLocaleString();
  _hudCombo.textContent = `${gCombo}x COMBO`;
  _hudCombo.className = gCombo >= 50 ? 'big' : '';
  const tj = gJdg.perfect + gJdg.great + gJdg.good + gJdg.miss;
  _hudAcc.textContent =
    (tj > 0 ? ((gJdg.perfect*100 + gJdg.great*70 + gJdg.good*40) / (tj*100) * 100) : 100).toFixed(1) + '%';

  // Particles and effects
  updateAndDrawParticles(ctx);

  // Judgment fade
  if (jTimer > 0) {
    jTimer -= 16;
    _hudJdg.style.opacity = Math.min(1, jTimer / 200);
    _hudJdg.style.transform = `translate(-50%,-50%) scale(${1 + (1 - jTimer/500) * .3})`;
  }

  // Pulse combo text glow with beat
  if (gCombo > 0) {
    _hudCombo.style.textShadow = `0 0 ${8 + beatPulse * 20}px currentColor`;
  }
}

// ═══════════════════════════════════════════
//  CLASSIC MODE RENDERING
// ═══════════════════════════════════════════
function renderClassic(ctx, elapsed, W, H, sx, lx, lw) {
  // Receptor line
  const receptorAlpha = 0.15 + beatPulse * 0.4;
  const receptorWidth = 1 + beatPulse * 2;
  ctx.strokeStyle = `rgba(255,255,255,${receptorAlpha})`;
  ctx.lineWidth = receptorWidth;
  ctx.beginPath(); ctx.moveTo(lx,RY); ctx.lineTo(lx+lw,RY); ctx.stroke();

  // Receptors
  for (let i = 0; i < 4; i++) {
    const x = sx + i*CW + CW/2, dir = DIRS[i], col = ACOL[dir], fl = rFlash[dir];
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    if (fl > 0) {
      ctx.save(); ctx.globalAlpha = fl*.5; ctx.shadowBlur = 30; ctx.shadowColor = col.g;
      ctx.fillStyle = col.m; ctx.beginPath(); ctx.arc(x,RY,NS/2+5,0,Math.PI*2); ctx.fill();
      ctx.restore(); rFlash[dir] = Math.max(0, fl - .05);
    }
    drawArr(ctx, x, RY, dir, NS, col.m, .4 + fl*.6, true);
  }

  // Chord connection bars
  const chordGroups = {};
  for (const n of gNotes) {
    if (n.hit || n.missed || n.chordId === undefined) continue;
    const td = n.time - elapsed;
    const y = RY + td * NSPD;
    if (y < -NS || y > H + NS) continue;
    if (!chordGroups[n.chordId]) chordGroups[n.chordId] = [];
    chordGroups[n.chordId].push(n);
  }
  for (const cid in chordGroups) {
    const group = chordGroups[cid];
    if (group.length < 2) continue;
    const td = group[0].time - elapsed;
    const y = RY + td * NSPD;
    const dirs = group.map(n => n.dir).sort((a, b) => a - b);
    const x1 = sx + dirs[0] * CW + CW/2;
    const x2 = sx + dirs[dirs.length - 1] * CW + CW/2;
    const alpha = y < RY ? Math.max(.1, .6 - (RY - y) / 300) : 0.6;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.restore();
  }

  // Note arrows
  for (const n of gNotes) {
    if (n.hit || n.missed) continue;
    const td = n.time - elapsed;
    const y = RY + td * NSPD;
    n.y = y;
    if (y < -NS || y > H + NS) continue;
    if (td < -JDG.miss.w / 1000) {
      n.missed = true; gCombo = 0; gJdg.miss++; showJ('miss'); continue;
    }
    const x = sx + n.dir * CW + CW/2;
    const alpha = y < RY ? Math.max(.2, 1 - (RY - y) / 200) : 1;
    drawArr(ctx, x, y, DIRS[n.dir], NS, ACOL[DIRS[n.dir]].m, alpha, false);
  }
}

// ═══════════════════════════════════════════
//  STRIKE MODE RENDERING
// ═══════════════════════════════════════════
function renderStrike(ctx, elapsed, W, H) {
  // Combo glow (full screen)
  if (gCombo > 10) {
    ctx.fillStyle = `rgba(118,255,3,${Math.min(.1, gCombo/600)})`;
    ctx.fillRect(0,0,W,H);
  }

  // Process and draw circles
  let circleNum = 1;
  for (const n of gNotes) {
    if (n.hit || n.missed) continue;
    const td = n.time - elapsed;

    // Auto-miss: time expired
    if (td < -JDG.miss.w / 1000) {
      n.missed = true;
      gCombo = 0;
      gJdg.miss++;
      showJ('miss');
      // Miss flash at circle position
      spawnPerfectEffect(n.cx, n.cy, '#ff2d55', false);
      continue;
    }

    // Only draw if within visible window
    if (td > STRIKE_VISIBLE) continue;

    drawStrikeCircle(ctx, n.cx, n.cy, n.dir, td, circleNum);
    circleNum++;
  }

  // Cursor
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(255,255,255,.6)';
  // Outer ring
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sCursorX, sCursorY, 10, 0, Math.PI * 2);
  ctx.stroke();
  // Center dot
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(sCursorX, sCursorY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStrikeCircle(ctx, x, y, dirIdx, td, num) {
  const col = ACOL[DIRS[dirIdx]];
  const r = STRIKE_R;

  // Fade in over first 0.2s of visibility
  const fadeIn = td > STRIKE_VISIBLE - 0.2 ? (STRIKE_VISIBLE - td) / 0.2 : 1;
  const alpha = Math.max(0, Math.min(1, fadeIn));

  // Approach circle (shrinks toward hit circle)
  if (td > 0) {
    const ar = r * (1 + td * STRIKE_AR);
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = col.m;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, ar, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Hit circle — filled background
  ctx.save();
  ctx.globalAlpha = alpha * 0.25;
  ctx.fillStyle = col.m;
  ctx.shadowBlur = 15 + beatPulse * 10;
  ctx.shadowColor = col.m;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Circle border
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.strokeStyle = col.m;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 12;
  ctx.shadowColor = col.m;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // White inner ring
  ctx.save();
  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Number
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = '#fff';
  ctx.font = "bold 16px 'Orbitron',sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, x, y);
  ctx.restore();
}

// ═══════════════════════════════════════════
//  TYPING MODE RENDERING
// ═══════════════════════════════════════════
function renderTyping(ctx, elapsed, W, H, lx, lw) {
  const cx = W / 2;

  // ── SCROLLING LETTER QUEUE across the top ──
  if (typingLetters.length > 0) {
    ctx.save();
    const fontSize = 52;
    ctx.font = `bold ${fontSize}px 'Orbitron',sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const queueY = 50;

    // Measure a reference character for spacing
    const charW = ctx.measureText('W').width;

    // Ensure enough letters to fill the right side of screen
    const charsNeeded = Math.ceil(W / charW) + 2;
    while (typingLetters.length - typingLettersPos < charsNeeded) {
      let word;
      let attempts = 0;
      const last = typingLetters.length > 0 ? typingLetters.slice(-6) : '';
      do {
        word = TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)];
        attempts++;
      } while (word === last && attempts < 10);
      typingLetters += word;
    }

    // Current letter anchored at center of screen
    const anchorX = W / 2;
    const targetScrollX = typingLettersPos * charW;

    // Smooth scroll toward target
    typingScrollX += (targetScrollX - typingScrollX) * 0.18;

    // Draw letters across full screen width
    const startIdx = Math.max(0, Math.floor((typingScrollX - anchorX) / charW) - 1);
    const endIdx = Math.min(typingLetters.length, Math.ceil((typingScrollX - anchorX + W) / charW) + 1);

    for (let i = startIdx; i < endIdx; i++) {
      const drawX = anchorX + (i * charW - typingScrollX);
      if (drawX < -charW || drawX > W + charW) continue;

      const ch = typingLetters[i];
      // Distance from center for fade
      const distFromCenter = Math.abs(drawX - anchorX);
      const edgeFade = Math.max(0, 1 - distFromCenter / (W / 2));

      if (i < typingLettersPos) {
        // Typed — dim, fading toward left edge
        ctx.globalAlpha = edgeFade * 0.15;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.6)';
      } else if (i === typingLettersPos) {
        // Current — bright white, pulsing
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 22 + beatPulse * 14;
        ctx.shadowColor = '#fff';
        ctx.fillStyle = '#fff';
      } else {
        // Upcoming — dim, fading toward right edge
        ctx.globalAlpha = edgeFade * 0.25;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
      }
      ctx.fillText(ch, drawX, queueY);
    }
    ctx.restore();
  }

  // ── Receptor line ──
  const receptorAlpha = 0.15 + beatPulse * 0.4;
  const receptorWidth = 1 + beatPulse * 2;
  ctx.strokeStyle = `rgba(255,255,255,${receptorAlpha})`;
  ctx.lineWidth = receptorWidth;
  ctx.beginPath(); ctx.moveTo(lx, RY); ctx.lineTo(lx + lw, RY); ctx.stroke();

  // Receptor flash
  const rfl = rFlash.left;
  if (rfl > 0) {
    ctx.save();
    ctx.globalAlpha = rfl * 0.3;
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(255,255,255,.6)';
    ctx.fillRect(lx, RY - 4, lw, 8);
    ctx.restore();
    rFlash.left = Math.max(0, rfl - 0.05);
  }

  // ── Falling beat circles ──
  for (const n of gNotes) {
    if (n.hit || n.missed) continue;
    const td = n.time - elapsed;
    const y = RY + td * NSPD;
    n.y = y;
    if (y < -NS || y > H + NS) continue;
    if (td < -JDG.miss.w / 1000) {
      n.missed = true; gCombo = 0; gJdg.miss++; showJ('miss');
      continue;
    }
    const alpha = y < RY ? Math.max(.2, 1 - (RY - y) / 200) : 1;
    const col = ACOL[DIRS[n.dir]];
    drawTypingCircle(ctx, cx, y, col.m, alpha);
  }
}

function drawTypingCircle(ctx, x, y, col, alpha) {
  const r = NS / 2.5;
  ctx.save();
  ctx.globalAlpha = alpha;

  const glowSize = 15 + beatPulse * 12;
  ctx.shadowBlur = glowSize;
  ctx.shadowColor = col;

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ═══════════════════════════════════════════
//  HIT TYPING NOTE (typing mode)
// ═══════════════════════════════════════════
function hitTypingNote(letter) {
  if (!gActive) return;
  if (typingLettersPos >= typingLetters.length) return;

  // Check if the pressed letter matches the current expected letter
  const expected = typingLetters[typingLettersPos];
  if (letter !== expected) return;

  const elapsed = getElapsed();

  // Find the earliest unhit circle within the hit window
  let best = null, bestD = Infinity;
  for (const n of gNotes) {
    if (n.hit || n.missed) continue;
    const d = Math.abs(n.time - elapsed) * 1000;
    if (d < bestD && d < JDG.miss.w) { best = n; bestD = d; }
  }
  if (!best) return;

  rFlash.left = 1;
  best.hit = true;

  // Advance in the letter queue
  typingLettersPos++;

  let j;
  if (bestD <= JDG.perfect.w) j = 'perfect';
  else if (bestD <= JDG.great.w) j = 'great';
  else if (bestD <= JDG.good.w) j = 'good';
  else j = 'miss';

  if (j === 'miss') { gCombo = 0; perfectCount = 0; }
  else { gCombo++; if (gCombo > gMaxCombo) gMaxCombo = gCombo; }

  if (j === 'perfect') {
    perfectCount++;
    const px = innerWidth / 2;
    const isComboMilestone = gCombo > 0 && (gCombo % 25 === 0 || gCombo === 10);
    if (isComboMilestone) {
      spawnPerfectEffect(px, RY, ACOL[DIRS[best.dir]].m, true);
    } else if (perfectCount % 3 === 0) {
      spawnPerfectEffect(px, RY, ACOL[DIRS[best.dir]].m, false);
    }
  } else {
    perfectCount = 0;
  }

  gJdg[j]++;
  gScore += Math.floor(JDG[j].s * (1 + Math.floor(gCombo / 10) * .1));
  showJ(j);
}

// ═══════════════════════════════════════════
//  ARROW DRAWING
// ═══════════════════════════════════════════
function drawArr(ctx, x, y, dir, sz, col, a, rec) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  ctx.rotate({left:Math.PI, down:Math.PI/2, up:-Math.PI/2, right:0}[dir]);
  const s = sz/2;
  const p = () => {
    ctx.beginPath(); ctx.moveTo(s,0); ctx.lineTo(-s*.3,-s*.7); ctx.lineTo(-s*.3,-s*.3);
    ctx.lineTo(-s*.8,-s*.3); ctx.lineTo(-s*.8,s*.3); ctx.lineTo(-s*.3,s*.3);
    ctx.lineTo(-s*.3,s*.7); ctx.closePath();
  };
  if (!rec) {
    const glowSize = 15 + beatPulse * 12;
    ctx.shadowBlur = glowSize; ctx.shadowColor = col; ctx.fillStyle = col; p(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.moveTo(s*.7,0); ctx.lineTo(-s*.1,-s*.45); ctx.lineTo(-s*.1,-s*.15);
    ctx.lineTo(-s*.55,-s*.15); ctx.lineTo(-s*.55,s*.15); ctx.lineTo(-s*.1,s*.15);
    ctx.lineTo(-s*.1,s*.45); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = col; ctx.lineWidth = 2.5 + beatBass * 1.5; p(); ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════
//  JUDGMENT DISPLAY
// ═══════════════════════════════════════════
function showJ(type) {
  const j = JDG[type], el = document.getElementById('jdg');
  el.textContent = j.t; el.style.color = j.c;
  el.style.opacity = '1'; el.style.transform = 'translate(-50%,-50%) scale(1.2)';
  jTimer = 500;
}

// ═══════════════════════════════════════════
//  HIT NOTE (classic mode)
// ═══════════════════════════════════════════
function hitNote(dir) {
  if (!gActive) return;
  const elapsed = getElapsed();
  rFlash[DIRS[dir]] = 1;

  let best = null, bestD = Infinity;
  for (const n of gNotes) {
    if (n.hit || n.missed || n.dir !== dir) continue;
    const d = Math.abs(n.time - elapsed) * 1000;
    if (d < bestD && d < JDG.miss.w) { best = n; bestD = d; }
  }
  if (!best) return;
  best.hit = true;

  let j;
  if (bestD <= JDG.perfect.w) j = 'perfect';
  else if (bestD <= JDG.great.w) j = 'great';
  else if (bestD <= JDG.good.w) j = 'good';
  else j = 'miss';

  if (j === 'miss') { gCombo = 0; perfectCount = 0; }
  else { gCombo++; if (gCombo > gMaxCombo) gMaxCombo = gCombo; }

  if (j === 'perfect') {
    perfectCount++;
    const sx = (innerWidth - CW * 4) / 2;
    const px = sx + best.dir * CW + CW / 2;
    const isComboMilestone = gCombo > 0 && (gCombo % 25 === 0 || gCombo === 10);
    if (isComboMilestone) {
      spawnPerfectEffect(px, RY, ACOL[DIRS[best.dir]].m, true);
    } else if (perfectCount % 3 === 0) {
      spawnPerfectEffect(px, RY, ACOL[DIRS[best.dir]].m, false);
    }
  } else {
    perfectCount = 0;
  }

  gJdg[j]++;
  gScore += Math.floor(JDG[j].s * (1 + Math.floor(gCombo / 10) * .1));
  showJ(j);
}

// ═══════════════════════════════════════════
//  STRIKE CLICK (strike mode)
// ═══════════════════════════════════════════
function strikeClick() {
  if (!gActive) return;
  const elapsed = getElapsed();

  // Find the earliest clickable circle under the cursor
  let best = null, bestD = Infinity;
  for (const n of gNotes) {
    if (n.hit || n.missed) continue;
    const td = n.time - elapsed;
    if (td > STRIKE_VISIBLE) continue;
    const timeDist = Math.abs(td) * 1000;
    if (timeDist >= JDG.miss.w) continue;
    // Check cursor within hit radius
    const dx = sCursorX - n.cx;
    const dy = sCursorY - n.cy;
    const spatialDist = Math.sqrt(dx * dx + dy * dy);
    if (spatialDist > STRIKE_R * 1.4) continue;
    // Prefer earliest note
    if (n.time < (best ? best.time : Infinity)) {
      best = n;
      bestD = timeDist;
    }
  }

  if (!best) return;
  best.hit = true;

  let j;
  if (bestD <= JDG.perfect.w) j = 'perfect';
  else if (bestD <= JDG.great.w) j = 'great';
  else if (bestD <= JDG.good.w) j = 'good';
  else j = 'miss';

  if (j === 'miss') { gCombo = 0; perfectCount = 0; }
  else { gCombo++; if (gCombo > gMaxCombo) gMaxCombo = gCombo; }

  // Particle effect at circle position
  if (j === 'perfect') {
    perfectCount++;
    const isComboMilestone = gCombo > 0 && (gCombo % 25 === 0 || gCombo === 10);
    if (isComboMilestone) {
      spawnPerfectEffect(best.cx, best.cy, ACOL[DIRS[best.dir]].m, true);
    } else if (perfectCount % 3 === 0) {
      spawnPerfectEffect(best.cx, best.cy, ACOL[DIRS[best.dir]].m, false);
    }
  } else {
    perfectCount = 0;
  }

  gJdg[j]++;
  gScore += Math.floor(JDG[j].s * (1 + Math.floor(gCombo / 10) * .1));
  showJ(j);
}

function resizeC() {
  gCanvas.width = innerWidth * devicePixelRatio;
  gCanvas.height = innerHeight * devicePixelRatio;
  gCtx.scale(devicePixelRatio, devicePixelRatio);
}
