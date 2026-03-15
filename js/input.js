// ═══════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════
const KM = {
  'ArrowLeft':0,'ArrowDown':1,'ArrowUp':2,'ArrowRight':3,
  d:0,D:0,f:1,F:1,j:2,J:2,k:3,K:3
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (gActive) {
      gActive = false;
      if (gRAF) cancelAnimationFrame(gRAF);
      cleanup();
      showMenu();
    }
    return;
  }
  if (e.repeat) return;
  const d = KM[e.key];
  if (d !== undefined && gActive) { e.preventDefault(); hitNote(d); }
});

addEventListener('resize', () => { if (gCanvas) resizeC(); });
