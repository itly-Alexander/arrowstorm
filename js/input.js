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

  // Typing mode: any letter key triggers a hit
  if (gameMode === 'typing' && gActive) {
    const letter = e.key.toUpperCase();
    if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
      e.preventDefault();
      hitTypingNote(letter);
      return;
    }
  }

  const d = KM[e.key];
  if (d !== undefined && gActive) {
    e.preventDefault();
    hitNote(d);
  }

  // Menu easter egg: player-controlled arrow
  if (d !== undefined && !gActive && !settingsOpen && !rebindingTarget) {
    const dirs = ['left', 'down', 'up', 'right'];
    spawnPlayerArrow();
    playerKeys[dirs[d]] = true;
  }
});

document.addEventListener('keyup', e => {
  // Menu easter egg: release direction
  const d = KM[e.key];
  if (d !== undefined && playerArrow) {
    const dirs = ['left', 'down', 'up', 'right'];
    playerKeys[dirs[d]] = false;
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
