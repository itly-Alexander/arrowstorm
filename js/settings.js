// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════

const BG_THEMES = {
  default: {
    label: 'Default (Blue)',
    base:  [10, 10, 18],   // bg base RGB
    mid:   [13, 13, 24],   // mid gradient RGB
    bassShift: [0, 0, 30], // additive on bass
    midShift:  [0, 0, 20],
    highShift: [0, 0, 20],
    pulseShift:[15, 0, 0],
  },
  red: {
    label: 'Crimson',
    base:  [18, 10, 10],
    mid:   [24, 13, 15],
    bassShift: [30, 0, 0],
    midShift:  [20, 5, 0],
    highShift: [15, 0, 5],
    pulseShift:[0, 0, 15],
  },
  green: {
    label: 'Emerald',
    base:  [10, 18, 12],
    mid:   [13, 24, 15],
    bassShift: [0, 30, 5],
    midShift:  [0, 20, 5],
    highShift: [5, 20, 0],
    pulseShift:[0, 15, 0],
  }
};

const DEFAULT_KEYBINDS = {
  left:  ['ArrowLeft', 'd'],
  down:  ['ArrowDown', 'f'],
  up:    ['ArrowUp', 'j'],
  right: ['ArrowRight', 'k']
};

let settings = {
  bgTheme: 'default',
  keybinds: JSON.parse(JSON.stringify(DEFAULT_KEYBINDS))
};

function loadSettings() {
  const saved = localStorage.getItem('arrowstorm_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.bgTheme && BG_THEMES[parsed.bgTheme]) settings.bgTheme = parsed.bgTheme;
      if (parsed.keybinds) settings.keybinds = parsed.keybinds;
    } catch(e) {}
  }
  applySettings();
}

function saveSettings() {
  localStorage.setItem('arrowstorm_settings', JSON.stringify(settings));
}

function applySettings() {
  rebuildKeyMap();
  updateSettingsUI();
  updateMenuKeybindDisplay();
}

function rebuildKeyMap() {
  // Clear all entries
  for (const k in KM) delete KM[k];
  // Rebuild from settings
  const dirs = { left: 0, down: 1, up: 2, right: 3 };
  for (const dir in settings.keybinds) {
    for (const key of settings.keybinds[dir]) {
      KM[key] = dirs[dir];
      // Add uppercase variant for letter keys
      if (key.length === 1) KM[key.toUpperCase()] = dirs[dir];
    }
  }
}

function getBgTheme() {
  return BG_THEMES[settings.bgTheme] || BG_THEMES.default;
}

// ═══════════════════════════════════════════
//  SETTINGS UI
// ═══════════════════════════════════════════
let settingsOpen = false;
let rebindingTarget = null; // e.g. { dir: 'left', slot: 0 }

function openSettings() {
  settingsOpen = true;
  document.getElementById('settings-panel').classList.add('show');
  updateSettingsUI();
}

function closeSettings() {
  settingsOpen = false;
  rebindingTarget = null;
  document.getElementById('settings-panel').classList.remove('show');
  // Clear any active rebind highlights
  document.querySelectorAll('.kb-key.listening').forEach(el => el.classList.remove('listening'));
}

function updateSettingsUI() {
  // Background theme buttons
  document.querySelectorAll('.bg-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === settings.bgTheme);
  });
  // Keybind display
  const dirs = ['left', 'down', 'up', 'right'];
  for (const dir of dirs) {
    const keys = settings.keybinds[dir];
    for (let i = 0; i < 2; i++) {
      const el = document.getElementById(`kb-${dir}-${i}`);
      if (el) el.textContent = formatKey(keys[i] || '');
    }
  }
}

function updateMenuKeybindDisplay() {
  const el = document.querySelector('.info');
  if (!el) return;
  const kb = settings.keybinds;
  const fmt = k => `<kbd>${formatKey(k)}</kbd>`;
  const primary = `${fmt(kb.left[0])}${fmt(kb.down[0])}${fmt(kb.up[0])}${fmt(kb.right[0])}`;
  const secondary = `${fmt(kb.left[1])}${fmt(kb.down[1])}${fmt(kb.up[1])}${fmt(kb.right[1])}`;
  el.innerHTML = `Pick difficulty → share a browser tab playing music (Spotify, YouTube, etc.).<br>
    The source tab is muted automatically. Music plays through the game with arrows synced to the beat.<br><br>
    ${primary} or ${secondary} &nbsp;|&nbsp; <kbd>Esc</kbd> quit`;
}

function formatKey(key) {
  const map = {
    'ArrowLeft': '←', 'ArrowDown': '↓', 'ArrowUp': '↑', 'ArrowRight': '→',
    ' ': 'Space', 'Enter': '↵'
  };
  return map[key] || key.toUpperCase();
}

function selectBgTheme(theme) {
  settings.bgTheme = theme;
  saveSettings();
  applySettings();
}

function startRebind(dir, slot) {
  // Cancel previous rebind if any
  document.querySelectorAll('.kb-key.listening').forEach(el => el.classList.remove('listening'));
  rebindingTarget = { dir, slot };
  const el = document.getElementById(`kb-${dir}-${slot}`);
  if (el) {
    el.textContent = '...';
    el.classList.add('listening');
  }
}

function handleRebindKey(e) {
  if (!rebindingTarget) return false;
  e.preventDefault();
  e.stopPropagation();

  const key = e.key;
  if (key === 'Escape') {
    // Cancel rebind
    const el = document.getElementById(`kb-${rebindingTarget.dir}-${rebindingTarget.slot}`);
    if (el) el.classList.remove('listening');
    rebindingTarget = null;
    updateSettingsUI();
    return true;
  }

  // Remove this key from any other binding to avoid conflicts
  for (const dir in settings.keybinds) {
    settings.keybinds[dir] = settings.keybinds[dir].filter(k =>
      k.toLowerCase() !== key.toLowerCase()
    );
  }

  // Set the new key
  settings.keybinds[rebindingTarget.dir][rebindingTarget.slot] = key;

  const el = document.getElementById(`kb-${rebindingTarget.dir}-${rebindingTarget.slot}`);
  if (el) el.classList.remove('listening');
  rebindingTarget = null;

  saveSettings();
  applySettings();
  return true;
}

function resetKeybinds() {
  settings.keybinds = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
  saveSettings();
  applySettings();
}
