// ═══════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════
const KM = {};

document.addEventListener('keydown', e => {
  // Rebinding mode — capture key for settings
  if (rebindingTarget) {
    handleRebindKey(e);
    return;
  }

  if (e.key === 'Escape') {
    if (settingsOpen) {
      closeSettings();
      return;
    }
    if (tutorialPendingDiff) {
      closeTutorialToMenu();
      return;
    }
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
