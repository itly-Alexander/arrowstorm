// ═══════════════════════════════════════════
//  MENU & RESULTS SCREENS
// ═══════════════════════════════════════════
function showMenu() {
  cleanup();
  document.getElementById('menu').style.display = 'flex';
  document.getElementById('game').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('waiting')?.classList.add('hidden');
}

// ═══════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════
function showResults() {
  if (gRAF) cancelAnimationFrame(gRAF);
  cleanup();

  document.getElementById('game').style.display = 'none';
  document.getElementById('results').style.display = 'flex';

  document.getElementById('rsn').textContent = DIFF[curDiff].label;
  document.getElementById('rsc').textContent = gScore.toLocaleString();
  document.getElementById('rp').textContent = gJdg.perfect;
  document.getElementById('rg').textContent = gJdg.great;
  document.getElementById('ro').textContent = gJdg.good;
  document.getElementById('rm').textContent = gJdg.miss;
  document.getElementById('rmc').textContent = gMaxCombo;

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
