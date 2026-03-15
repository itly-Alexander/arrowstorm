// ═══════════════════════════════════════════
//  DIRECTION PATTERNS & ARROW SPAWNING
// ═══════════════════════════════════════════

// Direction pattern state
let patternType = 'random'; // current active pattern
let patternCounter = 0;     // notes in current pattern
let patternLen = 0;         // target length of current pattern
let patternData = null;     // pattern-specific state

const PATTERNS = {
  // Pure random — any direction, no relation to previous
  random(band) {
    return Math.floor(Math.random() * 4);
  },
  // Zigzag between two columns: e.g. left-right-left-right or down-up-down-up
  zigzag(band) {
    if (!patternData) patternData = { a: Math.floor(Math.random()*4), b: 0 };
    if (!patternData.b || patternData.b === patternData.a) {
      patternData.b = [0,1,2,3].filter(x => x !== patternData.a)[Math.floor(Math.random()*3)];
    }
    return patternCounter % 2 === 0 ? patternData.a : patternData.b;
  },
  // Trill: rapid alternation between two adjacent columns
  trill(band) {
    if (!patternData) {
      const base = Math.floor(Math.random() * 3);
      patternData = { a: base, b: base + 1 };
    }
    return patternCounter % 2 === 0 ? patternData.a : patternData.b;
  },
  // Sweep: move in one direction across all 4 columns then reverse
  sweep(band) {
    if (!patternData) patternData = { dir: Math.random() < 0.5 ? 1 : -1, pos: Math.random() < 0.5 ? 0 : 3 };
    const d = patternData.pos;
    patternData.pos += patternData.dir;
    if (patternData.pos > 3) { patternData.pos = 2; patternData.dir = -1; }
    if (patternData.pos < 0) { patternData.pos = 1; patternData.dir = 1; }
    return d;
  },
  // Jump: big jumps across the columns (0→2, 1→3, 3→0, etc)
  jump(band) {
    const jumps = [[0,2],[2,0],[1,3],[3,1],[0,3],[3,0]];
    if (!patternData) patternData = { pair: jumps[Math.floor(Math.random()*jumps.length)], idx: 0 };
    const d = patternData.pair[patternData.idx % 2];
    patternData.idx++;
    if (patternData.idx >= 4) patternData.pair = jumps[Math.floor(Math.random()*jumps.length)];
    return d;
  },
  // Mirror: symmetric patterns — left+right feel, down+up feel
  mirror(band) {
    const seqs = [[0,3,0,3],[1,2,1,2],[0,3,1,2],[3,0,2,1],[0,1,3,2]];
    if (!patternData) patternData = { seq: seqs[Math.floor(Math.random()*seqs.length)], idx: 0 };
    const d = patternData.seq[patternData.idx % patternData.seq.length];
    patternData.idx++;
    return d;
  },
  // Band-biased: follow the frequency content but with randomness
  bandBias(band) {
    if (band === 'bass') return [0,0,1,1,0,1,3,2][Math.floor(Math.random()*8)];
    if (band === 'high') return [2,3,2,3,3,2,0,1][Math.floor(Math.random()*8)];
    return Math.floor(Math.random() * 4);
  }
};

function pickNewPattern() {
  const types = Object.keys(PATTERNS);
  // Weight toward more interesting patterns, less toward pure random
  const weights = { random: 1, zigzag: 3, trill: 2, sweep: 2, jump: 3, mirror: 3, bandBias: 2 };
  const pool = [];
  for (const t of types) { for (let i = 0; i < (weights[t]||1); i++) pool.push(t); }
  // Don't repeat the same pattern twice in a row
  let pick;
  do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (pick === patternType && pool.length > 1);
  patternType = pick;
  patternCounter = 0;
  patternLen = 3 + Math.floor(Math.random() * 6); // 3-8 notes per pattern
  patternData = null;
}

// Chord presets — musically sensible multi-arrow combinations
const CHORDS_2 = [[0,1],[1,2],[2,3],[0,3],[0,2],[1,3]]; // doubles: L+D, D+U, U+R, L+R, L+U, D+R
const CHORDS_3 = [[0,1,2],[1,2,3],[0,2,3],[0,1,3]]; // triples

function spawnArrow(audioTime, band, onsetStrength) {
  const C = DIFF[curDiff];

  // Decide if this should be a chord based on onset strength and difficulty
  let arrowDirs;
  const isVeryStrong = onsetStrength > 2.5;
  const isStrong = onsetStrength > 1.8;

  if (isVeryStrong && Math.random() < C.tripleChance) {
    arrowDirs = CHORDS_3[Math.floor(Math.random() * CHORDS_3.length)];
  } else if (isStrong && Math.random() < C.chordChance) {
    arrowDirs = CHORDS_2[Math.floor(Math.random() * CHORDS_2.length)];
  } else {
    // Single arrow — use pattern system
    if (patternCounter >= patternLen) pickNewPattern();
    let d = PATTERNS[patternType](band);
    patternCounter++;
    d = Math.max(0, Math.min(3, d));

    // Enforce same-direction minimum gap — if this direction was used too recently, pick another
    if (audioTime - lastDirTime[d] < C.sameGap) {
      // Find directions that are available (not used too recently)
      const available = [0,1,2,3].filter(x => audioTime - lastDirTime[x] >= C.sameGap);
      if (available.length > 0) {
        d = available[Math.floor(Math.random() * available.length)];
      } else {
        // All directions used recently — pick the one used longest ago
        let oldest = 0;
        for (let i = 1; i < 4; i++) { if (lastDirTime[i] < lastDirTime[oldest]) oldest = i; }
        d = oldest;
      }
    }

    // Also avoid 3 in a row
    if (d === prevDir && d === ppDir) {
      const others = [0,1,2,3].filter(x => x !== d && audioTime - lastDirTime[x] >= C.sameGap * 0.5);
      if (others.length > 0) d = others[Math.floor(Math.random() * others.length)];
    }

    ppDir = prevDir;
    prevDir = d;
    arrowDirs = [d];
  }

  // Spawn notes and track direction timestamps
  const hitTime = audioTime + AUDIO_DELAY;
  const chordId = noteIdCounter++;
  for (const d of arrowDirs) {
    lastDirTime[d] = audioTime;
    gNotes.push({
      time: hitTime,
      dir: d,
      id: noteIdCounter++,
      chordId: chordId,
      hit: false,
      missed: false,
      y: 0
    });
  }
}
