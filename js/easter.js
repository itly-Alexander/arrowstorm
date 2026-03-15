// ═══════════════════════════════════════════
//  EASTER EGG — Arrow Storm on title click
// ═══════════════════════════════════════════
let eggClicks = 0;
let eggTimer = null;
let eggActive = false;

function easterEggClick() {
  if (eggActive) return;
  eggClicks++;
  clearTimeout(eggTimer);
  eggTimer = setTimeout(() => { eggClicks = 0; }, 800);
  if (eggClicks >= 3) {
    eggClicks = 0;
    launchArrowStorm();
  }
}

function launchArrowStorm() {
  eggActive = true;
  const canvas = document.getElementById('egg-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const W = innerWidth, H = innerHeight;

  const colors = ['#ff2d55', '#00e5ff', '#76ff03', '#ffab00'];
  const dirNames = ['left', 'down', 'up', 'right'];
  const arrows = [];

  // Spawn waves of arrows
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
    // All arrows point right since they fly left-to-right
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

  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    ctx.clearRect(0, 0, W, H);

    let allGone = true;
    for (const a of arrows) {
      a.x += a.speed * dt;
      a.y += Math.sin(a.phase + now / 1000 * a.wobbleSpeed) * a.wobble;

      // Fade out as it approaches right edge
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
      return;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
