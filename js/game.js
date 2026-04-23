// ── CANVAS SETUP ─────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('gameWrapper');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Use window dimensions in fullscreen since wrapper may not have updated yet
  const isFS = document.fullscreenElement || document.webkitFullscreenElement;
  const w = isFS ? window.innerWidth : wrapper.offsetWidth;
  const h = isFS ? window.innerHeight : wrapper.offsetHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  // Lock virtual height to a fixed 650px to keep consistent field of view
  const GAME_HEIGHT = 650;
  const scale = h / GAME_HEIGHT;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  canvas._logicalW = w / scale;
  canvas._logicalH = GAME_HEIGHT;
}
resize();
window.addEventListener('resize', () => { resize(); if (state !== 'playing') drawBG(); });
Object.defineProperty(canvas, 'gameW', { get() { return this._logicalW || wrapper.offsetWidth; } });
Object.defineProperty(canvas, 'gameH', { get() { return this._logicalH || wrapper.offsetHeight; } });

// ── CONSTANTS ────────────────────────────────
const GRAVITY = 0.45, THRUST = -0.56, MAX_FALL = 8.5, MAX_RISE = -7;
let BASE_SPEED = 5;
const GROUND_RATIO = 0.72, TARGET_DT = 1000 / 60;

// ── STATE ────────────────────────────────────
let state = 'start', score = 0, distance = 0, runCoins = 0;
let frame = 0, speed = 0, bgX = 0;
let hearts = 5, invincible = 0;
let gameMode = 'beginner'; // 'beginner' or 'pro'
let activePU = null, puTimer = 0, puMaxTime = 0;
let shieldActive = false;
let graceFrames = 0, lastT = 0, loopRunning = false;
// Boss system
let boss = null, bossDefeated = [false, false, false, false, false], bossWarning = 0;
let finalBossWarningTriggered = false;
let isHolding = false, startClickGuard = false;
let curBiome = 'bridge'; window.curBiome = curBiome;
let banner = { text: '', timer: 0 }; window.banner = banner;
// Screen effects
let screenShake = 0;
let floatingTexts = [];
let petObj = null, playerBullets = [];
let bossFlash = 0;

// DOM
const distEl = document.getElementById('distVal');
const coinEl = document.getElementById('coinVal');
const heartsEl = document.getElementById('heartsDisplay');
const puBarEl = document.getElementById('puBar');
const puIconEl = document.getElementById('puIcon');
const puFillEl = document.getElementById('puFill');

// KD and toK are defined in ui.js (loaded first)
function toKhmer(n) { return String(n).split('').map(d => isNaN(d) ? d : KD[+d]).join(''); }

// ── BIOMES ───────────────────────────────────
const BIOMES = [
  { id: 'bridge', label: '🛤️ Jungle Outpost', minDist: 0 },
  { id: 'village', label: '🛕 Angkor Wat', minDist: 1000 },
  { id: 'forest', label: '🏛️ God Valley', minDist: 2000 },
  { id: 'city', label: '⚔️ Secret Catacombs', minDist: 3000 },
  { id: 'mountain', label: '🌋 Volcanic Depths', minDist: 4000 },
  { id: 'ocean', label: '🐉 Dragon\'s Peak', minDist: 5000 },
  { id: 'neon_city', label: '🌃 Neon Outskirts', minDist: 7000 },
  { id: 'cyber_wasteland', label: '☢️ Cyber Wasteland', minDist: 15000 },
  { id: 'crystal_caverns', label: '💠 Crystal Caverns', minDist: 19000 },
  { id: 'void_realm', label: '🌌 The Void Realm', minDist: 25000 },
  { id: 'glitch_matrix', label: '📟 Glitch Matrix', minDist: 28000 },
  { id: 'celestial_gates', label: '✨ Celestial Gates', minDist: 35000 },
  { id: 'solar_flare', label: '☀️ Solar Flare', minDist: 37000 },
  { id: 'singularity_core', label: '🌀 Singularity Core', minDist: 50000 }
];
function getBiome(d) { let b = BIOMES[0]; for (const bi of BIOMES) if (d >= bi.minDist) b = bi; return b.id; }
function checkBiome() {
  const nb = getBiome(distance);
  if (nb === curBiome) return;
  curBiome = nb; window.curBiome = nb;
  const info = BIOMES.find(b => b.id === nb);
  banner = { text: info.label, timer: 220 }; window.banner = banner;
  startMusic(nb); sfx.biome();
}

// ── PLAYER ───────────────────────────────────
const player = { x: 0, y: 0, vy: 0, w: 44, h: 52, onGround: false, runFrame: 0, scarf: 0, trail: [] };

// ── OBJECTS ──────────────────────────────────
let obstacles = [], coins = [], pickups = [], heartPacks = [], particles = [], missiles = [], missileWarnings = [];
let enemies = [], enemyBullets = [];

// ── INPUT ────────────────────────────────────
function onInputStart(e) {
  if (e) e.preventDefault();
  isHolding = true;
  if (state === 'playing' && graceFrames > 0) graceFrames = 0;
  if (state === 'playing') { initAudio(); startJetpackSound(); }
}
function onInputEnd(e) {
  if (e && e.touches && e.touches.length > 0) return;
  if (e) e.preventDefault();
  isHolding = false;
  stopJetpackSound();
}
canvas.addEventListener('pointerdown', onInputStart);
canvas.addEventListener('pointerup', onInputEnd);
canvas.addEventListener('pointercancel', onInputEnd);
canvas.addEventListener('pointerleave', onInputEnd);

// Explicit mobile touch support
canvas.addEventListener('touchstart', onInputStart, { passive: false });
canvas.addEventListener('touchend', onInputEnd, { passive: false });
canvas.addEventListener('touchcancel', onInputEnd, { passive: false });
document.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    e.preventDefault();
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if ((e.code === 'Space' || e.code === 'ArrowUp') && state === 'playing') { e.preventDefault(); onInputStart(); }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onInputEnd(); }
});

// Buttons
document.getElementById('startBtn').addEventListener('click', e => {
  e.stopPropagation(); initAudio();
  document.getElementById('difficultyOverlay').classList.remove('hidden');
});
document.getElementById('restartBtn').addEventListener('click', e => {
  e.stopPropagation(); initAudio();
  document.getElementById('difficultyOverlay').classList.remove('hidden');
});

// Difficulty Selection
document.getElementById('diffClose').addEventListener('click', () => {
  document.getElementById('difficultyOverlay').classList.add('hidden');
});
document.getElementById('diffBeginnerBtn').addEventListener('click', e => {
  e.stopPropagation();
  gameMode = 'beginner';
  document.getElementById('difficultyOverlay').classList.add('hidden');
  startClickGuard = true; setTimeout(() => startClickGuard = false, 150);
  startGame();
});
document.getElementById('diffProBtn').addEventListener('click', e => {
  e.stopPropagation();
  gameMode = 'pro';
  document.getElementById('difficultyOverlay').classList.add('hidden');
  startClickGuard = true; setTimeout(() => startClickGuard = false, 150);
  startGame();
});
document.getElementById('homeBtn').addEventListener('click', e => {
  e.stopPropagation(); goHome();
});

// Victory Mechanics
document.getElementById('victoryGiftBox').addEventListener('click', e => {
  e.stopPropagation();
  // Open gift!
  sfx.tada();
  document.getElementById('victoryGiftBox').style.pointerEvents = 'none'; // disable clicks
  document.getElementById('giftEmoji').textContent = '🌟';
  document.getElementById('giftPulse').classList.add('hidden');
  document.getElementById('victoryGiftReward').classList.remove('hidden');
  
  // Award 15k!
  runCoins += 15000;
  addCoins(15000);
  
  // Show buttons
  document.getElementById('victoryButtons').classList.remove('hidden');
  
  // If pro mode, hide "Next Level to Pro" button
  if (gameMode === 'pro') {
    document.getElementById('victoryNextLevelBtn').style.display = 'none';
  } else {
    document.getElementById('victoryNextLevelBtn').style.display = 'inline-block';
  }
});
document.getElementById('victoryNextLevelBtn').addEventListener('click', e => {
  e.stopPropagation();
  gameMode = 'pro';
  document.getElementById('victoryScreen').classList.add('hidden');
  startClickGuard = true; setTimeout(() => startClickGuard = false, 150);
  startGame();
});
document.getElementById('victoryHomeBtn').addEventListener('click', e => {
  e.stopPropagation(); 
  document.getElementById('victoryScreen').classList.add('hidden');
  goHome();
});

document.getElementById('muteBtn').addEventListener('click', e => {
  e.stopPropagation();
  const isMuted = toggleMute(state);
  document.getElementById('muteBtn').innerHTML = isMuted
    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="1" x2="1" y2="23"/></svg>'
    : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
});
document.getElementById('fullscreenBtn').addEventListener('click', e => {
  e.stopPropagation();
  const el = document.documentElement;
  const isFS = document.fullscreenElement || document.webkitFullscreenElement;
  if (!isFS) {
    (el.requestFullscreen || el.webkitRequestFullscreen || function () { }).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || function () { }).call(document);
  }
});
document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('fullscreenBtn');
  btn.innerHTML = document.fullscreenElement
    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
    : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  btn.style.opacity = document.fullscreenElement ? '1' : '0.7';
  setTimeout(() => { resize(); if (state !== 'playing') drawBG(); }, 150);
});
document.addEventListener('webkitfullscreenchange', () => {
  const btn = document.getElementById('fullscreenBtn');
  btn.style.opacity = document.webkitFullscreenElement ? '1' : '0.7';
  setTimeout(() => { resize(); if (state !== 'playing') drawBG(); }, 150);
});
document.getElementById('resumeBtn').addEventListener('click', e => {
  e.stopPropagation(); resumeGame();
});
document.getElementById('quitBtn').addEventListener('click', e => {
  e.stopPropagation(); goHome();
});
document.getElementById('pauseBtnHUD').addEventListener('click', e => {
  e.stopPropagation();
  if (state === 'playing') pauseGame();
});

// ── SPAWN ────────────────────────────────────
function spawnLaser(overrideType = null) {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;

  const isHoriz = (overrideType === 'horiz') || (overrideType !== 'vert' && Math.random() < 0.35);

  if (isHoriz) {
    // Cyberpunk Horizontal Laser Emitter
    const y = 40 + Math.random() * (gY - 80);
    obstacles.push({ type: 'laser_horiz', x: 0, y: y, beamH: 26, w: W, warningTimer: 80, beamOn: false, passed: false, life: 35 });
    sfx.laserCharge();
  } else {
    // Dynamic Volleys based on difficulty
    let count = 1;
    const thresh = gameMode === 'pro' ? 1000 : 1500;
    if (distance > thresh) {
      const roll = Math.random();
      if (gameMode === 'pro') {
        if (roll < 0.3) count = 2;
      } else {
        if (roll < 0.1) count = 2;
      }
    }

    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let beamH = 80 + Math.random() * 40; // Short
      if (r > 0.35) beamH = 150 + Math.random() * 100; // Medium
      if (count === 1 && r > 0.75) beamH = 300 + Math.random() * 100; // Mega-Blade (only solo)

      const y = 20 + Math.random() * (gY - beamH - 40);
      const offsetX = i * (80 + Math.random() * 40);

      obstacles.push({
        type: 'laser', x: W + 40 + offsetX, cy: y + beamH / 2, len: beamH,
        w: 22, warningTimer: 40, beamOn: false, passed: false,
        angle: 0, spinSpeed: (Math.random() - 0.5) * 0.03 // Dynamic rotation!
      });
    }
  }
}
function spawnElectric() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;

  // Dynamic Volleys
  let count = 1;
  const roll = Math.random();
  const thresh = gameMode === 'pro' ? 1000 : 1500;
  // Zappers never spawn in clusters in either mode anymore based on user feedback.
  // Count will remain 1 forever.

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let len = 60 + Math.random() * 20; // Small
    if (r > 0.35) len = 120 + Math.random() * 50; // Average
    if (count === 1 && r > 0.75) len = 220 + Math.random() * 80; // Ultra tall only when solo

    // Choose placement type: 0 = ceiling, 1 = floor, 2 = floating
    const placement = Math.floor(Math.random() * 3);
    let cy;
    if (placement === 0) {
      cy = Math.max(20, len / 2 - 10);
    } else if (placement === 1) {
      cy = Math.min(gY - 20, gY - len / 2 + 10);
    } else {
      cy = len / 2 + Math.random() * Math.max(10, gY - len);
    }

    // Logic for Floating Zappers: can be Spinning, Horizontal, or Vertical
    let baseAngle = 0;
    let spinSpeed = 0;
    if (placement === 2) {
      const rollType = Math.random();
      if (rollType < 0.33) {
        spinSpeed = (Math.random() > 0.5 ? 0.03 : -0.03); // Spinning
      } else if (rollType < 0.66) {
        baseAngle = Math.PI / 2; // Fixed Horizontal Zapper
      }
      // Else fixed Vertical Zapper
    }

    // Stagger X coordinates so they form a gauntlet maze!
    const offsetX = i * (90 + Math.random() * 60);

    obstacles.push({ type: 'electric', x: W + 30 + offsetX, cy, len, angle: baseAngle, spinSpeed, w: 24, phase: Math.random() * 6.28, on: true, passed: false });
  }
}
function spawnMissileWarning() {
  const H = canvas.gameH, gY = H * GROUND_RATIO;

  let count = 1;
  const roll = Math.random();

  if (distance > 9000) {
    // 9000+: "not hard also not easy" - stabilizes strictly at 2 missiles max (30% chance)
    if (roll < 0.30) count = 2;
  } else if (distance > 5000) {
    // 5000 to 9000: "not too challenge" - 2 missiles max (15% chance)
    if (roll < 0.15) count = 2;
  } else if (distance > 1000) {
    // 1000 to 5000: "not too challenge" - 2 missiles max (low 8% chance)
    if (roll < 0.08) count = 2;
  }

  for (let i = 0; i < count; i++) {
    // Offset vertically slightly and delay timer so they fire as a barrage
    const ty = Math.max(30, Math.min(gY - 30, player.y + player.h / 2 + (Math.random() - 0.5) * 80));
    const timeOffset = i * 25;
    missileWarnings.push({ timer: 75 + timeOffset, y: ty, speed: speed * 2.2 + 4 + Math.random() * 1.5 });
  }
  sfx.alarm();
}
function spawnMissile(y, spd) {
  const W = canvas.gameW;
  missiles.push({ x: W + 50, y, vx: -spd, w: 60, h: 24, passed: false });
  sfx.missileLaunch();
}
const COIN_GRIDS = [
  // 0: Horizontal Line
  [
    "111111111111"
  ],
  // 1: Diagonal Up
  [
    "000000001",
    "000000010",
    "000000100",
    "000001000",
    "000010000",
    "000100000",
    "001000000",
    "010000000",
    "100000000"
  ],
  // 2: Diagonal Down
  [
    "100000000",
    "010000000",
    "001000000",
    "000100000",
    "000010000",
    "000001000",
    "000000100",
    "000000010",
    "000000001"
  ],
  // 3: V-Shape Drop
  [
    "1000000000001",
    "0100000000010",
    "0010000000100",
    "0001000001000",
    "0000100010000",
    "0000010100000",
    "0000001000000"
  ],
  // 4: Zig-Zag
  [
    "10000000100000001",
    "01000001010000010",
    "00100010001000100",
    "00010100000101000",
    "00001000000010000"
  ],
  // 5: Hexagon / Honeycomb
  [
    "00111100",
    "01000010",
    "10000001",
    "10000001",
    "01000010",
    "00111100"
  ],
  // 6: Heart
  [
    "0110110",
    "1111111",
    "1111111",
    "0111110",
    "0011100",
    "0001000"
  ],
  // 7: Smiley Face
  [
    "00111100",
    "01000010",
    "10100101",
    "10000001",
    "10100101",
    "10011001",
    "01000010",
    "00111100"
  ],
  // 8: Box
  [
    "1111111",
    "1000001",
    "1000001",
    "1000001",
    "1111111"
  ],
  // 9: Cross (X)
  [
    "1000001",
    "0100010",
    "0010100",
    "0001000",
    "0010100",
    "0100010",
    "1000001"
  ],
  // 10: Figure Eight / Infinity
  [
    "01110001110",
    "10001010001",
    "10000100001",
    "10001010001",
    "01110001110"
  ],
  // 11: Circle
  [
    "00011000",
    "01100110",
    "01000010",
    "10000001",
    "10000001",
    "01000010",
    "01100110",
    "00011000"
  ]
];

function spawnCoinPattern() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;

  // Pick random grid pattern
  const grid = COIN_GRIDS[Math.floor(Math.random() * COIN_GRIDS.length)];

  const dX = 28, dY = 28; // Perfect square tiling for overlapping pixel-art style
  const gridW = grid[0].length * dX;
  const gridH = grid.length * dY;

  // Calculate vertical bounds precisely
  const mt = 20; // Ceiling margin
  const mb = 20; // Floor margin

  // 0 = Top Ceiling, 1 = Bottom Floor, 2 = Exact Middle
  const placement = Math.floor(Math.random() * 3);
  let by;
  if (placement === 0) {
    by = mt; // Flush with ceiling
  } else if (placement === 1) {
    by = gY - mb - gridH; // Flush with floor
  } else {
    // Random mid-air sweep
    const maxFloatY = Math.max(mt, gY - mb - gridH);
    by = mt + Math.random() * (maxFloatY - mt);
  }

  const bx = W + 80;

  // Spawn based exactly on the logical pixel grid
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === '1') {
        // Precise tiling, never overlapping
        coins.push({
          x: bx + c * dX,
          y: by + r * dY,
          collected: false,
          bob: 0, // Uniform bobbing so shapes don't distort
          r: 14,
          alpha: 1
        });
      }
    }
  }
}
function spawnPickup() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const types = ['shield', 'speed', 'magnet'];
  pickups.push({ type: types[Math.floor(Math.random() * 3)], x: W + 30, y: 80 + Math.random() * (gY - 160), bob: 0, alpha: 1 });
}
function spawnUltimatePack() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const y = 50 + Math.random() * (gY * 0.5);
  pickups.push({ type: 'ultimate', x: W + 30, y, bob: 0, alpha: 1 });
}
function spawnHeartPack() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  // Spawn heart packs in the air (upper 70% of playable area) to reward flying
  const y = 60 + Math.random() * (gY * 0.55);
  heartPacks.push({ x: W + 30, y, bob: 0, alpha: 1, pulse: Math.random() * 6.28 });
}
function spawnP(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 2 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col, r: 2 + Math.random() * 4 });
  }
}


// ── UI UPDATES ──────────────────────────────
function updateHearts() {
  const hSVG = '<svg width="36" height="36" viewBox="0 0 24 24" fill="#ff2a55" stroke="#ff2a55" stroke-width="1" style="margin-left: 6px; filter:drop-shadow(0 0 4px #ff2a55);"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  heartsEl.innerHTML = hSVG.repeat(hearts);
}
function updateHUD() {
  distEl.textContent = Math.floor(distance) + ' m';
  coinEl.textContent = runCoins;
  const isBossActive = boss && boss.entered && !boss.retreating && !boss.defeated;
  const lAmmo = document.getElementById('laserAmmoVal');
  const mAmmo = document.getElementById('missileAmmoVal');
  if (lAmmo) lAmmo.textContent = isBossActive ? '∞' : `x${player.laserAmmo}`;
  if (mAmmo) mAmmo.textContent = `x${player.missileAmmo}`;
}
function updatePUBar() {
  if (activePU && puTimer > 0) {
    puBarEl.classList.remove('hidden'); puFillEl.style.width = (puTimer / puMaxTime * 100) + '%';
    if (activePU === 'shield') puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
    else if (activePU === 'speed') puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    else if (activePU === 'ultimate') puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    else puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/></svg>';
    if (activePU === 'ultimate') puFillEl.style.background = 'linear-gradient(90deg,#9933ff,#ff44ff,#ffd700)';
    else puFillEl.style.background = '';
  } else { puBarEl.classList.add('hidden'); puFillEl.style.background = ''; }
}

// ── COLLISION ────────────────────────────────
function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }
function checkCollLaser(ob) {
  if (!ob.beamOn) return false;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const cx = ob.x + ob.w / 2;

  // Segment math for rotating laser
  const dx = Math.cos(ob.angle - Math.PI / 2) * (ob.len / 2);
  const dy = Math.sin(ob.angle - Math.PI / 2) * (ob.len / 2);
  const x1 = cx - dx, y1 = ob.cy - dy;
  const x2 = cx + dx, y2 = ob.cy + dy;

  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return dist(px, py, x1, y1) < 15;
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1), projY = y1 + t * (y2 - y1);
  return dist(px, py, projX, projY) < 14;
}
function checkCollLaserHoriz(ob) {
  if (!ob.beamOn) return false;
  const px = player.x + 8, py = player.y + 8, pw = player.w - 16, ph = player.h - 16;
  // Horizontal laser spans screen, vertical collision boundaries rely on ob.y and ob.beamH
  return py < ob.y + ob.beamH && py + ph > ob.y;
}
function checkCollElec(ob) {
  if (!ob.on) return false;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const cx = ob.x + ob.w / 2;

  // Vector math for rotating capsule line collision
  const dx = Math.cos(ob.angle - Math.PI / 2) * (ob.len / 2);
  const dy = Math.sin(ob.angle - Math.PI / 2) * (ob.len / 2);

  const x1 = cx - dx, y1 = ob.cy - dy;
  const x2 = cx + dx, y2 = ob.cy + dy;

  // Closest point on the segment
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return dist(px, py, x1, y1) < 20;

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);

  return dist(px, py, projX, projY) < 18; // Precise 18px hit radius against the line
}
function checkCollMissile(m) {
  const px = player.x + 8, py = player.y + 8, pw = player.w - 16, ph = player.h - 16;
  return px < m.x + m.w && px + pw > m.x - m.w * .3 && py < m.y + m.h / 2 && py + ph > m.y - m.h / 2;
}

function shootPlayerGun() {
  if (state !== 'playing') return;
  const isBossActive = boss && boss.entered && !boss.retreating && !boss.defeated;
  if (!isBossActive) {
    if (player.laserAmmo <= 0) return;
    player.laserAmmo--;
  }

  if (player.shootCooldown > 0) return;
  player.shootCooldown = 15; // Limit fire rate
  player.saberSwing = 1.0;

  const { char } = getSkinColors();
  const playerColor = char.saber || char.glow || '#ff00ff';

  playerBullets.push({
    x: player.x + player.w,
    y: player.y + player.h / 2,
    vx: speed * 2 + 10,
    vy: 0,
    type: 'player_laser',
    life: 1,
    damage: 3, // Increased damage for the saber!
    color: playerColor
  });
  if (sfx.pew) sfx.pew(); else if (sfx.laser) sfx.laser();
}

function shootPlayerMissile() {
  if (state !== 'playing') return;

  if (player.missileAmmo <= 0) return; // 3 ammo limit!

  if (player.missileCooldown > 0) return;
  player.missileCooldown = 20;

  player.missileAmmo--;
  player.saberSwing = 1.0;

  playerBullets.push({
    x: player.x + player.w,
    y: player.y + player.h / 2,
    vx: speed * 1.5 + 5,
    vy: 0,
    type: 'player_missile',
    life: 1,
    damage: 15, // High damage
    timer: 0
  });
  if (sfx.explosion) sfx.explosion(); else if (sfx.pew) sfx.pew();
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z') {
    shootPlayerGun();
  } else if (e.code === 'KeyX' || e.key === 'x' || e.key === 'X') {
    shootPlayerMissile();
  }
});
document.getElementById('shootBtn').addEventListener('touchstart', e => {
  e.preventDefault(); e.stopPropagation();
  shootPlayerGun();
}, { passive: false });
document.getElementById('shootBtn').addEventListener('mousedown', e => {
  e.preventDefault(); e.stopPropagation();
  shootPlayerGun();
});
document.getElementById('missileBtn').addEventListener('touchstart', e => {
  e.preventDefault(); e.stopPropagation();
  shootPlayerMissile();
}, { passive: false });
document.getElementById('missileBtn').addEventListener('mousedown', e => {
  e.preventDefault(); e.stopPropagation();
  shootPlayerMissile();
});

function hitPlayer() {
  if (invincible > 0) return;
  if (shieldActive) {
    shieldActive = false; activePU = null; puTimer = 0; invincible = 60;
    sfx.shieldBreak(); spawnP(player.x + player.w * .5, player.y + player.h * .5, '#44ff88', 15);
    screenShake = 12; return;
  }
  hearts--; updateHearts(); invincible = gameMode === 'pro' ? 90 : 180;
  sfx.hit(); spawnP(player.x + player.w * .5, player.y + player.h * .5, '#FF2200', 12);
  screenShake = 18;
  floatingTexts.push({ x: player.x + player.w * .5, y: player.y - 10, text: '💔', color: '#ff3344', life: 1, vy: -2 });
  if (hearts <= 0) {
    state = 'dying';
    player.vy = -8;
    player.vx = speed * 0.8;
    player.rotation = 0;
    player.deathSpeed = speed;
    player.deadTimer = 180;
    player.exploded = false;
    player.bounceCount = 0;

    stopMusic(); stopJetpackSound();
  }
}

function gameOver() {
  state = 'over'; stopMusic(); stopJetpackSound(); sfx.over();
  score = Math.floor(distance) + runCoins * 5;
  const best = getBestScore();
  addScore(score); addCoins(runCoins);
  document.getElementById('goDist').textContent = Math.floor(distance) + ' m';
  document.getElementById('goCoins').textContent = runCoins;
  document.getElementById('goScore').textContent = score;
  document.getElementById('goBest').textContent = Math.max(score, best);
  document.getElementById('gameOverScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
}

window.triggerVictory = function() {
  state = 'victory'; 
  stopMusic(); stopJetpackSound(); 
  if (sfx.yay) sfx.yay();
  
  // Score calc
  score = Math.floor(distance) + runCoins * 5;
  const best = getBestScore();
  addScore(score); addCoins(runCoins);
  
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('victoryScreen').classList.remove('hidden');
  
  // Reset gift elements
  document.getElementById('victoryGiftBox').style.pointerEvents = 'auto';
  document.getElementById('giftEmoji').textContent = '🎁';
  document.getElementById('giftPulse').classList.remove('hidden');
  document.getElementById('victoryGiftReward').classList.add('hidden');
  document.getElementById('victoryButtons').classList.add('hidden');
  
  // Victory FX
  canvas.style.transition = 'filter 2s ease-out';
  canvas.style.filter = 'blur(4px) brightness(1.2)';
  screenShake = 60; // Big rumble!
};

function pauseGame() {
  state = 'paused'; stopMusic(); stopJetpackSound();
  document.getElementById('pauseScreen').classList.remove('hidden');
}

function resumeGame() {
  state = 'playing';
  document.getElementById('pauseScreen').classList.add('hidden');
  startMusic(curBiome);
  lastTime = performance.now();
  if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
}

function goHome() {
  state = 'start'; stopMusic(); stopJetpackSound();
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  updateTotalCoins(); checkDailyReward();
  loopRunning = false;
}

// ── GAME INIT ────────────────────────────────
function startGame() {
  try {
    const W = canvas.gameW, H = canvas.gameH;
    canvas.style.transition = 'none';
    canvas.style.filter = 'none';
    player.x = W * .12; player.y = H * .4; player.vy = 0; player.vx = 0; player.rotation = 0; player.trail = []; player.onGround = false; player.exploded = false;
    player.laserAmmo = 10; player.missileAmmo = 5;
    obstacles = []; coins = []; pickups = []; heartPacks = []; particles = []; missiles = []; missileWarnings = [];
    enemies = []; enemyBullets = []; playerBullets = [];

    // Initialize pet
    const pData = getSkinColors().pet;
    petObj = (pData && pData.id !== 'none') ? { x: player.x - 40, y: player.y - 40, type: pData.id, cooldown: 60 } : null;

    score = 0; distance = 0; runCoins = 0; frame = 0;
    hearts = gameMode === 'pro' ? 3 : 5;
    BASE_SPEED = gameMode === 'pro' ? 5.5 : 5;
    invincible = 0;
    activePU = null; puTimer = 0; shieldActive = false; bgX = 0;
    boss = null; bossDefeated = new Array(9).fill(false); bossWarning = 0; finalBossWarningTriggered = false;
    graceFrames = 60;
    curBiome = 'bridge'; window.curBiome = 'bridge';
    banner = { text: '', timer: 0 }; window.banner = banner;
    speed = BASE_SPEED; updateHearts(); updateHUD(); updatePUBar();
    for (let i = 0; i < 3; i++) spawnCoinPattern();
    
    // Immediately spawn the new enemies at the very start to demonstrate them!
    if (typeof spawnEnemy !== 'undefined') {
      spawnEnemy('walker');
      if (enemies.length > 0) enemies[enemies.length - 1].x = W + 50;
      spawnEnemy('scorpion');
      if (enemies.length > 0) enemies[enemies.length - 1].x = W + 400;
    }
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    state = 'playing';
    try { startMusic('bridge'); } catch (e) { console.warn('[KSR] music error:', e); }
    lastT = performance.now();
    if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
  } catch (err) { console.error('startGame error:', err); }
}

// ── MAIN LOOP ────────────────────────────────
function loop(ts) {
  if (state !== 'playing' && state !== 'dying' && state !== 'victory') { loopRunning = false; return; }
  const rawDt = ts - lastT; lastT = ts;
  const dt = Math.min(rawDt / TARGET_DT, 3);
  frame++;
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const speedMult = (activePU === 'speed' || activePU === 'ultimate') ? 1.6 : 1;
  // Phase-based difficulty (Flattens out endgame to prevent impossibility)
  let speedAccel;
  if (gameMode === 'pro') {
    if (distance < 2000) speedAccel = distance * 0.0008; // 1.6
    else if (distance < 4000) speedAccel = 1.6 + (distance - 2000) * 0.0012; // 4.0
    else if (distance < 9000) speedAccel = 4.0 + (distance - 4000) * 0.0007; // 7.5
    else speedAccel = 7.5; // Flatline at 7.5 max
  } else {
    if (distance < 2000) speedAccel = distance * 0.0005; // 1.0
    else if (distance < 4000) speedAccel = 1.0 + (distance - 2000) * 0.0010; // 3.0
    else if (distance < 9000) speedAccel = 3.0 + (distance - 4000) * 0.0009; // 7.5
    else speedAccel = 7.5; // Flatline at 7.5 max
  }
  if (state === 'dying') {
    player.deathSpeed *= 0.98;
    speed = player.deathSpeed;
  } else if (state === 'victory') {
    speed *= 0.98;
  } else {
    speed = (BASE_SPEED + speedAccel) * speedMult;
  }
  const spd = speed * dt;
  bgX += spd;
  const isBossActive = boss && boss.entered && !boss.retreating && !boss.defeated;
  if (!isBossActive) {
    distance += spd * 0.1;
  }

  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.missileCooldown > 0) player.missileCooldown -= dt;
  if (player.saberSwing > 0) player.saberSwing -= Math.min(0.2 * dt, player.saberSwing);

  window.bgX = bgX; window.frame = frame;

  drawBG(); drawBanner();

  // Screen shake
  if (screenShake > 0) {
    const shakeX = (Math.random() - 0.5) * screenShake * 1.5;
    const shakeY = (Math.random() - 0.5) * screenShake * 1.5;
    ctx.save(); ctx.translate(shakeX, shakeY);
    screenShake -= dt;
  }

  // Boss warning flash
  if (bossFlash > 0) {
    ctx.save();
    ctx.globalAlpha = bossFlash * 0.15;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    bossFlash -= dt * 0.03;
  }

  // Grace period
  if (graceFrames > 0 && state !== 'dying') { graceFrames -= dt; player.vy = 0; player.y = H * .4 + Math.sin(frame * .08) * 4; }
  else {
    // Physics
    if (state === 'dying') {
      player.vy += GRAVITY * dt;
      player.x += player.vx * dt;
      player.rotation += player.vx * 0.05 * dt;
      player.vx *= 0.985;

      // Burning smoke trail as they fall
      if (!player.onGround && frame % 2 === 0) {
        spawnP(player.x + player.w / 2 + (Math.random() - 0.5) * 20, player.y + player.h / 2 + (Math.random() - 0.5) * 20, '#ff4400', 3 + Math.random() * 3);
        spawnP(player.x + player.w / 2 + (Math.random() - 0.5) * 20, player.y + player.h / 2 + (Math.random() - 0.5) * 20, '#222222', 4 + Math.random() * 4);
      }

      player.deadTimer -= dt;
      if (player.deadTimer <= 0 && Math.abs(player.vx) < 1) gameOver();
    } else if (state === 'victory') {
      player.vy *= 0.9; // Smoothly stop vertical movement
      
      // Spawn massive background explosions!
      if (Math.random() < 0.25) {
        const W = canvas.gameW, H = canvas.gameH;
        spawnP(Math.random() * W, Math.random() * (H * GROUND_RATIO), ['#ffaa00', '#ff0000', '#aaaaaa', '#ffffff', '#00f3ff', '#ff00ff'][Math.floor(Math.random() * 6)], 10 + Math.random()*20);
        if (Math.random() < 0.1 && sfx.explode) sfx.explode();
        screenShake = Math.max(screenShake, 5); // Keep shaking a bit
      }
    } else if (isHolding && !startClickGuard) {
      player.vy += THRUST * dt;
      player.onGround = false;
    } else {
      player.vy += GRAVITY * dt;
    }
    player.vy = Math.max(MAX_RISE, Math.min(MAX_FALL, player.vy));
    player.y += player.vy * dt;
  }
  // Bounds
  if (player.y < 0) { player.y = 0; player.vy = 0; }
  if (player.y + player.h > gY) {
    player.y = gY - player.h;
    if (state === 'dying' && !player.exploded) {
      if (player.bounceCount === undefined) player.bounceCount = 0;

      if (player.vy > 2.0 && player.bounceCount < 4) {
        player.vy = -player.vy * 0.75; // Higher restitution for higher/longer subsequent bounces
        player.vx *= 0.8; // Less ground friction on hit to retain forward tumbling momentum
        player.bounceCount++;
        spawnP(player.x + player.w / 2, player.y + player.h, '#aaaaaa', 5);
        if (sfx.bounce) sfx.bounce();
        player.rotation += player.vx * 0.15;
      } else {
        player.exploded = true;
        const ex = player.x + player.w / 2, ey = player.y + player.h / 2;

        // 1. Digital Shockwave Sphere
        particles.push({ type: 'shockwave', x: ex, y: ey, vx: 18, vy: 0, life: 1, col: 'rgba(0, 243, 255, 0.8)', r: 10 });

        // 2. High-Energy Holographic Rings
        particles.push({ type: 'ring', x: ex, y: ey, vx: 25, vy: 8, life: 1, col: '#00f3ff', r: 10 });
        particles.push({ type: 'ring', x: ex, y: ey, vx: 15, vy: 15, life: 1, col: '#ff00ff', r: 10 });

        // 3. Cyber Shards (Hexagons) & Plazma Sparks
        const colors = ['#ffffff', '#00f3ff', '#ff00ff', '#ff2255', '#222233'];
        for (let i = 0; i < 120; i++) {
          const a = Math.random() * 6.28, s = 8 + Math.random() * 22;
          const isSpark = Math.random() < 0.6;
          particles.push({
            type: isSpark ? 'spark' : 'hex',
            x: ex, y: ey,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4,
            life: 1.0 + Math.random() * 0.8,
            col: colors[i % colors.length],
            r: 4 + Math.random() * 10
          });
        }

        // 4. Ground Scorching (soot dust)
        for (let i = 0; i < 40; i++) {
          const a = Math.PI + Math.random() * Math.PI; // Upward spray
          const s = 2 + Math.random() * 10;
          particles.push({
            x: ex + (Math.random() - 0.5) * 40, y: ey + 15,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life: 1.5 + Math.random(),
            col: '#1a1c23',
            r: 10 + Math.random() * 15
          });
        }

        bossFlash = 1.0; // Overexposure flash
        screenShake = 50; // Earth-shattering rumble
        if (sfx.explode) sfx.explode();

        player.vx = 0;
        player.vy = 0;
        player.deadTimer = 70; // Slightly longer wait before game over screen
      }
    }

    if (state !== 'dying') {
      player.vy = 0;
    }
    player.onGround = true;
  }
  else { player.onGround = false; }

  // ── BOSS SPAWNING ──
  if (distance >= 42000 && !finalBossWarningTriggered) {
    finalBossWarningTriggered = true;
    banner = { text: '⚠️ THE FINAL BOSS IS COMING ⚠️', timer: 250 }; window.banner = banner;
    if (sfx.warning) sfx.warning();
  }

  if (!boss && distance >= 2000 && !bossDefeated[1]) spawnBoss(2); // Warden Mech at 2000m (index 1)
  if (!boss && distance >= 4000 && !bossDefeated[0]) spawnBoss(1); // Sentinel Turret at 4000m (index 0)
  if (!boss && distance >= 6000 && !bossDefeated[2]) spawnBoss(3); // Overlord Gunship at 6000m (index 2)
  if (!boss && distance >= 12000 && !bossDefeated[3]) spawnBoss(4); // Supreme Overlord at 12000m (index 3)
  if (!boss && distance >= 15000 && !bossDefeated[5]) spawnBoss(6); // Dreadnought at 15000m (index 5)
  if (!boss && distance >= 19000 && !bossDefeated[4]) spawnBoss(5); // Annihilator at 19000m (index 4)
  if (!boss && distance >= 25000 && !bossDefeated[6]) spawnBoss(7); // Void Weaver at 25000m (index 6)
  if (!boss && distance >= 35000 && !bossDefeated[7]) spawnBoss(8); // Celestial Seraph at 35000m (index 7)
  if (!boss && distance >= 50000 && !bossDefeated[8]) spawnBoss(9); // Singularity Final Boss at 50000m (index 8)
  // ── PHASE-BASED SPAWNING ──
  let si, enemyChance, missileChance;
  if (gameMode === 'pro') {
    if (distance < 2000) { si = Math.max(80, 140 - distance * 0.02); enemyChance = 0.35; missileChance = 0.20; }
    else if (distance < 5000) { si = Math.max(65, 100 - (distance - 2000) * 0.015); enemyChance = 0.50; missileChance = 0.25; }
    else if (distance < 9000) { si = Math.max(50, 75 - (distance - 5000) * 0.01); enemyChance = 0.65; missileChance = 0.30; }
    else { si = Math.max(45, 55 - (distance - 9000) * 0.005); enemyChance = 0.75; missileChance = 0.35; }
  } else {
    // Beginner: Very relaxed, low enemy spawn chance
    if (distance < 2000) { si = Math.max(220, 300 - distance * 0.01); enemyChance = 0.35; missileChance = 0.02; }
    else if (distance < 5000) { si = Math.max(200, 260 - (distance - 2000) * 0.01); enemyChance = 0.45; missileChance = 0.04; }
    else if (distance < 9000) { si = Math.max(180, 220 - (distance - 5000) * 0.01); enemyChance = 0.55; missileChance = 0.06; }
    else { si = Math.max(160, 200 - (distance - 9000) * 0.005); enemyChance = 0.65; missileChance = 0.08; }
  }
  // Don't spawn regular enemies during boss fights or when dying
  const bossActive = boss && boss.entered && !boss.retreating;
  if (state === 'playing' && frame > 80 && frame % Math.floor(si) === 0 && !bossActive) {
    if (Math.random() < enemyChance) {
      spawnEnemy();
    } else {
      const r = Math.random();
      if (distance < 2000) {
        if (r < 0.15) spawnLaser('vert');
        else if (r < 0.45) spawnLaser('horiz');
        else if (r < 0.65) spawnElectric();
        else spawnMissileWarning();
      } else if (distance < 4000) {
        if (r < 0.40) spawnLaser('horiz');
        else if (r < 0.60) spawnElectric();
        else spawnMissileWarning();
      } else if (distance < 9900) {
        if (r < 0.15) spawnLaser('vert');
        else if (r < 0.75) spawnLaser('horiz');
        else spawnElectric();
      } else {
        if (r < 0.10) spawnLaser('vert');
        else if (r < 0.45) spawnLaser('horiz');
        else if (r < 0.65) spawnElectric();
        else spawnMissileWarning();
      }
    }
  }

  // Coin clusters: Only spawn if the screen is relatively clear of coins on the right side to prevent grids smashing together!
  let maxCoinX = 0;
  for (let c of coins) { if (c.x > maxCoinX) maxCoinX = c.x; }
  if (state === 'playing' && maxCoinX < canvas.gameW - 100 && frame % 60 === 0 && !bossActive) spawnCoinPattern();

  if (state === 'playing' && frame % 140 === 0) spawnPickup();
  // Heart packs: spawn every ~180 frames, only when player has lost hearts (now up to 5 hearts max)
  if (state === 'playing' && frame % 180 === 0 && hearts < 5) spawnHeartPack();
  // Ultimate packs: rare, every ~400 frames, only after 500m
  if (state === 'playing' && frame % 400 === 0 && distance > 500 && Math.random() < 0.8) spawnUltimatePack();

  // Power-ups
  if (invincible > 0) invincible -= dt;
  if (puTimer > 0) { puTimer -= dt; if (puTimer <= 0) { activePU = null; shieldActive = false; } }
  updatePUBar();

  // Magnet effect
  if (activePU === 'magnet') {
    coins.forEach(c => {
      if (c.collected) return;
      const dx = player.x + player.w / 2 - c.x, dy = player.y + player.h / 2 - c.y, d2 = Math.sqrt(dx * dx + dy * dy);
      if (d2 < 160) { c.x += dx * .08; c.y += dy * .08; }
    });
  }

  // Obstacles
  obstacles = obstacles.filter(ob => {
    if (ob.type === 'laser_horiz') {
      if (ob.beamOn) ob.life -= dt;
      return ob.life > 0;
    }
    return ob.x + ob.w > -60;
  });
  obstacles.forEach(ob => {
    if (ob.type !== 'laser_horiz') {
      ob.x -= spd;
    } else {
      ob.w = canvas.gameW; // Screen-spanning
    }

    if (ob.type === 'laser_horiz') {
      if (ob.warningTimer > 0) {
        ob.warningTimer -= dt;
        if (ob.warningTimer <= 0) { ob.beamOn = true; sfx.laserBeamBlast(); screenShake = 10; }
      }
      if (!ob.passed && ob.beamOn) { ob.passed = true; sfx.pass(); } // Optional score bonus trigger
      if (state === 'playing' && invincible <= 0 && !shieldActive && activePU !== 'speed' && ob.beamOn && checkCollLaserHoriz(ob)) hitPlayer();
      else if (state === 'playing' && (shieldActive || activePU === 'speed') && ob.beamOn && checkCollLaserHoriz(ob) && invincible <= 0) hitPlayer();
    }

    if (ob.type === 'laser') {
      ob.angle += ob.spinSpeed * dt; // Dynamic active rotation!
      if (ob.warningTimer > 0) {
        ob.warningTimer -= dt;
        if (ob.warningTimer <= 0) { ob.beamOn = true; }
      }
      if (!ob.passed && ob.x + ob.w < player.x) { ob.passed = true; sfx.pass(); }
      if (state === 'playing' && invincible <= 0 && !shieldActive && activePU !== 'speed' && checkCollLaser(ob)) hitPlayer();
      else if (state === 'playing' && (shieldActive || activePU === 'speed') && checkCollLaser(ob) && invincible <= 0) hitPlayer();
    }
    if (ob.type === 'electric') {
      ob.phase += .08 * dt; // and blinks much faster
      ob.on = Math.sin(ob.phase) > -0.6;
      ob.angle += ob.spinSpeed * dt; // Apply dynamic active rotation!
      if (!ob.passed && ob.x + ob.w < player.x) { ob.passed = true; sfx.pass(); }
      if (state === 'playing' && invincible <= 0 && checkCollElec(ob)) hitPlayer();
    }
  });
  drawObstacles();

  // Missile warnings → missiles
  missileWarnings = missileWarnings.filter(w => {
    w.timer -= dt;
    // Tracking lock-on: Follows player until the final 20 frames!
    if (w.timer > 20) {
      const targetY = Math.max(30, Math.min(canvas.gameH * GROUND_RATIO - 30, player.y + player.h / 2));
      w.y += (targetY - w.y) * 0.12 * dt;
    }
    if (w.timer <= 0) { spawnMissile(w.y, w.speed); return false; }
    return true;
  });
  // Missiles
  missiles = missiles.filter(m => m.x + m.w > -60);
  missiles.forEach(m => {
    m.x += m.vx * dt;

    // Missiles NO LONGER follow the player. They shoot straight horizontally!

    if (!m.passed && m.x + m.w < player.x) { m.passed = true; sfx.pass(); }
    if (state === 'playing' && invincible <= 0 && checkCollMissile(m)) hitPlayer();
  });
  drawMissiles();

  // Enemies
  enemies = enemies.filter(e => e.x + e.w > -80 && e.hp > 0);
  enemies.forEach(e => {
    // Fleeing: after 3 shots, enemy runs away fast
    if (e.fleeing) {
      e.x += spd * 1.5; // Fly away to the right
      e.y -= 1.5; // Float upward while fleeing
      drawEnemyByType(e);
      return;
    }
    const baseMult = gameMode === 'pro' ? 1.0 : 0.5;
    const moveSpeed = (e.type === 'chopper' ? spd * 0.25 : e.type === 'spinning_robot' ? spd * 0.35 : spd * 0.3) * baseMult;
    e.x -= moveSpeed;
    // Movement: all enemies hover now (unless explicitly set to 0)
    e.hoverPhase += (e.hoverSpeed !== undefined ? e.hoverSpeed : 0.01) * dt;
    e.y = e.baseY + Math.sin(e.hoverPhase) * (e.hoverAmp !== undefined ? e.hoverAmp : 8);
    if (e.flash > 0) e.flash -= dt;
    // Shooting (randomized timing)
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && e.x < canvas.gameW - 40 && e.x > player.x) {
      // Add random delay so shooting is unpredictable
      e.shootTimer = e.shootInterval * (0.7 + Math.random() * 0.8);
      e.shotCount = (e.shotCount || 0) + 1;
      const btype = e.type === 'standard' ? 'laser_beam' : e.type === 'chopper' ? 'fireball' : e.type === 'walker' ? 'walker_plasma' : e.type === 'scorpion' ? 'scorpion_venom' : undefined;
      spawnEnemyBullet(e.x, e.y, btype);
    }
    drawEnemyByType(e);
  });

  // Enemy bullets
  enemyBullets = enemyBullets.filter(b => b.x > -20 && b.x < canvas.gameW + 20 && b.y > -20 && b.y < canvas.gameH + 20 && b.life > 0);
  enemyBullets.forEach(b => {
    // Advanced Homing Logic for Boss attacks!
    if (b.btype === 'warden_fireball' || b.btype === 'overlord_missile') {
      const pCen = player.y + player.h / 2;
      const dy = pCen - b.y;
      b.vy += Math.sign(dy) * 0.03 * dt;
      b.vy = Math.max(-4, Math.min(4, b.vy)); // Cap vertical curving speed
    }

    b.x += b.vx * dt; b.y += b.vy * dt;
    drawEnemyBullet(b);
    if (state === 'playing' && invincible <= 0 && checkCollBullet(b)) {
      hitPlayer();
      b.life = 0;
      spawnP(b.x, b.y, '#cc44ff', 8);
    }
  });

  // ── Player Pet Mechanics ──
  if (state === 'playing' && petObj) {
    let tx = player.x - 45, ty = player.y - 40;
    if (petObj.type === 'cat') {
      tx = player.x - 35; ty = player.y + player.h - 15;
    } else if (petObj.type === 'ufo') {
      tx = player.x - 20; ty = Math.max(30, player.y - 45 + Math.sin(frame * 0.1) * 15);
    } else if (petObj.type === 'dragon') {
      tx = player.x - 55; ty = player.y - 20 + Math.sin(frame * 0.05) * 30;
    }

    petObj.x += (tx - petObj.x) * (petObj.type === 'dragon' ? 0.04 : 0.08) * dt;
    petObj.y += (ty - petObj.y) * (petObj.type === 'dragon' ? 0.04 : 0.08) * dt;

    petObj.cooldown -= dt;
    if (petObj.cooldown <= 0 && ((enemies.length > 0) || (boss && boss.entered && !boss.defeated) || missiles.length > 0)) {
      let target = null;
      let minDist = Infinity;
      const checkTarget = (tx, ty, tvx, tvy, tHp) => {
        if (tx > petObj.x && tHp > 0) {
          const d = Math.hypot(tx - petObj.x, ty - petObj.y);
          if (d < minDist) { minDist = d; target = { x: tx, y: ty, vx: tvx, vy: tvy }; }
        }
      };
      enemies.forEach(e => { if (e.life === undefined || e.life > 0) checkTarget(e.x + (e.w / 2 || 0), e.y + (e.h / 2 || 0), -speed, 0, e.hp || 1); });
      if (boss && boss.entered && !boss.defeated && !boss.retreating) checkTarget(boss.x + boss.w / 2, boss.y + boss.h / 2, 0, 0, boss.hp);
      missiles.forEach(m => { if (!m.destroyed) checkTarget(m.x + m.w / 2, m.y + m.h / 2, m.vx, 0, 1); });

      let expectedSpd = petObj.type === 'ufo' ? speed * 2 + 12 : (petObj.type === 'dragon' ? speed * 1.5 + 4 : speed * 0.9 + 3);
      let finalVx = expectedSpd, finalVy = 0;

      if (target) {
        const t = minDist / expectedSpd; // Est time to impact
        const px = target.x + (target.vx * t);
        const py = target.y + (target.vy * t);
        const dx = px - (petObj.x + 10), dy = py - petObj.y;
        const dist = Math.hypot(dx, dy);
        // Only shoot if the predicted position is strictly forward (ahead of the pet)
        if (dist > 0 && dx > 20) {
          finalVx = (dx / dist) * expectedSpd;
          finalVy = (dy / dist) * expectedSpd;
        }
      }

      if (petObj.type === 'dragon') {
        petObj.cooldown = 130;
        playerBullets.push({ x: petObj.x + 10, y: petObj.y, vx: finalVx, vy: finalVy, type: 'dragon', life: 1, damage: 3 });
        if (sfx.fireball) sfx.fireball(); else if (sfx.laser) sfx.laser();
      } else if (petObj.type === 'ufo') {
        petObj.cooldown = 80;
        playerBullets.push({ x: petObj.x + 10, y: petObj.y, vx: finalVx, vy: finalVy, type: 'ufo', life: 3, damage: 1 });
        if (sfx.pew) sfx.pew(); else if (sfx.laser) sfx.laser();
      } else if (petObj.type === 'cat') {
        petObj.cooldown = 300; // 5 second cooldown (60 ticks/sec * 5)
        playerBullets.push({ x: petObj.x + 10, y: petObj.y, vx: finalVx, vy: finalVy, type: 'cat', life: 1, damage: 1, bounces: 0 });
        if (sfx.meow) sfx.meow(); else if (sfx.laser) sfx.laser();
      }
    }
  }

  // Draw & update Player Pet Bullets
  playerBullets.forEach(pb => {
    let target = null;
    if (boss && boss.entered && !boss.defeated && !boss.retreating) target = boss;
    else {
      let minDist = 1200;
      enemies.forEach(e => {
        if (e.hp > 0 && e.x > pb.x - 50) {
          const d = Math.hypot((e.x + e.w / 2) - pb.x, (e.y + e.h / 2) - pb.y);
          if (d < minDist) { minDist = d; target = e; }
        }
      });
      // Allow them to target homing missiles too!
      missiles.forEach(m => {
        if (!m.destroyed && m.x > pb.x - 50) {
          const d = Math.hypot((m.x + m.w / 2) - pb.x, (m.y + m.h / 2) - pb.y);
          if (d < minDist) { minDist = d; target = m; }
        }
      });
    }
    if (target) {
      const dx = (target.x + (target.w || 0) / 2) - pb.x, dy = (target.y + (target.h || 0) / 2) - pb.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        // Lower turning acceleration for the Cat
        const turnSpeed = pb.type === 'player_missile' ? 2.5 : (pb.type === 'cat' ? 1.0 : (pb.type === 'player_laser' ? 4 : 3));
        pb.vx += (dx / dist) * turnSpeed; pb.vy += (dy / dist) * turnSpeed;
        
        const s = Math.hypot(pb.vx, pb.vy);
        // Radically lower maximum capping speed for the glowing Cat bullet
        const mg = pb.type === 'cat' ? speed * 0.5 + 2 : speed * 2 + 10;
        
        if (s > mg) { pb.vx = (pb.vx / s) * mg; pb.vy = (pb.vy / s) * mg; }
      }
    }
    pb.x += pb.vx * dt;
    pb.y += pb.vy * dt;
    ctx.save();
    ctx.shadowBlur = 15;
    if (pb.type === 'cat') {
      ctx.fillStyle = '#ff00ff'; ctx.shadowColor = '#ff00ff';
      ctx.beginPath(); ctx.arc(pb.x, pb.y, 6 + Math.sin(frame * 0.4) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(pb.x - 5, pb.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(pb.x + 5, pb.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(pb.x, pb.y - 7, 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (pb.type === 'ufo') {
      ctx.strokeStyle = '#00f3ff'; ctx.shadowColor = '#00f3ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(pb.x, pb.y, 5.5, 11, Math.PI / 4, 0, Math.PI * 2); ctx.stroke();
    } else if (pb.type === 'dragon') {
      ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ff4400';
      ctx.beginPath(); ctx.arc(pb.x, pb.y, 16 + Math.sin(frame * 0.5) * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(pb.x + 4, pb.y, 8, 0, Math.PI * 2); ctx.fill();
    } else if (pb.type === 'player_laser') {
      const sColor = pb.color || '#ff00ff';
      ctx.save();
      ctx.translate(pb.x, pb.y);
      // Optional subtle scale throb based on frame for energy wobbly feel
      const throb = 1 + Math.sin(frame * 0.5) * 0.1;
      ctx.scale(throb, throb);

      ctx.shadowColor = sColor; ctx.shadowBlur = 20;

      // Crescent energy wave (anime style slash projectile)
      ctx.fillStyle = sColor;
      ctx.beginPath();
      ctx.moveTo(25, 0); // Front piercing tip
      ctx.quadraticCurveTo(0, -18, -15, -28); // Top horn
      ctx.quadraticCurveTo(-5, 0, -15, 28);   // Bottom horn hook
      ctx.quadraticCurveTo(0, 18, 25, 0);     // Sweep back to front
      ctx.fill();

      // Blinding white inner core for plasma intensity
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.quadraticCurveTo(-2, -8, -8, -16);
      ctx.quadraticCurveTo(-3, 0, -8, 16);
      ctx.quadraticCurveTo(-2, 8, 16, 0);
      ctx.fill();

      // Front spark star
      ctx.beginPath(); ctx.ellipse(22, 0, 8, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(22, 0, 2, 6, 0, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    } else if (pb.type === 'player_missile') {
      ctx.save();
      ctx.translate(pb.x, pb.y);
      ctx.rotate(Math.atan2(pb.vy, pb.vx));

      const mw = 30, mh = 12; // Base dimensions

      // Massive glowing plasma propulsion engine trail
      const eLen = 25 + Math.random() * 15;
      const eg = ctx.createLinearGradient(-mw / 2, 0, -mw / 2 - eLen, 0);
      eg.addColorStop(0, '#ffffff');
      eg.addColorStop(0.2, '#00f3ff');
      eg.addColorStop(1, 'rgba(0,100,255,0)');

      ctx.fillStyle = eg; ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(-mw / 2, -mh / 3);
      ctx.lineTo(-mw / 2 - eLen, 0);
      ctx.lineTo(-mw / 2, mh / 3);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;

      // Dark carbon-fiber main metallic body
      const mg = ctx.createLinearGradient(0, -mh / 2, 0, mh / 2);
      mg.addColorStop(0, '#22252a');
      mg.addColorStop(0.5, '#4a505a'); // brighter reflection
      mg.addColorStop(1, '#1a1d24');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.moveTo(mw * 0.5, 0);       // sharp armor-piercing nose
      ctx.lineTo(mw * 0.1, -mh / 2);   // taper up
      ctx.lineTo(-mw / 2, -mh / 2);      // flat back
      ctx.lineTo(-mw / 2, mh / 2);       // back down
      ctx.lineTo(mw * 0.1, mh / 2);    // taper down
      ctx.closePath(); ctx.fill();

      // Cyberpunk glowing energy core stripes
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(-mw * 0.2, -mh / 2, 4, mh); // Vertical band
      ctx.fillRect(mw * 0.1, -2, 8, 4);      // Horizontal slit

      // High-tech swept aerodynamic fins
      ctx.fillStyle = '#111';
      ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 1.5;

      // Top flight fin
      ctx.beginPath(); ctx.moveTo(-mw * 0.4, -mh / 2);
      ctx.lineTo(-mw * 0.5, -mh);
      ctx.lineTo(-mw * 0.1, -mh / 2); ctx.fill(); ctx.stroke();

      // Bottom flight fin
      ctx.beginPath(); ctx.moveTo(-mw * 0.4, mh / 2);
      ctx.lineTo(-mw * 0.5, mh);
      ctx.lineTo(-mw * 0.1, mh / 2); ctx.fill(); ctx.stroke();

      ctx.restore();

      // Secondary spark trail particles popping off the engine
      pb.timer = (pb.timer || 0) + dt;
      if (pb.timer > 2) {
        spawnP(pb.x - 25, pb.y + (Math.random() - 0.5) * 10, '#00f3ff', 1);
        spawnP(pb.x - 20, pb.y, '#ffffff', 1);
        pb.timer = 0;
      }
    }
    ctx.restore();

    const dmg = pb.damage || 1;
    const hitRadiusSq = pb.type === 'player_laser' ? 1200 : (pb.type === 'dragon' ? 1800 : (pb.type === 'ufo' ? 600 : 400));

    // Damage enemies
    enemies.forEach(e => {
      if (e.life !== undefined && e.life <= 0) return;
      const er = e.r || e.w / 2;
      const ex = e.x + (e.w / 2 || 0), ey = e.y + (e.h / 2 || 0);
      if (pb.life > 0) {
        const dx = pb.x - ex, dy = pb.y - ey;
        if (dx * dx + dy * dy < er * er + hitRadiusSq) {
          let enemyDamage = dmg;
          if (pb.type === 'cat' || pb.type === 'ufo') enemyDamage = e.maxHp / 2; // Cat and UFO take 2 hits
          else enemyDamage = e.maxHp; // Everything else (Player Bullet, Missile, Dragon) One-Hits!

          e.hp -= enemyDamage;
          if (pb.type === 'ufo') pb.life--; else pb.life = 0;
          if (pb.type === 'dragon') spawnP(ex, ey, '#ff6600', 10);
          else spawnP(ex, ey, '#ffffff', 5);
          e.flash = 10;
          if (e.hp <= 0) {
            e.fleeing = true; e.y -= 1000; // soft kill

            // Massive Cinematic Explosion
            particles.push({ x: ex, y: ey, vx: 6, vy: 0, r: 0, col: '#ffaa00', life: 1, type: 'shockwave' });
            particles.push({ x: ex, y: ey, vx: 10, vy: 6, r: 0, col: '#ff0000', life: 1, type: 'ring' });
            for (let i = 0; i < 25; i++) {
              particles.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, r: 4 + Math.random() * 8, col: ['#ffaa00', '#ff0000', '#ffffff', '#444444'][Math.floor(Math.random() * 4)], life: 1 + Math.random() * 0.5, type: 'spark' });
            }
            if (sfx.explode) sfx.explode(); else if (sfx.hit) sfx.hit();
          } else if (sfx.hit) sfx.hit();
        }
      }
    });
    // Damage boss
    if (boss && boss.entered && !boss.defeated && !boss.retreating && pb.life > 0) {
      if (pb.x + Math.sqrt(hitRadiusSq) > boss.x && pb.x - Math.sqrt(hitRadiusSq) < boss.x + boss.w && pb.y + Math.sqrt(hitRadiusSq) > boss.y && pb.y - Math.sqrt(hitRadiusSq) < boss.y + boss.h) {
        boss.hp -= dmg;
        if (pb.type === 'ufo') pb.life--; else pb.life = 0;
        spawnP(pb.x, pb.y, pb.type === 'dragon' ? '#ff6600' : '#ffffff', 5);
      }
    }
    // Damage missiles
    missiles.forEach(m => {
      if (!m.destroyed && pb.life > 0) {
        if (pb.x + Math.sqrt(hitRadiusSq) > m.x && pb.x - Math.sqrt(hitRadiusSq) < m.x + m.w && pb.y + Math.sqrt(hitRadiusSq) > m.y && pb.y - Math.sqrt(hitRadiusSq) < m.y + m.h) {
          let missileDamage = (pb.type === 'cat' || pb.type === 'ufo') ? 1 : 2;
          m.hp = (m.hp || 2) - missileDamage;

          if (pb.type === 'ufo') pb.life--; else pb.life = 0;

          if (m.hp <= 0) {
            m.destroyed = true;
            for (let i = 0; i < 15; i++) spawnP(m.x, m.y, ['#ff0000', '#ff4400'][i % 2], 6);
            if (sfx.explosion) sfx.explosion();
          } else {
            spawnP(m.x, m.y, '#ffffff', 5);
            if (sfx.hit) sfx.hit();
          }
        }
      }
    });
  });
  playerBullets = playerBullets.filter(b => b.life > 0 && b.x < canvas.gameW + 200);

  // Coins
  coins = coins.filter(c => c.x > -30 && c.alpha > 0);
  coins.forEach(c => {
    c.x -= spd; if (!c.collected) {
      drawCoin(c);
      if (dist(player.x + player.w * .5, player.y + player.h * .5, c.x, c.y) < 50) {
        c.collected = true; runCoins++; sfx.coin(); spawnP(c.x, c.y, '#FFD700', 8); c.alpha = 0; checkBiome();
      }
    }
  });

  // Pickups
  pickups = pickups.filter(p => p.x > -40 && p.alpha > 0);
  pickups.forEach(p => {
    p.x -= spd; drawPickup2(p);
    if (dist(player.x + player.w * .5, player.y + player.h * .5, p.x, p.y) < 28) {
      activePU = p.type;
      if (p.type === 'shield') { shieldActive = true; puTimer = 99999; puMaxTime = 99999; sfx.shield(); }
      else if (p.type === 'speed') { puTimer = 300; puMaxTime = 300; sfx.speed(); }
      else if (p.type === 'ultimate') {
        // Ultimate: speed + shield for 6 seconds (~360 frames)
        shieldActive = true; puTimer = 360; puMaxTime = 360;
        sfx.reward();
        floatingTexts.push({ x: p.x, y: p.y - 20, text: '⭐ ULTIMATE!', color: '#ffd700', life: 1.5, vy: -1.5 });
        screenShake = 8;
      }
      else { puTimer = 480; puMaxTime = 480; sfx.magnet(); }
      const pCol = p.type === 'ultimate' ? '#cc44ff' : p.type === 'shield' ? '#44ff88' : p.type === 'speed' ? '#00ccff' : '#ffdd00';
      spawnP(p.x, p.y, pCol, 20); p.alpha = 0;
    }
  });

  // Heart packs
  heartPacks = heartPacks.filter(hp => hp.x > -40 && hp.alpha > 0);
  heartPacks.forEach(hp => {
    hp.x -= spd; drawHeartPack(hp);
    if (dist(player.x + player.w * .5, player.y + player.h * .5, hp.x, hp.y + Math.sin(hp.bob) * 6) < 28) {
      if (hearts < 5) { hearts++; updateHearts(); }
      sfx.heart();
      spawnP(hp.x, hp.y, '#ff4466', 16);
      spawnP(hp.x, hp.y, '#ffaacc', 8);
      hp.alpha = 0;
    }
  });

  // Boss
  if (boss) { updateBoss(dt, spd); drawBoss(); }

  // Floating texts
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);
  floatingTexts.forEach(ft => {
    ft.y += ft.vy * dt;
    ft.vy *= 0.97;
    ft.life -= 0.02 * dt;
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life);
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 8;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  updateP(); drawPlayer(); updateHUD(); checkBiome();

  // End screen shake transform
  if (screenShake > 0) ctx.restore();

  if (state === 'playing' || state === 'dying') requestAnimationFrame(loop);
  else loopRunning = false;
}

// ── BOOT ─────────────────────────────────────
window.bgX = 0; window.frame = 0;
curBiome = 'bridge'; window.curBiome = 'bridge';
drawBG();
// Auto-start for testing
if (new URLSearchParams(window.location.search).has('autostart')) {
  setTimeout(() => { initAudio(); startGame(); }, 500);
}
