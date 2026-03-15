// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
const DIFF = {
  // transientTh: spike sharpness required (lower = more arrows). sameGap: extra gap for same-direction repeats.
  easy:      { subdiv:1, minGap:.38, sameGap:.60, burstChance:0,   chordChance:0,   tripleChance:0,    energyScale:0.2, transientTh:2.5,  label:'Easy' },
  normal:    { subdiv:2, minGap:.22, sameGap:.40, burstChance:.06,  chordChance:.05, tripleChance:0,    energyScale:0.3, transientTh:2.0,  label:'Normal' },
  hard:      { subdiv:3, minGap:.15, sameGap:.28, burstChance:.12,  chordChance:.10, tripleChance:.02,  energyScale:0.4, transientTh:1.7,  label:'Hard' },
  extreme:   { subdiv:4, minGap:.09, sameGap:.18, burstChance:.20,  chordChance:.20, tripleChance:.06,  energyScale:0.55,transientTh:1.4,  label:'Extreme' },
  impossible:{ subdiv:8, minGap:.05, sameGap:.12, burstChance:.32,  chordChance:.30, tripleChance:.12,  energyScale:0.7, transientTh:1.2,  label:'Impossible' }
};

const SENS = 1.5; // onset detection sensitivity — higher = stricter = fewer arrows
const DIRS = ['left','down','up','right'];
const ACOL = {
  left:{m:'#ff2d55',g:'rgba(255,45,85,.6)'},down:{m:'#00e5ff',g:'rgba(0,229,255,.6)'},
  up:{m:'#76ff03',g:'rgba(118,255,3,.6)'},right:{m:'#ffab00',g:'rgba(255,171,0,.6)'}
};
const JDG = {
  perfect:{w:45,s:100,c:'#76ff03',t:'PERFECT'},great:{w:90,s:70,c:'#00e5ff',t:'GREAT'},
  good:{w:135,s:40,c:'#ffab00',t:'GOOD'},miss:{w:180,s:0,c:'#ff2d55',t:'MISS'}
};

const RY = 80, NSPD = 600, CW = 70, NS = 56;
const AUDIO_DELAY = 3.0; // seconds — audio plays through game this many seconds after capture
