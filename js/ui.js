// ═══════════════════════════════════════════
//  TUTORIAL
// ═══════════════════════════════════════════
let tutorialPendingDiff = null;

function shouldShowTutorial() {
  return !localStorage.getItem('arrowstorm_tutorial_seen');
}

function showTutorial(diff) {
  tutorialPendingDiff = diff;
  document.getElementById('tutorial').classList.add('show');
}

function closeTutorialToMenu() {
  tutorialPendingDiff = null;
  document.getElementById('tutorial').classList.remove('show');
  showMenu();
}

function closeTutorial() {
  localStorage.setItem('arrowstorm_tutorial_seen', '1');
  document.getElementById('tutorial').classList.remove('show');
  if (tutorialPendingDiff) {
    const diff = tutorialPendingDiff;
    tutorialPendingDiff = null;
    startLiveAfterTutorial(diff);
  }
}

// ═══════════════════════════════════════════
//  MODE & DIFFICULTY SELECTION
// ═══════════════════════════════════════════
function showDiffSelect(mode) {
  gameMode = mode;
  document.getElementById('mode-select').style.display = 'none';
  document.getElementById('diff-select').style.display = 'flex';
  document.getElementById('diff-title').textContent =
    mode === 'strike' ? 'STRIKE \u2014 Select Difficulty' : 'CLASSIC \u2014 Select Difficulty';

  const info = document.getElementById('game-info');
  if (mode === 'strike') {
    info.innerHTML =
      'Click circles synced to the beat \u2014 share a browser tab playing music.<br>' +
      'Move your mouse and click (or press Z/X) when the approach ring shrinks to the circle.<br><br>' +
      'Mouse / <kbd>Z</kbd><kbd>X</kbd> to hit &nbsp;|&nbsp; <kbd>Esc</kbd> quit';
  } else {
    info.innerHTML =
      'Hit arrows synced to the beat \u2014 share a browser tab playing music.<br>' +
      'The source tab is muted automatically. Music plays through the game.<br><br>' +
      '<kbd>\u2190</kbd><kbd>\u2193</kbd><kbd>\u2191</kbd><kbd>\u2192</kbd> or <kbd>D</kbd><kbd>F</kbd><kbd>J</kbd><kbd>K</kbd> &nbsp;|&nbsp; <kbd>Esc</kbd> quit';
  }
}

function showModeSelect() {
  document.getElementById('mode-select').style.display = 'flex';
  document.getElementById('diff-select').style.display = 'none';
  document.getElementById('game-info').innerHTML =
    'Share a browser tab playing music (Spotify, YouTube, etc.).<br>' +
    'The source tab is muted automatically. Music plays through the game synced to the beat.<br><br>' +
    '<kbd>\u2190</kbd><kbd>\u2193</kbd><kbd>\u2191</kbd><kbd>\u2192</kbd> or <kbd>D</kbd><kbd>F</kbd><kbd>J</kbd><kbd>K</kbd> &nbsp;|&nbsp; <kbd>Esc</kbd> quit';
}

// ═══════════════════════════════════════════
//  MENU & RESULTS SCREENS
// ═══════════════════════════════════════════
function showMenu() {
  cleanup();
  document.getElementById('menu').style.display = 'flex';
  document.getElementById('game').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('waiting')?.classList.add('hidden');
  showModeSelect();
}

// ═══════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════
function showResults() {
  if (gRAF) cancelAnimationFrame(gRAF);
  cleanup();

  document.getElementById('game').style.display = 'none';
  document.getElementById('results').style.display = 'flex';

  const modeLabel = gameMode === 'strike' ? 'Strike' : 'Classic';
  document.getElementById('rsn').textContent = modeLabel + ' \u2014 ' + DIFF[curDiff].label;
  document.getElementById('rsc').textContent = gScore.toLocaleString();
  document.getElementById('rp').textContent = gJdg.perfect;
  document.getElementById('rg').textContent = gJdg.great;
  document.getElementById('ro').textContent = gJdg.good;
  document.getElementById('rm').textContent = gJdg.miss;
  document.getElementById('rmc').textContent = gMaxCombo;

  // Adjust labels for strike mode
  if (gameMode === 'strike') {
    document.getElementById('rl-p').textContent = 'Perfect';
    document.getElementById('rl-g').style.display = '';
    document.getElementById('rg').style.display = '';
    document.getElementById('rl-o').style.display = '';
    document.getElementById('ro').style.display = '';
    document.getElementById('rl-m').textContent = 'Miss';
  } else {
    document.getElementById('rl-p').textContent = 'Perfect';
    document.getElementById('rl-g').style.display = '';
    document.getElementById('rg').style.display = '';
    document.getElementById('rl-o').style.display = '';
    document.getElementById('ro').style.display = '';
    document.getElementById('rl-m').textContent = 'Miss';
  }

  const tj = gJdg.perfect + gJdg.great + gJdg.good + gJdg.miss;
  const acc = tj > 0 ? ((gJdg.perfect*100 + gJdg.great*70 + gJdg.good*40) / (tj*100) * 100) : 100;
  document.getElementById('rac').textContent = acc.toFixed(1) + '%';

  let gr, gc;
  if (acc >= 95) { gr='S'; gc='#76ff03'; }
  else if (acc >= 85) { gr='A'; gc='#00e5ff'; }
  else if (acc >= 70) { gr='B'; gc='#ffab00'; }
  else if (acc >= 50) { gr='C'; gc='#ff9100'; }
  else { gr='D'; gc='#ff2d55'; }

  const ge = document.getElementById('rgr');
  ge.textContent = gr; ge.style.color = gc; ge.style.textShadow = `0 0 40px ${gc}`;
}
