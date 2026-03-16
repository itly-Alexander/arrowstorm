const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const DIST = path.join(__dirname, 'dist');

// JS files in load order (must match index.html script tags)
const JS_FILES = [
  'js/version.js',
  'js/config.js',
  'js/state.js',
  'js/audio.js',
  'js/patterns.js',
  'js/particles.js',
  'js/game.js',
  'js/ui.js',
  'js/settings.js',
  'js/easter.js',
  'js/input.js',
  'js/main.js'
];

// Clean & create dist
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// Concatenate all JS
const bundle = JS_FILES.map(f => {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  return `// --- ${f} ---\n${code}`;
}).join('\n\n');

// Obfuscate
console.log('Obfuscating...');
const obfuscated = JavaScriptObfuscator.obfuscate(bundle, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  stringArray: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.5,
  stringArrayEncoding: ['base64'],
  splitStrings: true,
  splitStringsChunkLength: 8,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,       // keep globals — HTML onclick handlers reference them
  selfDefending: false,       // avoid breaking in dev tools
  transformObjectKeys: true,
  unicodeEscapeSequence: false
});

fs.writeFileSync(path.join(DIST, 'game.js'), obfuscated.getObfuscatedCode());
console.log('  -> dist/game.js');

// Build index.html — replace individual script tags with single bundle
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
// Remove all individual script tags
const firstScript = html.indexOf('<script src="js/version.js">');
const lastScript = html.lastIndexOf('</script>', html.indexOf('</body>'));
const beforeScripts = html.substring(0, firstScript);
const afterScripts = html.substring(lastScript + '</script>'.length);
html = beforeScripts + '<script src="game.js"></script>' + afterScripts;
fs.writeFileSync(path.join(DIST, 'index.html'), html);
console.log('  -> dist/index.html');

// Copy static assets
fs.cpSync(path.join(__dirname, 'css'), path.join(DIST, 'css'), { recursive: true });
console.log('  -> dist/css/');
if (fs.existsSync(path.join(__dirname, 'favicon.svg'))) {
  fs.copyFileSync(path.join(__dirname, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
  console.log('  -> dist/favicon.svg');
}

const srcSize = (bundle.length / 1024).toFixed(1);
const outSize = (obfuscated.getObfuscatedCode().length / 1024).toFixed(1);
console.log(`\nDone! ${srcSize}KB -> ${outSize}KB`);
console.log('Deploy the dist/ folder to GitHub Pages.');
