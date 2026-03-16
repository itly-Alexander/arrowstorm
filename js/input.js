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
    // Back from difficulty select to mode select
    const diffSel = document.getElementById('diff-select');
    if (!gActive && diffSel && diffSel.style.display !== 'none') {
      showModeSelect();
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

  // Strike mode: Z/X keys to click
  if ((e.key === 'z' || e.key === 'x') && gameMode === 'strike' && gActive) {
    e.preventDefault();
    strikeClick();
    return;
  }

  const d = KM[e.key];
  if (d !== undefined && gActive) {
    e.preventDefault();
    hitNote(d);
  }
});

// Mouse input for strike mode
document.addEventListener('mousemove', e => {
  sCursorX = e.clientX;
  sCursorY = e.clientY;
});

document.addEventListener('mousedown', e => {
  if (gameMode === 'strike' && gActive) {
    strikeClick();
  }
});

addEventListener('resize', () => { if (gCanvas) resizeC(); });
