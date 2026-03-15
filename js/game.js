// ═══════════════════════════════════════════
//  GAME LOOP & RENDERING
// ═══════════════════════════════════════════
function getElapsed() {
  // Game clock = audioCtx time since recording started.
  // Arrows have hitTime = onsetTime + AUDIO_DELAY.
  // When elapsed reaches hitTime, the delayed audio is playing that beat.
  if (!audioCtx) return 0;
  return audioCtx.currentTime - liveRecordStart;
}

function gameLoop() {
  if (!gActive) return;
  gRAF = requestAnimationFrame(gameLoop);

  detectOnsets();
  sampleBeatVisuals();

  // Detect when music actually starts playing — hide waiting overlay
  // Use liveEnergyData (real-time, no delay) to detect audio presence quickly
  if (!musicDetected && liveEnergyData.length > 10) {
    const recent = liveEnergyData.slice(-5);
    const avgFlux = recent.reduce((s, d) => s + d.flux, 0) / recent.length;
    if (avgFlux > 0.005) {
      musicDetected = true;
      document.getElementById('waiting').classList.add('hidden');
    }
  }

  const elapsed = getElapsed();
  const W = innerWidth, H = innerHeight, ctx = gCtx;
  ctx.clearRect(0, 0, W, H);

  // ── BEAT-REACTIVE BACKGROUND ──
  const theme = getBgTheme();
  const bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0, `rgba(${theme.base[0]},${theme.base[1]},${Math.floor(theme.base[2] + beatBass * theme.bassShift[2])},1)`);
  bg.addColorStop(.5, `rgba(${Math.floor(theme.mid[0] + beatPulse * theme.pulseShift[0])},${Math.floor(theme.mid[1] + beatPulse * theme.pulseShift[1])},${Math.floor(theme.mid[2] + beatHigh * theme.highShift[2])},1)`);
  bg.addColorStop(1, `rgba(${theme.base[0]},${theme.base[1]},${Math.floor(theme.base[2] + beatBass * theme.midShift[2])},1)`);
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Scan lines
  ctx.fillStyle = 'rgba(255,255,255,.008)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0,y,W,1);

  // Lane area
  const lw = CW*4+40, lx = (W-lw)/2;
  const lg = ctx.createLinearGradient(lx,0,lx+lw,0);
  const laneAlpha = 0.02 + beatEnergy * 0.02;
  lg.addColorStop(0,'transparent');
  lg.addColorStop(.1,`rgba(255,255,255,${laneAlpha})`);
  lg.addColorStop(.9,`rgba(255,255,255,${laneAlpha})`);
  lg.addColorStop(1,'transparent');
  ctx.fillStyle = lg; ctx.fillRect(lx,0,lw,H);

  // Receptor line — pulses with bass
  const receptorAlpha = 0.15 + beatPulse * 0.4;
  const receptorWidth = 1 + beatPulse * 2;
  ctx.strokeStyle = `rgba(255,255,255,${receptorAlpha})`;
  ctx.lineWidth = receptorWidth;
  ctx.beginPath(); ctx.moveTo(lx,RY); ctx.lineTo(lx+lw,RY); ctx.stroke();

  // Bass pulse glow — radiates from center on beat hits
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

  // Side edge glow — bass on left, high on right
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

  // Combo glow
  if (gCombo > 10) {
    ctx.fillStyle = `rgba(118,255,3,${Math.min(.15, gCombo/500)})`;
    ctx.fillRect(lx,0,lw,H);
  }

  const sx = (W - CW*4) / 2;

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

  // Notes — first pass: draw chord connection bars
  // Group notes by chordId to find simultaneous arrows
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
    // Glowing connection bar
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,255,255,.3)';
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }

  // Notes — second pass: draw arrows
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

  // HUD
  document.getElementById('hs').textContent = gScore.toLocaleString();
  const ce = document.getElementById('hc');
  ce.textContent = `${gCombo}x COMBO`;
  ce.className = gCombo >= 50 ? 'big' : '';
  const tj = gJdg.perfect + gJdg.great + gJdg.good + gJdg.miss;
  document.getElementById('ha').textContent =
    (tj > 0 ? ((gJdg.perfect*100 + gJdg.great*70 + gJdg.good*40) / (tj*100) * 100) : 100).toFixed(1) + '%';

  // Particles and effects (drawn on top of everything)
  updateAndDrawParticles(ctx);

  // Judgment fade
  if (jTimer > 0) {
    jTimer -= 16;
    const el = document.getElementById('jdg');
    el.style.opacity = Math.min(1, jTimer / 200);
    el.style.transform = `translate(-50%,-50%) scale(${1 + (1 - jTimer/500) * .3})`;
  }

  // Pulse combo text glow with beat
  if (gCombo > 0) {
    document.getElementById('hc').style.textShadow = `0 0 ${8 + beatPulse * 20}px currentColor`;
  }
}

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
    // Note arrows: glow intensity pulses with the beat
    const glowSize = 15 + beatPulse * 12;
    ctx.shadowBlur = glowSize; ctx.shadowColor = col; ctx.fillStyle = col; p(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.moveTo(s*.7,0); ctx.lineTo(-s*.1,-s*.45); ctx.lineTo(-s*.1,-s*.15);
    ctx.lineTo(-s*.55,-s*.15); ctx.lineTo(-s*.55,s*.15); ctx.lineTo(-s*.1,s*.15);
    ctx.lineTo(-s*.1,s*.45); ctx.closePath(); ctx.fill();
  } else {
    // Receptor arrows: line width pulses subtly with bass
    ctx.strokeStyle = col; ctx.lineWidth = 2.5 + beatBass * 1.5; p(); ctx.stroke();
  }
  ctx.restore();
}

function showJ(type) {
  const j = JDG[type], el = document.getElementById('jdg');
  el.textContent = j.t; el.style.color = j.c;
  el.style.opacity = '1'; el.style.transform = 'translate(-50%,-50%) scale(1.2)';
  jTimer = 500;
}

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

  // Subtle particle effect on perfect hits — not every time
  if (j === 'perfect') {
    perfectCount++;
    const sx = (innerWidth - CW * 4) / 2;
    const px = sx + best.dir * CW + CW / 2;
    // Small sparkle every 3rd perfect, bigger burst on combo milestones (10, 25, 50, 100...)
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

function resizeC() {
  gCanvas.width = innerWidth * devicePixelRatio;
  gCanvas.height = innerHeight * devicePixelRatio;
  gCtx.scale(devicePixelRatio, devicePixelRatio);
}
