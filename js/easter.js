// ═══════════════════════════════════════════
//  EASTER EGG — Arrow Storm on title click
//  + Ambient playful arrows on menu background
// ═══════════════════════════════════════════
let eggClicks = 0;
let eggTimer = null;
let eggActive = false;

// ── Ambient arrow duo state ──
let ambientRunning = false;
let ambientCtx = null;
let ambientAnimId = null;

const BUDDY_COLORS = ['#ff2d55', '#00e5ff'];

function createBuddy(index, sneakIn) {
  const W = innerWidth, H = innerHeight;
  if (sneakIn) {
    // Start off-screen right, will sneak back in
    return {
      x: W + 60 + index * 40,
      y: H * (0.3 + index * 0.4),
      vx: -30, vy: 0,
      targetX: W * 0.5, targetY: H * 0.5,
      angle: Math.PI,    // facing left (sneaking back)
      size: 38,
      color: BUDDY_COLORS[index],
      index: index,
      state: 'sneakIn',
      stateTimer: 0,     // tracks time spent sneaking (counts up)
      sneakDuration: 3.5 + Math.random() * 1.5,
      squashX: 1, squashY: 1,
      wobblePhase: Math.random() * Math.PI * 2,
      bumpCooldown: 0,
    };
  }
  const cx = W * (0.3 + index * 0.4);
  const cy = H * 0.5;
  return {
    x: cx, y: cy,
    vx: 0, vy: 0,
    targetX: cx, targetY: cy,
    angle: 0,
    size: 38,
    color: BUDDY_COLORS[index],
    index: index,
    state: 'wander',
    stateTimer: 2 + Math.random() * 3,
    squashX: 1, squashY: 1,
    wobblePhase: Math.random() * Math.PI * 2,
    bumpCooldown: 0,
  };
}

let buddies = [];
let buddyTime = 0;

function pickWanderTarget(b) {
  const W = innerWidth, H = innerHeight;
  const margin = 80;
  b.targetX = margin + Math.random() * (W - margin * 2);
  b.targetY = margin + Math.random() * (H - margin * 2);
}

function pickBuddyBehaviour() {
  const behaviours = [
    'wander', 'chase', 'orbit', 'parallel',
    'meetUp', 'leapfrog', 'sideBySide',
  ];
  const pick = behaviours[Math.floor(Math.random() * behaviours.length)];
  const W = innerWidth, H = innerHeight;
  for (const b of buddies) {
    b.state = pick;
    b.stateTimer = 3 + Math.random() * 4;
    if (pick === 'wander') {
      pickWanderTarget(b);
    } else if (pick === 'meetUp') {
      // Both head toward a shared meeting point
      const mx = 120 + Math.random() * (W - 240);
      const my = 120 + Math.random() * (H - 240);
      b.targetX = mx + (b.index === 0 ? -30 : 30);
      b.targetY = my;
    } else if (pick === 'parallel') {
      // Fly side by side in a random direction
      const angle = Math.random() * Math.PI * 2;
      b._parallelAngle = angle;
      b._parallelSpeed = 120 + Math.random() * 80;
    } else if (pick === 'sideBySide') {
      pickWanderTarget(b);
      b.stateTimer = 4 + Math.random() * 3;
    }
  }
}

function startAmbientArrows(sneakIn) {
  if (ambientRunning) return;
  ambientRunning = true;
  const canvas = document.getElementById('egg-canvas');
  ambientCtx = canvas.getContext('2d');
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ambientCtx.scale(devicePixelRatio, devicePixelRatio);

  buddies = [createBuddy(0, sneakIn), createBuddy(1, sneakIn)];
  buddyTime = 0; // first frame will sync this
  if (!sneakIn) pickBuddyBehaviour();
  ambientAnimId = requestAnimationFrame(ambientFrame);
}

function stopAmbientArrows() {
  ambientRunning = false;
  if (ambientAnimId) {
    cancelAnimationFrame(ambientAnimId);
    ambientAnimId = null;
  }
}

function ambientFrame(now) {
  if (!ambientRunning) return;
  // First frame: just sync the clock, don't move anything
  if (buddyTime === 0) { buddyTime = now; ambientAnimId = requestAnimationFrame(ambientFrame); return; }
  const dt = Math.min((now - buddyTime) / 1000, 0.05);
  buddyTime = now;
  const W = innerWidth, H = innerHeight;
  const canvas = document.getElementById('egg-canvas');

  // Handle resize
  if (Math.abs(canvas.width / devicePixelRatio - W) > 2) {
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ambientCtx.scale(devicePixelRatio, devicePixelRatio);
  }

  ambientCtx.clearRect(0, 0, W, H);

  const a = buddies[0], bud = buddies[1];

  // Update state timers & pick new behaviour
  for (const buddy of buddies) {
    buddy.bumpCooldown = Math.max(0, buddy.bumpCooldown - dt);
    if (buddy.state === 'sneakIn') {
      buddy.stateTimer += dt; // count up for sneak progress
    } else {
      buddy.stateTimer -= dt;
      if (buddy.stateTimer <= 0 && buddy.state !== 'startled' && buddy.state !== 'exitRight') {
        pickBuddyBehaviour();
      }
    }
  }

  // Bump detection — when they get close, bounce off each other (skip during sneakIn)
  const ddx = a.x - bud.x;
  const ddy = a.y - bud.y;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  const bothSneaking = a.state === 'sneakIn' && bud.state === 'sneakIn';
  if (dist < 55 && dist > 1 && a.bumpCooldown <= 0 && bud.bumpCooldown <= 0 && !bothSneaking) {
    // Elastic-ish bump
    const nx = ddx / dist, ny = ddy / dist;
    const bumpForce = 180;
    a.vx += nx * bumpForce;
    a.vy += ny * bumpForce;
    bud.vx -= nx * bumpForce;
    bud.vy -= ny * bumpForce;
    // Squash on impact
    a.squashX = 0.7; a.squashY = 1.3;
    bud.squashX = 0.7; bud.squashY = 1.3;
    a.bumpCooldown = 0.8;
    bud.bumpCooldown = 0.8;
  }

  // Physics per buddy
  for (const buddy of buddies) {
    const other = buddy === a ? bud : a;
    let accelX = 0, accelY = 0;
    const speed = 180;
    const orbitSpeed = 2.5;

    if (buddy.state === 'sneakIn') {
      // Ramp speed from cautious to normal over sneakDuration
      const progress = Math.min(buddy.stateTimer / buddy.sneakDuration, 1);
      const sneakSpeed = 40 + progress * 140; // 40 → 180
      const targetX = W * (0.3 + buddy.index * 0.4);
      const targetY = H * (0.35 + buddy.index * 0.3);
      const dx = targetX - buddy.x;
      const dy = targetY - buddy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 15 && progress < 1) {
        accelX = (dx / d) * sneakSpeed;
        accelY = (dy / d) * sneakSpeed;
      } else {
        // Finished sneaking — transition to normal
        buddy.state = 'wander';
        buddy.stateTimer = 2 + Math.random() * 2;
        pickWanderTarget(buddy);
      }
    } else if (buddy.state === 'wander') {
      const dx = buddy.targetX - buddy.x;
      const dy = buddy.targetY - buddy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 10) {
        accelX = (dx / d) * speed;
        accelY = (dy / d) * speed;
      } else {
        pickWanderTarget(buddy);
      }
    } else if (buddy.state === 'chase') {
      if (buddy.index === 0) {
        // Chase the other
        const dx = other.x - buddy.x;
        const dy = other.y - buddy.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 5) {
          accelX = (dx / d) * speed * 1.4;
          accelY = (dy / d) * speed * 1.4;
        }
      } else {
        // Flee from other
        const dx = buddy.x - other.x;
        const dy = buddy.y - other.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 5) {
          accelX = (dx / d) * speed * 1.6;
          accelY = (dy / d) * speed * 1.6;
        }
        if (buddy.x < 80) accelX += speed;
        if (buddy.x > W - 80) accelX -= speed;
        if (buddy.y < 80) accelY += speed;
        if (buddy.y > H - 80) accelY -= speed;
      }
    } else if (buddy.state === 'orbit') {
      const cx = (a.x + bud.x) / 2;
      const cy = (a.y + bud.y) / 2;
      const dx = buddy.x - cx;
      const dy = buddy.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const targetDist = 90;
      const tangentX = -dy;
      const tangentY = dx;
      const sign = buddy.index === 0 ? 1 : -1;
      accelX = tangentX * orbitSpeed * sign;
      accelY = tangentY * orbitSpeed * sign;
      if (d > 5) {
        accelX += (dx / d) * (targetDist - d) * 2;
        accelY += (dy / d) * (targetDist - d) * 2;
      }
      accelX += (W / 2 - cx) * 0.3;
      accelY += (H / 2 - cy) * 0.3;
    } else if (buddy.state === 'parallel') {
      // Fly side by side
      const pAngle = buddy._parallelAngle || 0;
      const pSpeed = buddy._parallelSpeed || 150;
      accelX = Math.cos(pAngle) * pSpeed;
      accelY = Math.sin(pAngle) * pSpeed;
      // Stay near the other buddy (offset perpendicular)
      const perpX = -Math.sin(pAngle) * (buddy.index === 0 ? -40 : 40);
      const perpY = Math.cos(pAngle) * (buddy.index === 0 ? -40 : 40);
      const idealX = (a.x + bud.x) / 2 + perpX;
      const idealY = (a.y + bud.y) / 2 + perpY;
      accelX += (idealX - buddy.x) * 1.5;
      accelY += (idealY - buddy.y) * 1.5;
      // Bounce off walls by changing angle
      if (buddy.x < 60 || buddy.x > W - 60 || buddy.y < 60 || buddy.y > H - 60) {
        buddy._parallelAngle = Math.atan2(H / 2 - buddy.y, W / 2 - buddy.x) + (Math.random() - 0.5) * 0.5;
      }
    } else if (buddy.state === 'meetUp') {
      // Head to shared meeting point
      const dx = buddy.targetX - buddy.x;
      const dy = buddy.targetY - buddy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 15) {
        accelX = (dx / d) * speed * 0.8;
        accelY = (dy / d) * speed * 0.8;
      }
      // Once close enough, orbit briefly around meeting point
      if (d < 50) {
        const tangentX = -(buddy.y - buddy.targetY);
        const tangentY = (buddy.x - buddy.targetX);
        const sign = buddy.index === 0 ? 1 : -1;
        accelX += tangentX * 2 * sign;
        accelY += tangentY * 2 * sign;
      }
    } else if (buddy.state === 'leapfrog') {
      // Take turns jumping over each other
      const dx = other.x - buddy.x;
      const dy = other.y - buddy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const phase = (now / 1000 + buddy.index * 1.5) % 3;
      if (phase < 1.5) {
        // Jump towards and over the other
        if (d > 5) {
          accelX = (dx / d) * speed * 1.8;
          accelY = (dy / d) * speed * 1.8;
        }
        // Arc upward as we pass
        if (d < 80) {
          accelY -= 300;
        }
      } else {
        // Drift slowly, wait for the other to jump
        accelX = (W / 2 - buddy.x) * 0.3;
        accelY = (H / 2 - buddy.y) * 0.3;
      }
    } else if (buddy.state === 'sideBySide') {
      // Both wander to similar targets, staying close
      const dx = buddy.targetX - buddy.x;
      const dy = buddy.targetY - buddy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 10) {
        accelX = (dx / d) * speed * 0.9;
        accelY = (dy / d) * speed * 0.9;
      } else {
        pickWanderTarget(buddy);
      }
      // Attract towards other buddy to stay close
      const ox = other.x - buddy.x;
      const oy = other.y - buddy.y;
      const od = Math.sqrt(ox * ox + oy * oy);
      if (od > 70) {
        accelX += (ox / od) * speed * 0.5;
        accelY += (oy / od) * speed * 0.5;
      }
    } else if (buddy.state === 'startled') {
      buddy.vx *= 0.85;
      buddy.vy *= 0.85;
      buddy.squashX = 1.3;
      buddy.squashY = 0.7;
    } else if (buddy.state === 'exitRight') {
      accelX = 900;
      accelY = (buddy.index === 0 ? -1 : 1) * 40;
    }

    // Apply acceleration (damped steering)
    if (buddy.state !== 'startled') {
      buddy.vx += (accelX - buddy.vx * 3) * dt;
      buddy.vy += (accelY - buddy.vy * 3) * dt;
    }
    buddy.x += buddy.vx * dt;
    buddy.y += buddy.vy * dt;

    // Soft bounds (not during exit or sneak-in)
    if (buddy.state !== 'exitRight' && buddy.state !== 'startled' && buddy.state !== 'sneakIn') {
      const m = 40;
      if (buddy.x < m) { buddy.x = m; buddy.vx = Math.abs(buddy.vx); }
      if (buddy.x > W - m) { buddy.x = W - m; buddy.vx = -Math.abs(buddy.vx); }
      if (buddy.y < m) { buddy.y = m; buddy.vy = Math.abs(buddy.vy); }
      if (buddy.y > H - m) { buddy.y = H - m; buddy.vy = -Math.abs(buddy.vy); }
    }

    // Visual angle follows velocity
    const velMag = Math.sqrt(buddy.vx * buddy.vx + buddy.vy * buddy.vy);
    if (velMag > 5) {
      const targetAngle = Math.atan2(buddy.vy, buddy.vx);
      let diff = targetAngle - buddy.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      buddy.angle += diff * Math.min(1, dt * 8);
    }

    // Wobble
    buddy.wobblePhase += dt * 3;
    const wobble = Math.sin(buddy.wobblePhase) * 0.06;

    // Squash & stretch decay
    buddy.squashX += (1 - buddy.squashX) * dt * 6;
    buddy.squashY += (1 - buddy.squashY) * dt * 6;

    // Velocity-based stretch
    let stretchX = 1, stretchY = 1;
    if (velMag > 50) {
      const stretch = Math.min(velMag / 400, 0.25);
      stretchX = 1 + stretch;
      stretchY = 1 - stretch * 0.5;
    }

    // Draw
    drawBuddyArrow(
      ambientCtx, buddy.x, buddy.y,
      buddy.angle + wobble,
      buddy.size,
      buddy.color,
      buddy.state === 'sneakIn' ? Math.min(0.7, (W - buddy.x) / 120) : 0.7,
      buddy.squashX * stretchX,
      buddy.squashY * stretchY
    );
  }

  ambientAnimId = requestAnimationFrame(ambientFrame);
}

function drawBuddyArrow(ctx, x, y, angle, sz, col, alpha, scaleX, scaleY) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scaleX, scaleY);
  const s = sz / 2;

  // Arrow body
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * .3, -s * .7);
  ctx.lineTo(-s * .3, -s * .3);
  ctx.lineTo(-s * .8, -s * .3);
  ctx.lineTo(-s * .8, s * .3);
  ctx.lineTo(-s * .3, s * .3);
  ctx.lineTo(-s * .3, s * .7);
  ctx.closePath();
  ctx.shadowBlur = 15;
  ctx.shadowColor = col;
  ctx.fillStyle = col;
  ctx.fill();

  // Inner highlight
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.beginPath();
  ctx.moveTo(s * .7, 0);
  ctx.lineTo(-s * .1, -s * .45);
  ctx.lineTo(-s * .1, -s * .15);
  ctx.lineTo(-s * .55, -s * .15);
  ctx.lineTo(-s * .55, s * .15);
  ctx.lineTo(-s * .1, s * .15);
  ctx.lineTo(-s * .1, s * .45);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ── Easter egg click handler ──
function easterEggClick() {
  if (eggActive) return;
  eggClicks++;
  clearTimeout(eggTimer);
  eggTimer = setTimeout(() => { eggClicks = 0; }, 800);
  if (eggClicks >= 3) {
    eggClicks = 0;
    triggerStartledThenStorm();
  }
}

function triggerStartledThenStorm() {
  eggActive = true;

  // Phase 1: Startle the buddies
  for (const b of buddies) {
    b.state = 'startled';
    b.squashX = 1.4;
    b.squashY = 0.6;
    b.vx = (Math.random() - 0.5) * 100;
    b.vy = -80 - Math.random() * 60;
  }

  // Phase 2: After brief startle, flee right
  setTimeout(() => {
    for (const b of buddies) {
      b.state = 'exitRight';
      b.vx = 300 + Math.random() * 100;
      b.vy = (b.index === 0 ? -30 : 30);
    }

    // Phase 3: After buddies start fleeing, launch the arrow storm behind them
    setTimeout(() => {
      launchArrowStorm();
    }, 300);
  }, 500);
}

// ── Arrow storm (the original easter egg swarm) ──
function launchArrowStorm() {
  const canvas = document.getElementById('egg-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const W = innerWidth, H = innerHeight;

  // Stop ambient loop — storm takes over the canvas
  stopAmbientArrows();

  const colors = ['#ff2d55', '#00e5ff', '#76ff03', '#ffab00'];
  const dirNames = ['left', 'down', 'up', 'right'];
  const arrows = [];

  // The two fleeing buddies as the first arrows
  for (const b of buddies) {
    arrows.push({
      x: b.x,
      y: b.y,
      speed: 600 + Math.random() * 200,
      size: b.size,
      color: b.color,
      dir: 'right',
      alpha: 0.8,
      wobble: (Math.random() - 0.5) * 3,
      wobbleSpeed: 4 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Spawn waves of storm arrows
  const totalArrows = 120;
  const waves = 5;
  const perWave = Math.floor(totalArrows / waves);

  for (let w = 0; w < waves; w++) {
    for (let i = 0; i < perWave; i++) {
      const dirIdx = Math.floor(Math.random() * 4);
      arrows.push({
        x: -60 - Math.random() * W * 0.6 - w * 180,
        y: 40 + Math.random() * (H - 80),
        speed: 400 + Math.random() * 500 + w * 60,
        size: 28 + Math.random() * 24,
        color: colors[dirIdx],
        dir: dirNames[dirIdx],
        alpha: 0.6 + Math.random() * 0.4,
        wobble: (Math.random() - 0.5) * 2,
        wobbleSpeed: 2 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  let last = performance.now();

  function drawEggArrow(ctx, x, y, dir, sz, col, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate({ left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2, right: 0 }[dir]);
    const s = sz / 2;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * .3, -s * .7);
    ctx.lineTo(-s * .3, -s * .3);
    ctx.lineTo(-s * .8, -s * .3);
    ctx.lineTo(-s * .8, s * .3);
    ctx.lineTo(-s * .3, s * .3);
    ctx.lineTo(-s * .3, s * .7);
    ctx.closePath();
    ctx.shadowBlur = 15;
    ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.beginPath();
    ctx.moveTo(s * .7, 0);
    ctx.lineTo(-s * .1, -s * .45);
    ctx.lineTo(-s * .1, -s * .15);
    ctx.lineTo(-s * .55, -s * .15);
    ctx.lineTo(-s * .55, s * .15);
    ctx.lineTo(-s * .1, s * .15);
    ctx.lineTo(-s * .1, s * .45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    ctx.clearRect(0, 0, W, H);

    let allGone = true;
    for (const a of arrows) {
      a.x += a.speed * dt;
      a.y += Math.sin(a.phase + now / 1000 * a.wobbleSpeed) * a.wobble;

      let alpha = a.alpha;
      if (a.x > W - 150) {
        alpha *= Math.max(0, (W - a.x) / 150);
      }

      if (a.x < W + 60) {
        allGone = false;
        if (alpha > 0.01) {
          drawEggArrow(ctx, a.x, a.y, 'right', a.size, a.color, alpha);
        }
      }
    }

    if (allGone) {
      ctx.clearRect(0, 0, W, H);
      eggActive = false;
      // Buddies sneak back in from the right
      buddies = [];
      startAmbientArrows(true);
      return;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ── Start ambient arrows when menu is shown ──
(function() {
  const menu = document.getElementById('menu');
  if (menu && menu.style.display !== 'none') {
    startAmbientArrows(false);
  }

  const observer = new MutationObserver(() => {
    const menu = document.getElementById('menu');
    if (!menu) return;
    if (menu.style.display === 'none') {
      stopAmbientArrows();
    } else if (!eggActive) {
      startAmbientArrows(false);
    }
  });

  const target = document.getElementById('menu');
  if (target) {
    observer.observe(target, { attributes: true, attributeFilter: ['style'] });
  }
})();
