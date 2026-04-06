// ═══════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════

// Game state
let gActive = false, gStart = 0, gNotes = [], gScore = 0, gCombo = 0, gMaxCombo = 0;
let gJdg = {perfect:0,great:0,good:0,miss:0};
let gRAF, gCanvas, gCtx;
let rFlash = {left:0,down:0,up:0,right:0};
let jTimer = 0;
let curDiff = 'normal';
let gameMode = 'classic'; // 'classic' | 'strike' | 'typing'

// Strike mode state
let sCursorX = 0, sCursorY = 0; // mouse position
let sLastX = 0, sLastY = 0;     // last spawned circle position

// Live audio state
let mediaStream, audioCtx, analyser, scriptNode, delayNode;
let vizAnalyser = null; // second analyser on the DELAYED audio — drives visual beat effects
let bassAnalyser = null; // third analyser — low smoothing for punchy bass hit detection
let liveRecordStart = 0;
let prevSpec = null;
let lastOnsetTime = -Infinity;
let prevDir = -1, ppDir = -1;
let typingWord = '';         // current word being spawned letter by letter
let typingWordIdx = 0;       // index of next letter to spawn
let typingLetters = '';      // concatenated letters from all spawned words
let typingLettersPos = 0;    // how many letters the player has typed
let typingScrollX = 0;       // smooth scroll offset (pixels)
let noteIdCounter = 0;
let analyserLatency = 0;
let liveEnergyData = [];
let streamEnded = false;
let musicDetected = false;
let runningEnergyAvg = 0;
let lastDirTime = [0, 0, 0, 0]; // last time each direction was spawned
