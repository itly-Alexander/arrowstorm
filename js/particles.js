// ═══════════════════════════════════════════
//  PARTICLE SYSTEM — dopamine burst on perfect hits
// ═══════════════════════════════════════════
let particles = [];
let perfectRings = []; // expanding rings on perfect hits
let perfectCount = 0;  // track consecutive perfects

function spawnPerfectEffect(x, y, color, intense) {
  // Small burst: 5-8 sparks
  const count = intense ? 10 + Math.floor(Math.random() * 5) : 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.6;
    const speed = intense ? (100 + Math.random() * 160) : (60 + Math.random() * 100);
    const size = 1.5 + Math.random() * 2.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.025,
      size, color
    });
  }
  // Expanding ring — subtle
  if (intense) {
    perfectRings.push({ x, y, radius: 8, maxRadius: 80, life: 1.0, color });
  }
}

function updateAndDrawParticles(ctx) {
  // Expanding rings
  for (let i = perfectRings.length - 1; i >= 0; i--) {
    const r = perfectRings[i];
    r.radius += (r.maxRadius - r.radius) * 0.1;
    r.life *= 0.9;
    if (r.life < 0.02) { perfectRings.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = r.life * 0.4;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 1.5 + r.life * 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = r.color;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    p.vy += 150 * 0.016; // gravity
    p.vx *= 0.98;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }

    ctx.save();
    ctx.globalAlpha = p.life * 0.8;
    ctx.shadowBlur = 6;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
