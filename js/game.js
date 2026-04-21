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
  { id: 'forest', label: '🏛️ Ancient Ruins', minDist: 2000 },
  { id: 'city', label: '⚔️ Secret Catacombs', minDist: 3000 },
  { id: 'mountain', label: '🌋 Volcanic Depths', minDist: 4000 },
  { id: 'ocean', label: '🐉 Dragon\'s Peak', minDist: 5000 }
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

// ── ENEMIES (multi-type shooting creatures) ──
function spawnEnemy(forceType) {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const type = forceType || (Math.random() < 0.33 ? 'standard' : Math.random() < 0.66 ? 'spinning_robot' : 'chopper');
  const shootInterval = gameMode === 'pro' ? Math.max(90, 160 - distance * 0.006) : Math.max(240, 360 - distance * 0.001);
  if (type === 'spinning_robot') {
    const ey = gY * 0.45 + Math.random() * (gY * 0.3);
    enemies.push({
      type: 'spinning_robot', x: W + 40, y: ey, baseY: ey, w: 32, h: 32,
      hoverAmp: 8, hoverSpeed: 0.01, hoverPhase: Math.random() * 6.28, rot: 0,
      shootTimer: shootInterval + Math.random() * 60, shootInterval: shootInterval,
      hp: 2, flash: 0, shotCount: 0, fleeing: false
    });
  } else if (type === 'chopper') {
    const ey = 40 + Math.random() * (gY * 0.35);
    enemies.push({
      type: 'chopper', x: W + 60, y: ey, baseY: ey, w: 45, h: 32,
      hoverAmp: 15 + Math.random() * 10, hoverSpeed: 0.015 + Math.random() * 0.01,
      hoverPhase: Math.random() * 6.28, rot: 0,
      shootTimer: shootInterval * 1.3 + Math.random() * 40, shootInterval: shootInterval * 1.3,
      hp: 2, flash: 0, shotCount: 0, fleeing: false
    });
  } else {
    // standard drone
    const ey = 50 + Math.random() * (gY - 120);
    enemies.push({
      type: 'standard', x: W + 30, y: ey, baseY: ey, w: 26, h: 26,
      hoverAmp: 10 + Math.random() * 20, hoverSpeed: 0.02 + Math.random() * 0.02,
      hoverPhase: Math.random() * 6.28, rot: 0,
      shootTimer: shootInterval + Math.random() * 50, shootInterval,
      hp: 2, flash: 0, shotCount: 0, fleeing: false
    });
  }
}
function spawnEnemyBullet(ex, ey, bulletType) {
  const bulletSpeed = gameMode === 'pro' ? 2.8 + distance * 0.0003 : 1.0 + distance * 0.00005;
  if (bulletType === 'laser_beam') {
    // Robot: shoots straight left (very predictable)
    enemyBullets.push({ x: ex, y: ey, vx: -bulletSpeed * 1.5, vy: 0, r: 10, life: 1, btype: 'laser_beam' });
  } else if (bulletType === 'fireball') {
    // Dragon: shoots downward-left at a fixed angle
    const angle = Math.PI * 0.75 + (Math.random() - 0.5) * 0.3;
    enemyBullets.push({ x: ex, y: ey, vx: Math.cos(angle) * bulletSpeed, vy: Math.sin(angle) * bulletSpeed * 0.6, r: 9, life: 1, btype: 'fireball' });
  } else {
    // Demon: shoots left with a slight random vertical spread (NOT aimed at player)
    const spreadY = (Math.random() - 0.5) * 1.5;
    enemyBullets.push({ x: ex, y: ey, vx: -bulletSpeed, vy: spreadY, r: 7, life: 1, btype: 'demon' });
  }
  sfx.laser();
}

// ── DRAW ENEMIES ─────────────────────────────
function drawEnemyByType(e) {
  if (e.type === 'spinning_robot') drawSpinningRobot(e);
  else if (e.type === 'chopper') drawChopper(e);
  else drawStandard(e);
}

// ── BOSS SYSTEM ──────────────────────────────
function spawnBoss(bossType) {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  bossWarning = 120; // 2 second warning
  if (bossType === 1) {
    // Sentinel Turret at 2000m
    boss = {
      type: 'sentinel', x: W + 80, y: gY * 0.35, targetX: W * 0.72, w: 60, h: 70,
      hp: gameMode === 'pro' ? 80 : 40, maxHp: gameMode === 'pro' ? 80 : 40, phase: 0, shootTimer: 60, shootInterval: gameMode === 'pro' ? 30 : 60, bossIdx: 0,
      entered: false, defeated: false, retreating: false, t: 0
    };
  } else if (bossType === 2) {
    // Warden Mech at 4000m
    boss = {
      type: 'warden', x: W + 100, y: gY * 0.4, targetX: W * 0.68, w: 80, h: 90,
      hp: gameMode === 'pro' ? 120 : 60, maxHp: gameMode === 'pro' ? 120 : 60, phase: 0, shootTimer: 45, shootInterval: gameMode === 'pro' ? 75 : 120, bossIdx: 1,
      entered: false, defeated: false, retreating: false, t: 0, walkFrame: 0
    };
  } else if (bossType === 3) {
    // Overlord Gunship at 6000m
    boss = {
      type: 'overlord', x: W + 120, y: gY * 0.25, targetX: W * 0.65, w: 100, h: 60,
      hp: gameMode === 'pro' ? 160 : 80, maxHp: gameMode === 'pro' ? 160 : 80, phase: 0, shootTimer: 40, shootInterval: gameMode === 'pro' ? 45 : 80, bossIdx: 2,
      entered: false, defeated: false, retreating: false, t: 0, wingFrame: 0
    };
  } else if (bossType === 4) {
    // Supreme Overlord at 12000m
    boss = {
      type: 'overlord', x: W + 120, y: gY * 0.25, targetX: W * 0.65, w: 100, h: 60,
      hp: gameMode === 'pro' ? 240 : 120, maxHp: gameMode === 'pro' ? 240 : 120, phase: 0, shootTimer: 25, shootInterval: gameMode === 'pro' ? 30 : 60, bossIdx: 3,
      entered: false, defeated: false, retreating: false, t: 0, wingFrame: 0
    };
  } else {
    // Annihilator at 19000m (Final Boss)
    boss = {
      type: 'annihilator', x: W + 150, y: gY * 0.4, targetX: W * 0.6, w: 120, h: 120,
      hp: gameMode === 'pro' ? 320 : 160, maxHp: gameMode === 'pro' ? 320 : 160, phase: 0, shootTimer: 50, shootInterval: gameMode === 'pro' ? 50 : 90, bossIdx: 4,
      entered: false, defeated: false, retreating: false, t: 0, orbitalAngle: 0
    };
  }
  banner = { text: '⚠️ BOSS INCOMING ⚠️', timer: 150 }; window.banner = banner;
  startMusic('boss_' + boss.type);
}

function updateBoss(dt, spd) {
  if (!boss) return;
  boss.t += dt;
  // Enter phase
  if (!boss.entered) {
    boss.x -= spd * 2;
    if (boss.x <= boss.targetX) { boss.entered = true; boss.x = boss.targetX; }
    return;
  }
  // Retreating
  if (boss.retreating) {
    boss.x += spd * 3;
    boss.y -= 1.5 * dt;
    if (boss.x > canvas.gameW + 200) {
      boss = null;
      startMusic(curBiome); // Revert to regular biome music
      banner = { text: '🏆 BOSS DEFEATED! 🏆', timer: 200 }; window.banner = banner;
      // Reward
      runCoins += 25; sfx.coin();
      for (let i = 0; i < 40; i++) spawnP(canvas.gameW * 0.5, canvas.gameH * 0.4, ['#FFD700', '#ff6600', '#00ffaa', '#ff44cc'][i % 4], 1);
    }
    return;
  }
  // Boss no longer drains HP over time — player must physically shoot them to win!
  // boss.hp -= dt * (boss.type === 'annihilator' ? 1.8 : boss.type === 'overlord' ? 1.5 : boss.type === 'warden' ? 1.2 : 1.0);
  // Dynamic vertical movement: Sentinel sweeps aggressively but stays visible
  const gY = canvas.gameH * GROUND_RATIO; // Required for vertical movement calculations
  if (boss.type === 'sentinel' && !boss.retreating) {
    boss.y = (gY * 0.35 + Math.sin(boss.t * 0.015) * gY * 0.3); // Keeps Sentinel within screen bounds
  } else if (boss.type === 'annihilator' && !boss.retreating) {
    boss.y = (gY * 0.45 + Math.sin(boss.t * 0.02) * gY * 0.4); // Huge sweeping vertical hover
    boss.x = boss.targetX + Math.cos(boss.t * 0.01) * 60; // Sweeping horizontal
  } else if (!boss.retreating) {
    boss.y = (gY * 0.2 + Math.sin(boss.t * 0.02) * gY * 0.25); // Regular hover for other bosses
  }
  // ── BOSS ATTACK SYSTEM (2-phase: Charge → Fire with DODGE warning) ──
  boss.shootTimer -= dt;

  // Phase 1: Charging — show DODGE! warning before firing
  if (!boss.isCharging && boss.shootTimer <= boss.shootInterval * 0.45) {
    boss.isCharging = true;
    floatingTexts.push({ x: boss.x - 20, y: boss.y - 55, text: '⚠️ DODGE!', color: '#ff2200', life: 1.2, vy: -0.4 });
  }

  // Phase 2: Fire!
  if (boss.shootTimer <= 0) {
    boss.isCharging = false;
    boss.shootTimer = boss.shootInterval * (0.7 + Math.random() * 0.6);

    if (boss.type === 'sentinel') {
      // Sentinel: Reduced bullet spread for fewer bullets
      const bs = gameMode === 'pro' ? 5.0 : 3.0;
      const salvo1 = [-0.30, 0.30];
      salvo1.forEach(offset => {
        const angle = Math.PI + offset;
        enemyBullets.push({ x: boss.x - 30, y: boss.y, vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs, r: 11, life: 1, btype: 'sentinel_plasma' });
      });
      // Second salvo delayed
      setTimeout(() => {
        if (!boss || boss.type !== 'sentinel') return;
        const salvo2 = [-0.15, 0.15];
        salvo2.forEach(offset => {
          const angle = Math.PI + offset;
          enemyBullets.push({ x: boss.x - 30, y: boss.y, vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs, r: 11, life: 1, btype: 'sentinel_plasma' });
        });
        sfx.laser();
      }, 380);
      sfx.laser();

    } else if (boss.type === 'warden') {
      // Warden: TOP + BOTTOM rows fire with a clear MIDDLE LANE safe zone. Added extreme lower bullets to hit ground targets.
      const wbs = gameMode === 'pro' ? -4.0 : -2.5;
      [-60, -30].forEach(yOff => {
        enemyBullets.push({ x: boss.x - 40, y: boss.y + yOff, vx: wbs, vy: 0, r: 13, life: 1, btype: 'warden_shell' });
      });
      setTimeout(() => {
        if (!boss || boss.type !== 'warden') return;
        [60, 110, 160, 220].forEach(yOff => {
          enemyBullets.push({ x: boss.x - 40, y: boss.y + yOff, vx: wbs, vy: 0, r: 13, life: 1, btype: 'warden_shell' });
        });
        sfx.laser();
      }, 320);
      // Slow homing fireball — easy to drift away from
      const wfb = gameMode === 'pro' ? -2.5 : -1.5;
      enemyBullets.push({ x: boss.x - 30, y: boss.y, vx: wfb, vy: 0, r: 18, life: 1, btype: 'warden_fireball' });
      sfx.laser();

    } else if (boss.type === 'overlord') {
      // Overlord: alternating UP wave / DOWN wave — player ducks to whichever side is clear
      boss._waveToggle = !boss._waveToggle;
      const yDir = boss._waveToggle ? -1 : 1;
      const bs = gameMode === 'pro' ? 3.5 : 2.0;
      [-1.5, -0.5, 0.5, 1.5].forEach(mult => {
        const angle = Math.PI + (mult * 0.14 * yDir);
        enemyBullets.push({
          x: boss.x - 50, y: boss.y + mult * 18,
          vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs * 0.5,
          r: 13, life: 1, btype: 'overlord_missile'
        });
      });
      sfx.missileLaunch();
    } else if (boss.type === 'annihilator') {
      // Annihilator: Spawns 3 massive sweeping energy waves in a fan pattern
      boss.orbitalAngle += 0.5;
      const bs = gameMode === 'pro' ? 5.5 : 4.0;
      [-0.4, 0, 0.4].forEach(offset => {
        const angle = Math.PI + offset + Math.sin(boss.orbitalAngle) * 0.3;
        enemyBullets.push({
          x: boss.x - 60, y: boss.y,
          vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs * 0.4,
          r: 18, life: 1, btype: 'annihilator_wave'
        });
      });
      sfx.missileLaunch();
    }
  }
  // Check defeated
  if (boss.hp <= 0) {
    boss.defeated = true; boss.retreating = true;
    const idx = boss.bossIdx !== undefined ? boss.bossIdx : (boss.type === 'sentinel' ? 0 : boss.type === 'warden' ? 1 : 2);
    bossDefeated[idx] = true;
    sfx.hit(); spawnP(boss.x, boss.y, '#ffaa00', 30);
  }
}

function drawBoss() {
  if (!boss) return;
  const b = boss, t = boss.t;
  ctx.save(); ctx.translate(b.x, b.y);
  if (b.type === 'sentinel') {
    // SENTINEL TURRET — large automated defense platform
    const scale = 2.2;
    ctx.scale(scale, scale);

    // Anti-Gravity Thruster Flame underneath
    ctx.save();
    ctx.translate(0, 15);
    ctx.scale(1, 1 + Math.sin(t * 0.4) * 0.3); // Pulsing thrust
    const fb = ctx.createLinearGradient(0, 0, 0, 25);
    fb.addColorStop(0, '#00f3ff'); fb.addColorStop(0.5, '#0088ff'); fb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fb;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(0, 35 + Math.random() * 10); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Base platform
    const pbg = ctx.createLinearGradient(-20, 5, 20, 20);
    pbg.addColorStop(0, '#5a6a7a'); pbg.addColorStop(1, '#3a4a5a');
    ctx.fillStyle = pbg;
    ctx.fillRect(-22, 8, 44, 14);
    ctx.fillStyle = '#4a5a6a'; ctx.fillRect(-18, 4, 36, 8);
    // Turret head (rotates slightly tracking player)
    const aimY = Math.sin(t * 0.03) * 0.15;
    ctx.save(); ctx.rotate(aimY);
    // Gun barrels
    ctx.fillStyle = '#3a4a5a';
    ctx.fillRect(-30, -4, 18, 3); ctx.fillRect(-30, 1, 18, 3);
    ctx.fillStyle = `rgba(255,100,0,${0.3 + Math.sin(t * 0.15) * 0.2})`;
    ctx.beginPath(); ctx.arc(-31, -2.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-31, 2.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Dome
    const dbg = ctx.createRadialGradient(0, -2, 3, 0, 0, 16);
    dbg.addColorStop(0, '#7a8a9a'); dbg.addColorStop(0.6, '#5a6a7a'); dbg.addColorStop(1, '#3a4a5a');
    ctx.fillStyle = dbg;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a9aaa'; ctx.lineWidth = 1; ctx.stroke();
    // Central eye
    const eyeP = 0.6 + Math.sin(t * 0.1) * 0.4;
    ctx.fillStyle = `rgba(255,40,40,${eyeP})`;
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath(); ctx.arc(-2, -2, 2.5, 0, Math.PI * 2); ctx.fill();
    // Antenna
    ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, -22); ctx.stroke();
    ctx.fillStyle = `rgba(255,0,0,${0.5 + Math.sin(t * 0.2) * 0.5})`;
    ctx.beginPath(); ctx.arc(0, -23, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (b.type === 'warden') {
    // WARDEN MECH — massive armored bipedal walker
    const scale = 2.5;
    ctx.scale(scale, scale);
    b.walkFrame = (b.walkFrame || 0) + 0.12;
    const p1 = Math.sin(b.walkFrame), p2 = Math.sin(b.walkFrame + Math.PI);
    const legL = p1 * 8, legR = p2 * 8;
    const liftL = Math.max(0, -p1 * 6), liftR = Math.max(0, -p2 * 6); // Dynamic knee lift!
    
    // Legs (multi-jointed)
    ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    // Back leg
    ctx.beginPath(); ctx.moveTo(8, 16); ctx.lineTo(12 + legR/2, 22 - liftR); ctx.lineTo(16 + legR, 30 - liftR/2); ctx.stroke();
    // Front leg
    ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(-12 + legL/2, 22 - liftL); ctx.lineTo(-16 + legL, 30 - liftL/2); ctx.stroke();
    
    ctx.fillStyle = '#3a4a5a';
    // Feet (pivot dynamically)
    ctx.fillRect(-22 + legL, 28 - liftL/2, 16, 5); ctx.fillRect(6 + legR, 28 - liftR/2, 16, 5);
    // Body
    const mbg = ctx.createLinearGradient(-20, -24, 20, 18);
    mbg.addColorStop(0, '#5a6878'); mbg.addColorStop(0.5, '#8a9aa8'); mbg.addColorStop(1, '#4a5868');
    ctx.fillStyle = mbg;
    ctx.beginPath();
    ctx.moveTo(-18, -16); ctx.lineTo(-16, -25); ctx.lineTo(16, -25); ctx.lineTo(18, -16);
    ctx.lineTo(20, 18); ctx.lineTo(-20, 18); ctx.closePath(); ctx.fill();
    // Reactor core (orange for warden)
    const cP = Math.sin(t * 0.1) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255,150,0,${cP})`;
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, -2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Head
    ctx.fillStyle = '#4a5868'; ctx.fillRect(-14, -35, 28, 12);
    const vP = 0.7 + Math.sin(t * 0.15) * 0.3;
    ctx.fillStyle = `rgba(255,60,0,${vP})`;
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10;
    ctx.fillRect(-10, -31, 20, 5); ctx.shadowBlur = 0;
    // Shoulder gatlings
    ctx.fillStyle = '#5a6878';
    ctx.fillRect(-28, -18, 12, 10); ctx.fillRect(16, -18, 12, 10);
    ctx.fillStyle = '#3a4858';
    ctx.fillRect(-30, -14, 6, 6); ctx.fillRect(24, -14, 6, 6);
    ctx.fillStyle = `rgba(255,80,0,${0.4 + Math.sin(t * 0.12) * 0.3})`;
    ctx.beginPath(); ctx.arc(-31, -11, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(28, -11, 3, 0, Math.PI * 2); ctx.fill();
  } else if (b.type === 'overlord') {
    // OVERLORD GUNSHIP — huge attack helicopter
    const scale = 2.8;
    ctx.scale(scale, scale);
    ctx.translate(0, Math.sin(t * 0.15) * 2); // Smooth hover bobbing for the entire chassis!
    b.wingFrame = (b.wingFrame || 0) + 0.4; // Faster animation
    
    // Tail
    ctx.fillStyle = '#4a5a68';
    ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(42, -4); ctx.lineTo(44, -2);
    ctx.lineTo(44, 2); ctx.lineTo(42, 4); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#dd4400'; ctx.fillRect(34, -2, 6, 4);
    
    // Engine thruster glow
    ctx.save(); ctx.translate(34, -2);
    ctx.fillStyle = `rgba(0, 243, 255, ${0.4 + Math.sin(t * 0.8) * 0.4})`;
    ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(4, 2, 4 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Tail rotor with motion blur
    ctx.save(); ctx.translate(44, 0);
    ctx.rotate(t * 0.8);
    ctx.strokeStyle = 'rgba(150,180,200,0.5)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.restore();
    // Fuselage
    const fbg = ctx.createLinearGradient(0, -16, 0, 16);
    fbg.addColorStop(0, '#6a7a88'); fbg.addColorStop(0.5, '#9aabb8'); fbg.addColorStop(1, '#5a6a78');
    ctx.fillStyle = fbg;
    ctx.beginPath();
    ctx.moveTo(-32, 0); ctx.quadraticCurveTo(-30, -14, -12, -15);
    ctx.lineTo(14, -12); ctx.lineTo(16, -6); ctx.lineTo(16, 6);
    ctx.lineTo(14, 12); ctx.lineTo(-12, 14);
    ctx.quadraticCurveTo(-30, 14, -32, 0); ctx.closePath(); ctx.fill();
    // Cockpit
    ctx.fillStyle = '#88ccff';
    ctx.beginPath();
    ctx.moveTo(-30, -2); ctx.quadraticCurveTo(-28, -9, -18, -9);
    ctx.lineTo(-14, -8); ctx.lineTo(-14, 8); ctx.lineTo(-18, 9);
    ctx.quadraticCurveTo(-28, 9, -30, 2); ctx.closePath(); ctx.fill();
    // Missile pods (larger)
    ctx.fillStyle = '#5a6a78'; ctx.fillRect(-20, 12, 20, 6); ctx.fillRect(-20, -18, 20, 6);
    ctx.fillStyle = '#dd3300';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-18 + i * 6, 15, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-18 + i * 6, -15, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Main rotor
    ctx.save(); ctx.translate(0, -16);
    ctx.fillStyle = '#6a7a88'; ctx.fillRect(-4, -7, 8, 7);
    ctx.translate(0, -7); ctx.rotate(t * 0.4);
    ctx.strokeStyle = 'rgba(120,150,180,0.7)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(38, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 38); ctx.stroke();
    ctx.fillStyle = '#dd4400';
    ctx.beginPath(); ctx.arc(38, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (b.type === 'annihilator') {
    // ANNIHILATOR DRONE — A huge floating geometric eye/core
    const scale = 2.8;
    ctx.scale(scale, scale);
    const pulse = Math.sin(t * 0.1) * 0.2 + 1.0;

    // Core glow
    ctx.shadowColor = '#cc00ff'; ctx.shadowBlur = 25 * pulse;

    // Outer floating rings
    ctx.strokeStyle = `rgba(200, 0, 255, ${0.5 + 0.3 * Math.sin(t * 0.05)})`;
    ctx.lineWidth = 3;
    ctx.save(); ctx.rotate(t * 0.02);
    ctx.beginPath(); ctx.arc(0, 0, 25 + Math.sin(t * 0.15) * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    ctx.save(); ctx.rotate(-t * 0.03);
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 32, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // Inner mechanical casing
    ctx.fillStyle = '#222233';
    ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(t * 0.3) * 1.5, 0, Math.PI * 2); ctx.fill(); // Breathing casing
    ctx.lineWidth = 2; ctx.strokeStyle = '#444455'; ctx.stroke();

    // The giant eye! (Twitching maniacally looking for the player)
    const eyeTwitchX = (Math.random() > 0.9) ? (Math.random() - 0.5) * 6 : Math.sin(t * 0.05) * 4;
    const eyeTwitchY = (Math.random() > 0.95) ? (Math.random() - 0.5) * 6 : 0;
    
    ctx.save(); ctx.translate(eyeTwitchX, eyeTwitchY);
    const ebg = ctx.createRadialGradient(0, 0, 0, 0, 0, 12 * pulse);
    ebg.addColorStop(0, '#ffffff'); ebg.addColorStop(0.3, '#ff00ff'); ebg.addColorStop(1, '#550055');
    ctx.fillStyle = ebg;
    ctx.beginPath(); ctx.arc(0, 0, 12 * pulse, 0, Math.PI * 2); ctx.fill();
    
    // Cyber pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.ellipse(0, 0, 2 + Math.random() * 0.5, 6 * pulse, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
  }
  ctx.restore();
  // Health bar
  if (b.entered && !b.retreating) drawBossHP();
}

function drawBossHP() {
  if (!boss) return;
  const W = canvas.gameW;
  const barW = Math.min(300, W * 0.85);
  const barH = 16, bx = (W - barW) / 2, by = 90;
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 4, by - 4, barW + 8, barH + 8);
  ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2; ctx.strokeRect(bx - 4, by - 4, barW + 8, barH + 8);
  // Bar fill
  const barColor = ratio > 0.5 ? '#ff4444' : ratio > 0.25 ? '#ff8800' : '#ff0000';
  ctx.fillStyle = '#331111'; ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = barColor; ctx.fillRect(bx, by, barW * ratio, barH);
  // Glow on bar
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bx, by, barW * ratio, barH / 2);
  // Boss name
  const bossName = boss.type === 'sentinel' ? '🎯 SENTINEL TURRET' : boss.type === 'warden' ? '🤖 WARDEN MECH' : '🚁 OVERLORD GUNSHIP';
  ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 8;
  ctx.fillText(bossName, W / 2, by - 8);
  ctx.shadowBlur = 0;
}

// ── SLEEK DRONE (replaces demon) ──
function drawStandard(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame;
  // Thruster
  ctx.globalAlpha = 0.6 + Math.sin(t * 0.5) * 0.2; ctx.fillStyle = '#ff3300';
  ctx.beginPath(); ctx.ellipse(-14, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Thruster trails
  if (t % 3 === 0) spawnP(e.x - 14 - Math.random() * 5, e.y + (Math.random() - 0.5) * 2, '#ffaa00', 1);

  // Sleek Drone Chassis
  ctx.fillStyle = '#222730';
  ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(10, -6); ctx.lineTo(16, 0); ctx.lineTo(10, 6); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a4454';
  ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -3); ctx.lineTo(10, 0); ctx.lineTo(6, 3); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();

  // Cyber Eye Scanner
  ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 10; ctx.fillStyle = '#00ffff';
  ctx.beginPath(); ctx.ellipse(8, 0, 3, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(9, -1, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── SPINNING ROBOT (replaces robot) ──
function drawSpinningRobot(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame; e.rot = (e.rot || 0) + 0.15;
  // Drone Body Base
  ctx.fillStyle = '#303030';
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();

  // Spinning Blades
  ctx.save(); ctx.rotate(e.rot);
  ctx.fillStyle = '#8899aa'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, -4); ctx.lineTo(24, 4); ctx.closePath(); ctx.fill();
    ctx.rotate(Math.PI * 2 / 3);
  }
  ctx.restore();

  // Core
  ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 12; ctx.fillStyle = '#ff00ff';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── ATTACK CHOPPER (replaces dragon) ──
function drawChopper(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame;
  // Tail boom
  ctx.fillStyle = '#4a5a68';
  ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(38, -4); ctx.lineTo(40, -2);
  ctx.lineTo(40, 2); ctx.lineTo(38, 4); ctx.lineTo(10, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#dd4400'; ctx.fillRect(30, -2, 6, 4);
  // Tail rotor
  ctx.save(); ctx.translate(40, 0); ctx.rotate(t * 0.5);
  ctx.strokeStyle = 'rgba(150,180,200,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
  ctx.globalAlpha = 0.1; ctx.fillStyle = '#aabbcc';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Main fuselage
  const fbg = ctx.createLinearGradient(0, -14, 0, 14);
  fbg.addColorStop(0, '#6a7a88'); fbg.addColorStop(0.5, '#9aabb8'); fbg.addColorStop(1, '#5a6a78');
  ctx.fillStyle = fbg;
  ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-28, -12, -10, -13);
  ctx.lineTo(12, -10); ctx.lineTo(14, -6); ctx.lineTo(14, 6);
  ctx.lineTo(12, 10); ctx.lineTo(-10, 12); ctx.quadraticCurveTo(-28, 12, -30, 0); ctx.closePath(); ctx.fill();
  // Cockpit
  ctx.fillStyle = '#88ccff';
  ctx.beginPath(); ctx.moveTo(-28, -2); ctx.quadraticCurveTo(-26, -8, -16, -8);
  ctx.lineTo(-12, -7); ctx.lineTo(-12, 7); ctx.lineTo(-16, 8); ctx.quadraticCurveTo(-26, 8, -28, 2); ctx.closePath(); ctx.fill();
  // Missile pods & details
  ctx.fillStyle = '#3a4a58'; ctx.fillRect(-6, -14, 16, 4);
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-18, 10, 16, 5); ctx.fillStyle = '#dd3300'; ctx.beginPath(); ctx.arc(-20, 12.5, 2, 0, Math.PI * 2); ctx.fill();
  // Skids
  ctx.strokeStyle = '#4a5a68'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-8, 18); ctx.lineTo(6, 18); ctx.stroke();
  // Main rotor
  ctx.save(); ctx.translate(0, -14); ctx.fillStyle = '#6a7a88'; ctx.fillRect(-3, -6, 6, 6);
  ctx.translate(0, -6); ctx.rotate(t * 0.35);
  ctx.strokeStyle = 'rgba(120,150,180,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-32, 0); ctx.lineTo(32, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(0, 32); ctx.stroke();
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#8899bb'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawEnemyBullet(b) {
  ctx.save(); ctx.globalAlpha = b.life;
  const t = frame;
  // Calculate angle for directional drawing
  const angle = Math.atan2(b.vy, b.vx);
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);

  if (b.btype === 'laser_beam') {
    // Cool Neon Laser Beam (Robot)
    const blur = 10 + Math.sin(t * 0.5) * 4;
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = blur;
    const len = b.r * 2.8; // Reduced size per user request
    const wid = b.r * 0.45;
    // Outer red glow beam
    ctx.fillStyle = 'rgba(255, 40, 40, 0.8)';
    ctx.beginPath(); ctx.ellipse(-len * 0.3, 0, len, wid * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    // Inner white hot core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-len * 0.2, 0, len * 0.6, wid * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  } else if (b.btype === 'fireball') {
    // Dynamic Comet Fireball (Dragon)
    const waggle = Math.sin(t * 0.6) * 3;
    // Trail
    const grad = ctx.createLinearGradient(0, 0, -b.r * 4, waggle);
    grad.addColorStop(0, 'rgba(255, 200, 0, 0.9)');
    grad.addColorStop(0.5, 'rgba(255, 50, 0, 0.5)');
    grad.addColorStop(1, 'rgba(100, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b.r, 0);
    ctx.lineTo(-b.r * 3, -b.r * 1.5 + waggle);
    ctx.lineTo(-b.r * 5, waggle * 1.5);
    ctx.lineTo(-b.r * 3, b.r * 1.5 + waggle);
    ctx.closePath(); ctx.fill();
    // Core head
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.r * 0.3, 0, b.r * 0.4, 0, Math.PI * 2); ctx.fill();
  } else if (b.btype === 'demon') {
    // Pulsing Void Orb (Scout Drone) completely decoupled from rotation for chaotic feel
    ctx.rotate(-angle); // Reverse angle to draw localized
    // Swirling black hole effect
    const pulse = b.r * (0.8 + 0.3 * Math.sin(t * 0.3));
    ctx.shadowColor = '#cc00ff'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#220044';
    ctx.beginPath(); ctx.arc(0, 0, pulse * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Core
    ctx.fillStyle = '#ff44ff';
    ctx.beginPath(); ctx.arc(0, 0, b.r * 0.6, 0, Math.PI * 2); ctx.fill();
    // Orbiting dark matter
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.3 + i * (Math.PI * 2 / 3);
      ctx.beginPath(); ctx.arc(Math.cos(a) * b.r * 1.5, Math.sin(a) * b.r * 1.5, b.r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (b.btype === 'sentinel_plasma') {
    // Massive Cyan Plasma sphere
    ctx.rotate(-angle);
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 25 + Math.sin(t * 0.5) * 15;
    // Plasma aura
    const pg = ctx.createRadialGradient(0, 0, b.r * 0.5, 0, 0, b.r * 1.8);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.3, '#00ffff'); pg.addColorStop(1, 'rgba(0,100,255,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(0, 0, b.r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Violent electrical arcs
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, b.r * 0.15);
    for (let i = 0; i < 4; i++) {
      const a = t * 0.4 + i * 1.57;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * b.r * 1.4 + (Math.random() - 0.5) * b.r, Math.sin(a) * b.r * 1.4 + (Math.random() - 0.5) * b.r);
      ctx.stroke();
    }
  } else if (b.btype === 'warden_shell') {
    // Heavy Artillery Shell
    // Smoke trail
    ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath(); ctx.arc(-b.r * 1.2 * i, 0, b.r * (0.4 + i * 0.15), 0, Math.PI * 2); ctx.fill();
    }
    // Thrust flame
    ctx.fillStyle = '#ff6600';
    ctx.beginPath(); ctx.moveTo(-b.r, -b.r * 0.4); ctx.lineTo(-b.r * 2.5, 0); ctx.lineTo(-b.r, b.r * 0.4); ctx.fill();
    ctx.fillStyle = '#ffeebb';
    ctx.beginPath(); ctx.moveTo(-b.r, -b.r * 0.2); ctx.lineTo(-b.r * 1.8, 0); ctx.lineTo(-b.r, b.r * 0.2); ctx.fill();
    // Metal shell casing
    ctx.fillStyle = '#555555';
    ctx.fillRect(-b.r, -b.r * 0.5, b.r * 1.5, b.r);
    // Dark grey tip
    ctx.fillStyle = '#222222';
    ctx.beginPath(); ctx.moveTo(b.r * 0.5, -b.r * 0.5); ctx.lineTo(b.r * 1.2, 0); ctx.lineTo(b.r * 0.5, b.r * 0.5); ctx.fill();
    // Detail lines
    ctx.strokeStyle = '#333333'; ctx.lineWidth = Math.max(1, b.r * 0.1);
    ctx.beginPath(); ctx.moveTo(-b.r * 0.5, -b.r * 0.5); ctx.lineTo(-b.r * 0.5, b.r * 0.5); ctx.stroke();
  } else if (b.btype === 'warden_fireball') {
    // Sun-like Massive Fireball
    ctx.rotate(-angle);
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 30 + Math.sin(t * 0.3) * 10;
    const wfg = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r * 1.4);
    wfg.addColorStop(0, '#ffffff'); wfg.addColorStop(0.2, '#ffcc00'); wfg.addColorStop(0.6, '#ff4400'); wfg.addColorStop(1, 'rgba(150,0,0,0)');
    ctx.fillStyle = wfg;
    ctx.beginPath(); ctx.arc(0, 0, b.r * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Chaotic sun flares
    ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
    for (let i = 0; i < 6; i++) {
      const a = t * 0.15 + i * 1.04;
      const R = b.r * (1 + 0.4 * Math.sin(t * 0.5 + i));
      ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R, b.r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (b.btype === 'overlord_missile') {
    // Advanced Sci-Fi Missile
    // Green fusion trail
    ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath(); ctx.arc(-b.r * 1.2 * i, Math.sin(t * 0.4 + i) * b.r * 0.2, b.r * (0.5 - i * 0.08), 0, Math.PI * 2); ctx.fill();
    }
    // Trust flame
    ctx.shadowColor = '#00ff55'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#aaffcc';
    ctx.beginPath(); ctx.moveTo(-b.r, -b.r * 0.3); ctx.lineTo(-b.r * 2.2, 0); ctx.lineTo(-b.r, b.r * 0.3); ctx.fill();
    ctx.shadowBlur = 0;
    // Missile Body (sleek white/grey)
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.2, b.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // Green glowing stripes
    ctx.strokeStyle = '#00ff55'; ctx.lineWidth = b.r * 0.15;
    ctx.beginPath(); ctx.moveTo(-b.r * 0.4, -b.r * 0.45); ctx.lineTo(-b.r * 0.4, b.r * 0.45); ctx.stroke();
    // High-tech red sensor tip
    ctx.fillStyle = '#ff0044';
    ctx.beginPath(); ctx.arc(b.r * 1.1, 0, b.r * 0.25, 0, Math.PI * 2); ctx.fill();
    // Fins
    ctx.fillStyle = '#888888';
    ctx.beginPath(); ctx.moveTo(-b.r * 0.6, -b.r * 0.4); ctx.lineTo(-b.r * 0.9, -b.r * 0.9); ctx.lineTo(-b.r * 0.2, -b.r * 0.4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-b.r * 0.6, b.r * 0.4); ctx.lineTo(-b.r * 0.9, b.r * 0.9); ctx.lineTo(-b.r * 0.2, b.r * 0.4); ctx.fill();
  } else if (b.btype === 'annihilator_wave') {
    // Massive spinning purple energy wave!
    ctx.rotate(-angle);
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 20;

    const pgrad = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r * 1.5);
    pgrad.addColorStop(0, '#ffffff'); pgrad.addColorStop(0.3, '#ff00ff'); pgrad.addColorStop(0.7, '#8800cc'); pgrad.addColorStop(1, 'rgba(50,0,100,0)');
    ctx.fillStyle = pgrad;
    ctx.beginPath(); ctx.arc(0, 0, b.r * 1.5, 0, Math.PI * 2); ctx.fill();

    // Core spin
    ctx.fillStyle = '#ffffff';
    ctx.rotate(t * 0.1);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(0, 0); ctx.lineTo(b.r * 2.0, -b.r * 0.2); ctx.lineTo(b.r * 2.0, b.r * 0.2); ctx.fill();
      ctx.rotate(Math.PI / 2);
    }
  }
  ctx.restore();
}
function checkCollBullet(b) {
  const px = player.x + 8, py = player.y + 8, pw = player.w - 16, ph = player.h - 16;
  return b.x + b.r > px && b.x - b.r < px + pw && b.y + b.r > py && b.y - b.r < py + ph;
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

// ── DRAW PLAYER ──────────────────────────────
function drawPlayer() {
  if (player.exploded) return;
  const px = player.x, py = player.y, t = frame;
  const { char, jet, pet } = getSkinColors();

  if (pet && pet.id !== 'none' && petObj) {
    ctx.save();
    ctx.translate(petObj.x, petObj.y + Math.sin(t * 0.1) * 6);
    if (petObj.type === 'cat') {
      const bodyC = pet.body || '#222';
      const accentC = pet.accent || '#ff2222'; // Collar
      const eyeC = pet.glow || '#ffee00'; // Eyes
      const isFiring = petObj.cooldown > 20;

      // Tail wag
      ctx.save();
      ctx.translate(-9, 0); ctx.rotate(-0.1 + Math.sin(t * 0.15) * 0.3);
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.roundRect(-2, -14, 4, 14, 2); ctx.fill(); // Base tail
      ctx.beginPath(); ctx.roundRect(-5, -14, 6, 4, 2); ctx.fill();  // Hooked tip
      ctx.restore();

      // Paws (Grey)
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.ellipse(-6, 8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-2, 8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, 8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, 8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

      // Body (Square-ish block for pixel style)
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.roundRect(-8, -4, 20, 12, 4); ctx.fill();

      // Head
      ctx.beginPath(); ctx.roundRect(0, -14, 16, 14, 4); ctx.fill();

      // Ears
      // Back Ear
      ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(4, -20); ctx.lineTo(8, -14); ctx.fill();
      // Front Ear
      ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(12, -20); ctx.lineTo(16, -14); ctx.fill();

      // Pink Inner Ears
      ctx.fillStyle = '#ff8db8';
      ctx.beginPath(); ctx.moveTo(3, -14); ctx.lineTo(4, -18); ctx.lineTo(7, -14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(11, -14); ctx.lineTo(12, -18); ctx.lineTo(15, -14); ctx.fill();

      // Collar
      ctx.fillStyle = accentC;
      ctx.beginPath(); ctx.roundRect(0, -2, 16, 3, 1); ctx.fill();
      // Bell
      ctx.fillStyle = '#fdd659';
      ctx.beginPath(); ctx.arc(10, 1, 2, 0, Math.PI * 2); ctx.fill();

      // Eyes
      ctx.fillStyle = eyeC;
      ctx.beginPath(); ctx.roundRect(4, -10, 4, 4, 1); ctx.fill();
      ctx.beginPath(); ctx.roundRect(12, -10, 4, 4, 1); ctx.fill();

      // Nose
      ctx.fillStyle = '#ff8db8';
      ctx.beginPath(); ctx.arc(10, -5, 1.5, 0, Math.PI * 2); ctx.fill();

      // Whiskers
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(-2, -7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(-2, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, -6); ctx.lineTo(22, -7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, -4); ctx.lineTo(22, -3); ctx.stroke();

      // Mouth
      ctx.fillStyle = '#ff8db8';
      if (isFiring) {
        ctx.beginPath(); ctx.arc(10, -2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a0000';
        ctx.beginPath(); ctx.arc(10, -2, 1, 0, Math.PI * 2); ctx.fill();
      }
    } else if (petObj.type === 'ufo') {
      // Thruster Engine Pulse
      const pPulse = Math.sin(t * 0.2) * 0.5 + 0.5;
      ctx.fillStyle = pet.glow || '#00f3ff'; ctx.shadowBlur = 10; ctx.shadowColor = pet.glow;
      ctx.globalAlpha = pPulse * 0.8 + 0.2;
      ctx.beginPath(); ctx.ellipse(0, 6, 8, 3 + pPulse * 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
      // Glass Dome
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath(); ctx.arc(0, -2, 10, 0, Math.PI, true); ctx.fill();
      // Alien Inside
      ctx.fillStyle = '#33ff33'; ctx.shadowBlur = 5; ctx.shadowColor = '#33ff33';
      ctx.beginPath(); ctx.arc(3, -2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Saucer Body
      ctx.fillStyle = pet.body || '#222';
      ctx.beginPath(); ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
      // Blinking Navigation Lights
      ctx.fillStyle = pet.glow || '#00f3ff'; ctx.shadowBlur = 6; ctx.shadowColor = pet.glow;
      if (Math.sin(t * 0.1) > 0) { ctx.beginPath(); ctx.arc(-11, 1, 2, 0, Math.PI * 2); ctx.fill(); }
      if (Math.sin(t * 0.1 + 1) > 0) { ctx.beginPath(); ctx.arc(0, 3, 2, 0, Math.PI * 2); ctx.fill(); }
      if (Math.sin(t * 0.1 + 2) > 0) { ctx.beginPath(); ctx.arc(11, 1, 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (petObj.type === 'dragon') {
      const bodyC = pet.body || '#fde2c9'; // Peach body
      const wingC = pet.glow || '#a74345'; // Dark red wings
      const accentC = pet.accent || '#fdd659'; // Yellow belly/spade
      const wingFlap = Math.sin(t * 0.35) * 0.7;

      ctx.save();
      ctx.translate(-5, -6); // Adjust center
      ctx.scale(0.75, 0.75); // Scale down by 25%

      // Back Wing
      ctx.save();
      ctx.translate(2, -2); ctx.rotate(-0.1 + wingFlap);
      ctx.fillStyle = wingC; ctx.shadowBlur = 4; ctx.shadowColor = wingC;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-4, -14);
      ctx.lineTo(-6, -22);
      ctx.quadraticCurveTo(-2, -18, 4, -16);
      ctx.quadraticCurveTo(8, -10, 12, -4);
      ctx.quadraticCurveTo(6, 0, 4, 4);
      ctx.quadraticCurveTo(2, 2, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(12, -4); ctx.stroke();
      ctx.restore();

      // Tail
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(-18, 14); ctx.lineTo(-24, 10);
      ctx.lineTo(-20, 18); ctx.lineTo(-10, 20); ctx.closePath(); ctx.fill();

      // Tail Spade (yellow tip)
      ctx.fillStyle = accentC; ctx.shadowBlur = 6; ctx.shadowColor = accentC;
      ctx.beginPath(); ctx.moveTo(-24, 10); ctx.lineTo(-32, 8); ctx.lineTo(-28, 14);
      ctx.lineTo(-30, 20); ctx.lineTo(-20, 18); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;

      // Back Leg
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.ellipse(-6, 20, 5, 4, 0, 0, Math.PI * 2); ctx.fill();

      // Main Body
      ctx.beginPath(); ctx.ellipse(0, 12, 14, 11, -0.2, 0, Math.PI * 2); ctx.fill();

      // Yellow Belly
      ctx.fillStyle = accentC;
      ctx.beginPath(); ctx.ellipse(6, 15, 7, 7, -0.4, 0, Math.PI * 2); ctx.fill();

      // Front Leg
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.ellipse(6, 22, 6, 4, 0, 0, Math.PI * 2); ctx.fill();

      // Little Arm (T-Rex style)
      ctx.beginPath(); ctx.ellipse(14, 12, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();

      // Neck
      ctx.beginPath(); ctx.ellipse(8, 2, 8, 10, 0.5, 0, Math.PI * 2); ctx.fill();

      // Head Base
      ctx.beginPath(); ctx.roundRect(-2, -18, 20, 20, 8); ctx.fill();

      // Jaw Animation Logic (Opens mouth when recently fired: Cooldown max is 130)
      const isFiring = petObj.cooldown > 115;
      const jawDrop = isFiring ? 5 : 0;

      // Snout (Upper Jaw)
      ctx.beginPath(); ctx.roundRect(10, -10, 16, 9, 4); ctx.fill();

      if (isFiring) {
        // Dark inside of mouth
        ctx.fillStyle = '#4a0000';
        ctx.beginPath(); ctx.roundRect(12, -2, 12, jawDrop + 2, 2); ctx.fill();
        ctx.fillStyle = bodyC;
      }

      // Snout (Lower Jaw)
      ctx.beginPath(); ctx.roundRect(10, -2 + jawDrop, 14, 6, 3); ctx.fill();

      // Nostril
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(22, -4, 1.5, 0, Math.PI * 2); ctx.fill();

      // Cute Blush
      ctx.fillStyle = '#ff8db8'; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(13, -1, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1.0;

      // Cute Black Eye
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(16, -10, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      // White glint
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(17, -11, 1.2, 0, Math.PI * 2); ctx.fill();

      // Horns (White)
      ctx.fillStyle = '#fff'; ctx.shadowBlur = 4; ctx.shadowColor = '#fff';
      // Back horn
      ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(2, -28); ctx.lineTo(8, -18); ctx.fill();
      // Front horn (bigger)
      ctx.beginPath(); ctx.moveTo(8, -18); ctx.lineTo(8, -30); ctx.lineTo(16, -18); ctx.fill();
      ctx.shadowBlur = 0;

      // Front Wing
      ctx.save();
      ctx.translate(2, -2); ctx.rotate(-0.1 - wingFlap * 1.2);
      ctx.fillStyle = wingC; ctx.globalAlpha = 0.95;
      ctx.shadowBlur = 8; ctx.shadowColor = wingC;

      ctx.beginPath();
      ctx.moveTo(0, 0); // Wing root
      ctx.lineTo(-6, -18); // Mid joint
      ctx.lineTo(-8, -28); // Top wing tip

      // Scalloped trailing edge
      ctx.quadraticCurveTo(-2, -22, 6, -20); // Top web
      ctx.quadraticCurveTo(12, -14, 16, -6); // Mid web
      ctx.quadraticCurveTo(10, -2, 6, 6); // Bottom web
      ctx.quadraticCurveTo(2, 4, 0, 0); // Return
      ctx.closePath();
      ctx.fill();

      // Wing ribs (shadows)
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(6, -20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(16, -6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(6, 6); ctx.stroke();

      ctx.restore();

      ctx.restore();
    }
    ctx.restore();
  }


  const cBody = char.body;
  const cAccent = char.accent;
  const cGlow = char.glow;
  const cSaber = char.saber;

  player.scarf += 0.18;
  player.trail.push({ x: px, y: py, life: 1 });
  if (player.trail.length > 12) player.trail.shift();
  // Trail
  player.trail.forEach(tr => {
    tr.life -= 0.09; if (tr.life <= 0) return;
    ctx.save(); ctx.globalAlpha = tr.life * 0.15; ctx.fillStyle = shieldActive ? '#44ff88' : cGlow;
    ctx.beginPath(); ctx.ellipse(tr.x + player.w * .5, tr.y + player.h * .5, player.w * .2 * tr.life, player.h * .15 * tr.life, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });
  if (player.onGround && state === 'playing') player.runFrame += 0.35;
  const bob = (player.onGround && state === 'playing') ? Math.abs(Math.sin(player.runFrame)) * 5 : 0;

  let renderY = py - bob;
  let tilt = state === 'dying' ? (player.rotation || 0) : Math.max(-0.2, Math.min(0.2, player.vy * 0.02));
  if (player.onGround && state === 'playing') tilt = 0.12; // Forward sprint posture

  ctx.save(); ctx.translate(px + player.w * .5, renderY + player.h * .5);
  ctx.rotate(tilt);
  if (invincible > 0 && Math.floor(invincible / 4) % 2 === 0) { ctx.restore(); return; }
  // Shield bubble
  if (shieldActive) {
    ctx.save(); ctx.globalAlpha = .2 + .1 * Math.sin(t * .1); ctx.strokeStyle = '#44ff88'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .06; ctx.fillStyle = '#44ff88'; ctx.fill(); ctx.restore();
  }

  // ── JETPACK (Dynamic Shapes) ──
  ctx.save();
  if (jet.id === 'dragon') {
    // Golden Dragon Turbine
    ctx.fillStyle = '#553300'; ctx.fillRect(-player.w * .55, -8, 14, 28);
    ctx.fillStyle = '#ccaa00'; ctx.fillRect(-player.w * .55 + 2, -5, 10, 20); // Gold plates
    ctx.fillStyle = '#ff4400'; ctx.fillRect(-player.w * .55 + 1, 10, 4, 8); // Red vents
    ctx.fillStyle = '#222'; ctx.fillRect(-player.w * .55 + 2, 20, 10, 6); // Wide nozzle
  } else if (jet.id === 'void') {
    // Void Singularity Core
    ctx.translate(-player.w * .5, 5);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#aa00ff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    // Orbit rings
    ctx.strokeStyle = `rgba(170,0,255,${0.5 + Math.sin(t * .2) * 0.5})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, t * .1, 0, Math.PI * 2); ctx.stroke();
  } else {
    // Plasma Pack (Default)
    ctx.fillStyle = '#1c1f26'; ctx.fillRect(-player.w * .55, -8, 12, 26);
    ctx.fillStyle = '#2b303a'; ctx.fillRect(-player.w * .55 + 2, -5, 8, 20);
    ctx.fillStyle = '#00f3ff'; ctx.fillRect(-player.w * .55 + 1, 8, 2, 6); // glowing accent
    ctx.fillStyle = '#111'; ctx.fillRect(-player.w * .55 + 2, 18, 8, 5); // Nozzles
  }
  ctx.restore();

  // ── JETPACK FLAMES & EXHAUST ──
  if (isHolding && state === 'playing' && !player.onGround) {
    ctx.save();
    const fx = -player.w * .44, fy = 20;
    if (jet.id === 'dragon') {
      const fH = 25 + Math.random() * 15;
      const fg = ctx.createLinearGradient(fx, fy, fx, fy + fH);
      fg.addColorStop(0, '#ffff00'); fg.addColorStop(.3, '#ffaa00'); fg.addColorStop(.7, '#ff0000'); fg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.lineTo(fx - 2, fy + fH); ctx.lineTo(fx + 8, fy + fH * 0.8); ctx.lineTo(fx + 10, fy); ctx.fill();
      if (frame % 2 === 0) spawnP(px + player.w * .1, py + player.h * .8, '#ff9900', 1.5);
    } else if (jet.id === 'void') {
      ctx.strokeStyle = `rgba(170,0,255,${0.8 - (frame % 15) / 15})`; ctx.lineWidth = 3;
      const ps = (frame % 15) / 15;
      ctx.beginPath(); ctx.ellipse(fx + 3, fy + ps * 25, 8 + ps * 12, 3 + ps * 6, 0, 0, Math.PI * 2); ctx.stroke();
      if (frame % 3 === 0) spawnP(px + player.w * .1, py + player.h * .8, '#aa00ff', 1);
    } else {
      const fH = 22 + Math.random() * 14;
      const fg = ctx.createLinearGradient(fx, fy, fx, fy + fH);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(.2, '#00f3ff'); fg.addColorStop(.6, '#0044ff'); fg.addColorStop(1, 'rgba(0,100,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.quadraticCurveTo(fx + Math.random() * 5 - 2, fy + fH * .6, fx, fy + fH);
      ctx.quadraticCurveTo(fx + Math.random() * 5, fy + fH * .6, fx + 8, fy); ctx.closePath(); ctx.fill();
      if (frame % 2 === 0) spawnP(px + player.w * .1, py + player.h * .8, '#00f3ff', 1);
    }
    ctx.restore();
  }

  const legColor = char.id === 'apsara' ? cAccent : '#1a1d24'; // Brighter gold/white legs for Apsara
  if (player.onGround) {
    const lL = Math.sin(player.runFrame) * 14; // Wider stride
    const lR = Math.sin(player.runFrame + Math.PI) * 14;

    // Calculate foot lift (lifts foot during forward swing)
    const liftL = Math.max(0, -Math.sin(player.runFrame) * 8);
    const liftR = Math.max(0, -Math.sin(player.runFrame + Math.PI) * 8);

    // Left Leg
    const footLX = -5 + lL;
    const footLY = 25 - liftL + bob; // Extend legs dynamically down to ground
    ctx.save(); ctx.strokeStyle = legColor; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-5, 12);
    ctx.lineTo(-5 + lL / 2 + (liftL > 0 ? 6 : -3), 18 - liftL / 2 + bob / 2); // Dynamic knee joint
    ctx.lineTo(footLX, footLY); ctx.stroke();

    // Left Boot
    ctx.fillStyle = cAccent; ctx.beginPath(); ctx.roundRect(footLX - 6, footLY - 3, 14, 6, 2); ctx.fill();
    ctx.fillStyle = cGlow; ctx.fillRect(footLX - 4, footLY, 4, 3);
    ctx.restore();

    // Right Leg
    const footRX = 5 + lR;
    const footRY = 25 - liftR + bob; // Extend legs dynamically down to ground
    ctx.save(); ctx.strokeStyle = legColor; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(5, 12);
    ctx.lineTo(5 + lR / 2 + (liftR > 0 ? 6 : -3), 18 - liftR / 2 + bob / 2); // Dynamic knee joint
    ctx.lineTo(footRX, footRY); ctx.stroke();

    // Right Boot
    ctx.fillStyle = cAccent; ctx.beginPath(); ctx.roundRect(footRX - 6, footRY - 3, 14, 6, 2); ctx.fill();
    ctx.fillStyle = cGlow; ctx.fillRect(footRX - 4, footRY, 4, 3);
    ctx.restore();
  } else {
    // Flying logic
    const d2 = Math.sin(frame * .08) * 4;
    ctx.save(); ctx.strokeStyle = legColor; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Left leg flying
    ctx.beginPath(); ctx.moveTo(-5, 12);
    ctx.lineTo(-8 + d2 / 2, 17);
    ctx.lineTo(-8 + d2, 23); ctx.stroke();

    // Right leg flying
    ctx.beginPath(); ctx.moveTo(5, 12);
    ctx.lineTo(8 - d2 / 2, 17);
    ctx.lineTo(8 - d2, 23); ctx.stroke(); ctx.restore();

    // Flying Boots
    ctx.fillStyle = cAccent; ctx.beginPath(); ctx.roundRect(-14 + d2, 20, 14, 6, 2); ctx.fill();
    ctx.fillStyle = cGlow; ctx.fillRect(-12 + d2, 23, 4, 3);

    ctx.fillStyle = cAccent; ctx.beginPath(); ctx.roundRect(2 - d2, 20, 14, 6, 2); ctx.fill();
    ctx.fillStyle = cGlow; ctx.fillRect(4 - d2, 23, 4, 3);
  }

  // ── TORSO (Cyber Suit) ──
  ctx.save();
  ctx.fillStyle = cAccent;
  ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(-8, -14); ctx.lineTo(8, -14); ctx.lineTo(11, -8);
  ctx.lineTo(12, 13); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = cBody;
  ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(7, -12); ctx.lineTo(9, 2); ctx.lineTo(-9, 2); ctx.closePath(); ctx.fill();
  ctx.shadowColor = cGlow; ctx.shadowBlur = 10;
  ctx.fillStyle = cGlow; ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = cBody; ctx.fillRect(-13, 9, 26, 5); // Belt
  ctx.fillStyle = cGlow; ctx.fillRect(-3, 10, 6, 3);
  ctx.restore();

  // ── ARMS & WEAPON ──
  const armSwing = player.onGround ? Math.sin(player.runFrame * 0.5) * 0.2 : Math.sin(frame * 0.05) * 0.1;
  const attackAngle = player.onGround ? 0 : (player.vy * 0.05);

  // Back Arm
  ctx.save(); ctx.translate(-10, -6); ctx.rotate(-0.4 + armSwing);
  ctx.fillStyle = cBody; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cAccent; ctx.fillRect(-3, 0, 6, 16);
  ctx.restore();

  // ── HEAD (Dynamic Helmets) ──
  ctx.save();
  ctx.fillStyle = cBody;
  ctx.beginPath(); ctx.arc(0, -22, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-10, -22, 20, 10);

  if (char.id === 'apsara') {
    // Golden Halo
    ctx.fillStyle = cGlow;
    ctx.beginPath(); ctx.moveTo(-10, -28); ctx.lineTo(-14, -36); ctx.lineTo(-6, -28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, -30); ctx.lineTo(0, -42); ctx.lineTo(2, -30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, -28); ctx.lineTo(14, -36); ctx.lineTo(10, -28); ctx.fill();
    // Sun Visor
    ctx.shadowColor = cGlow; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(2, -22, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (char.id === 'demon') {
    // Demonic Horns
    ctx.fillStyle = cGlow;
    ctx.beginPath(); ctx.moveTo(-8, -28); ctx.lineTo(-14, -40); ctx.lineTo(-3, -30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -30); ctx.lineTo(14, -40); ctx.lineTo(8, -28); ctx.fill();
    // Slit Visor
    ctx.shadowColor = cGlow; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(8, -20); ctx.lineTo(0, -22); ctx.lineTo(-8, -20); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // Cyber Ninja Visor
    ctx.fillStyle = cAccent; ctx.fillRect(-11, -22, 22, 4); // Ridge
    ctx.shadowColor = cGlow; ctx.shadowBlur = 12 + Math.sin(t * 0.5) * 4;
    ctx.fillStyle = cGlow; ctx.beginPath(); ctx.roundRect(-3, -24, 14, 5, 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Ear piece
    ctx.fillStyle = cAccent; ctx.beginPath(); ctx.arc(-6, -20, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Front Arm + ENERGY SABER
  const swingPhase = player.saberSwing || 0;

  // High-Velocity Slash Trail
  if (swingPhase > 0.05) {
    ctx.save(); ctx.translate(10, -6);
    ctx.rotate(0.3 - armSwing * 0.5 - attackAngle * 0.5); // Anchor to shoulder
    ctx.globalAlpha = Math.min(1, swingPhase * 1.5);
    ctx.shadowColor = cSaber; ctx.shadowBlur = 20 + Math.random() * 10;

    // Gradient arc
    const arcG = ctx.createLinearGradient(-10, -40, 30, 30);
    arcG.addColorStop(0, 'rgba(255,255,255,0.9)');
    arcG.addColorStop(0.4, cSaber);
    arcG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = arcG;

    ctx.beginPath();
    ctx.moveTo(-10, -45);
    ctx.quadraticCurveTo(55, -40, 25, 45); // Outer massive sweep
    ctx.quadraticCurveTo(35, -5, -5, -35); // Sharp inner hook returning to hilt
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Saber snaps down dramatically and organic spring back up
  const swingOffset = swingPhase > 0 ? Math.sin(swingPhase * Math.PI) * 1.6 : 0;

  ctx.save(); ctx.translate(10, -6); ctx.rotate(0.3 - armSwing * 0.5 - attackAngle * 0.5 + swingOffset);
  ctx.fillStyle = cBody; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cAccent; ctx.fillRect(-3, 0, 7, 14);

  ctx.translate(1, 14); // Hand grip
  ctx.rotate(-1.6); // Forward horizontal point

  // Hilt
  ctx.fillStyle = cAccent; ctx.fillRect(-3, -2, 6, 12);
  ctx.fillStyle = '#222'; ctx.fillRect(-4, -4, 8, 3);
  ctx.fillStyle = cGlow; ctx.fillRect(-1, 8, 2, 2);

  // Energy Saber Blade
  const sLen = 38 + Math.random() * 2;
  ctx.shadowColor = cSaber; ctx.shadowBlur = 20 + Math.sin(t * 0.7) * 5;
  ctx.fillStyle = cSaber;
  ctx.beginPath(); ctx.roundRect(-3, -sLen - 4, 6, sLen, 3); ctx.fill();
  ctx.shadowBlur = 0;

  // White plasma core inside sword
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-1.5, -sLen - 3, 3, sLen - 2, 1.5); ctx.fill();

  // Speed lines trailing off sword when flying fast
  if (!player.onGround && player.vy > 1) {
    ctx.globalAlpha = 0.4; ctx.fillStyle = cSaber;
    ctx.beginPath(); ctx.moveTo(-3, -sLen); ctx.lineTo(-18, -sLen - player.vy * 2); ctx.lineTo(0, -4); ctx.fill();
  }
  ctx.restore();

  // Speed aura
  if (activePU === 'speed') {
    ctx.save(); ctx.globalAlpha = .25 + .12 * Math.sin(t * .25);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 40); sg.addColorStop(0, 'rgba(0,200,255,.4)'); sg.addColorStop(1, 'rgba(0,100,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // Ultimate aura (purple + gold electric)
  if (activePU === 'ultimate') {
    ctx.save();
    // Inner gold shield glow
    ctx.globalAlpha = .2 + .1 * Math.sin(t * .15); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.stroke();
    // Outer purple energy ring
    ctx.globalAlpha = .3 + .12 * Math.sin(t * .2);
    const ug = ctx.createRadialGradient(0, 0, 10, 0, 0, 48); ug.addColorStop(0, 'rgba(200,80,255,.4)'); ug.addColorStop(0.6, 'rgba(150,0,255,.2)'); ug.addColorStop(1, 'rgba(100,0,200,0)');
    ctx.fillStyle = ug; ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill();
    // Electric arcs
    ctx.save(); ctx.rotate(t * 0.06); ctx.strokeStyle = 'rgba(200,100,255,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 36 + Math.sin(t * 0.15 + i) * 6, i * 2.09, i * 2.09 + 1.2); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }
  ctx.restore();
}

// ── DRAW OBSTACLES ──────────────────────────
function drawObstacles() {
  obstacles.forEach(ob => {
    if (ob.type === 'laser') drawLaser(ob);
    else if (ob.type === 'laser_horiz') drawLaserHoriz(ob);
    else if (ob.type === 'electric') drawElec(ob);
  });
}
function drawLaserHoriz(ob) {
  ctx.save();
  const W = canvas.gameW;

  // Jetpack Joyride Emitter Pods (D-shaped bullet)
  const drawPod = (x, flip) => {
    ctx.save(); ctx.translate(x, ob.y + ob.beamH / 2);
    if (flip) ctx.scale(-1, 1);

    // Grey metallic base
    ctx.fillStyle = '#9aa1a6'; ctx.beginPath();
    ctx.arc(0, 0, 18, Math.PI * 0.5, Math.PI * 1.5, false); // Half circle bullet shape
    ctx.lineTo(24, -18); ctx.lineTo(24, 18); ctx.closePath(); ctx.fill();
    // Inner dark circle
    ctx.fillStyle = '#61676d'; ctx.beginPath(); ctx.arc(-2, 0, 8, 0, Math.PI * 2); ctx.fill();
    // Red bright edge emitting the laser
    ctx.fillStyle = '#ff3300'; ctx.fillRect(20, -18, 4, 36);
    ctx.restore();
  };

  drawPod(18, false);        // Left pod
  drawPod(W - 18, true);     // Right pod

  const lx = 42, rx = W - 42; // Beam exact horizontal boundaries

  // Warning phase
  if (ob.warningTimer > 0) {
    const flash = Math.sin(frame * 0.4) > 0;
    if (flash || ob.warningTimer < 20) {
      // Thin red warning line exactly like Jetpack Joyride
      ctx.strokeStyle = `rgba(255,0,0, ${ob.warningTimer < 20 ? 1 : 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, ob.y + ob.beamH / 2); ctx.lineTo(rx, ob.y + ob.beamH / 2); ctx.stroke();
    }
  }

  // Active Laser Beam
  if (ob.beamOn) {
    // Massive Golden/Orange Beam!
    const thickness = ob.beamH + (Math.sin(frame * 0.8) * 6);

    // Ambient red outer glow
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ff0000'; ctx.fillRect(lx, ob.y + ob.beamH / 2 - thickness / 2 - 10, rx - lx, thickness + 20);
    ctx.globalAlpha = 1;

    // Golden gradient core
    const bg = ctx.createLinearGradient(0, ob.y + ob.beamH / 2 - thickness / 2, 0, ob.y + ob.beamH / 2 + thickness / 2);
    bg.addColorStop(0, 'rgba(255,50,0,0)');
    bg.addColorStop(0.2, '#ff3300'); // red orange
    bg.addColorStop(0.5, '#ffff55'); // thick yellow white core
    bg.addColorStop(0.8, '#ff3300');
    bg.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(lx, ob.y + ob.beamH / 2 - thickness / 2, rx - lx, thickness);

    // Emitter blasts overlapping at the ends
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(lx, ob.y + ob.beamH / 2, thickness / 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx, ob.y + ob.beamH / 2, thickness / 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function drawLaser(ob) {
  ctx.save();
  const cx = ob.x + ob.w / 2;
  const hl = ob.len / 2;

  ctx.translate(cx, ob.cy);
  ctx.rotate(ob.angle);

  // Cyberpunk Laser Emitters (Blue Theme)
  const drawNode = (yPos) => {
    ctx.fillStyle = '#1c1f26'; ctx.fillRect(-ob.w / 2 - 4, yPos - 9, ob.w + 8, 18);
    ctx.fillStyle = '#2b303a'; ctx.fillRect(-ob.w / 2 - 2, yPos - 8, ob.w + 4, 16);
    ctx.fillStyle = '#00f3ff'; ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 12;
    ctx.fillRect(-ob.w / 2 + 4, yPos - 3, ob.w - 8, 6);
    ctx.shadowBlur = 0;
  };

  drawNode(-hl);
  drawNode(hl);

  // Warning phase
  if (ob.warningTimer > 0) {
    const fl = Math.sin(frame * .3) * .5 + .5; ctx.fillStyle = `rgba(0,240,255,${fl * .7})`;
    ctx.beginPath(); ctx.arc(0, -hl, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, hl, 6, 0, Math.PI * 2); ctx.fill();
  }

  // Active Laser Beam
  if (ob.beamOn) {
    // Outer ambient glow width
    ctx.globalAlpha = .2; ctx.fillStyle = '#00f3ff'; ctx.fillRect(-ob.w / 2 - 10, -hl, ob.w + 20, ob.len);
    ctx.globalAlpha = 1;

    // Gradient core beam
    const bg = ctx.createLinearGradient(-ob.w / 2, 0, ob.w / 2, 0);
    bg.addColorStop(0, 'rgba(0,80,255,.1)'); bg.addColorStop(.3, 'rgba(0,200,255,.9)');
    bg.addColorStop(.5, 'rgba(255,255,255,1)');
    bg.addColorStop(.7, 'rgba(0,200,255,.9)'); bg.addColorStop(1, 'rgba(0,80,255,.1)');
    ctx.fillStyle = bg; ctx.fillRect(-ob.w / 2 - 6, -hl, ob.w + 12, ob.len);

    // Intense internal solid core
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 8;
    ctx.fillRect(- 2, -hl, 4, ob.len);
  }
  ctx.restore();
}
function drawElec(ob) {
  ctx.save();
  const cx = ob.x + ob.w / 2;
  const hl = ob.len / 2;

  // Cybperpunk Base Nodes
  const bw = 32, bh = 20;

  ctx.translate(cx, ob.cy);
  ctx.rotate(ob.angle);

  ctx.fillStyle = '#1c1f26'; ctx.fillRect(-bw / 2, -hl - bh / 2, bw, bh);
  ctx.fillRect(-bw / 2, hl - bh / 2, bw, bh);
  ctx.fillStyle = '#2b303a'; ctx.fillRect(-bw / 2 + 2, -hl - bh / 2 + 2, bw - 4, bh - 4);
  ctx.fillRect(-bw / 2 + 2, hl - bh / 2 + 2, bw - 4, bh - 4);

  // Red glowing nodes
  ctx.fillStyle = '#ff0033';
  ctx.shadowColor = '#ff0033'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(0, -hl, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, hl, 6, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  if (ob.on) {
    ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 3.5; ctx.globalAlpha = .8 + .2 * Math.sin(frame * .3);
    for (let a = 0; a < 3; a++) {
      ctx.beginPath(); ctx.moveTo(0, -hl);
      for (let s = 1; s <= 8; s++) { ctx.lineTo((Math.random() - .5) * 35 * Math.sin(frame * .2 + a), -hl + ob.len * (s / 8)); }
      ctx.stroke();
    }
    // Bright hot core lightning
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.moveTo(0, -hl);
    for (let s = 1; s <= 5; s++) { ctx.lineTo((Math.random() - .5) * 12, -hl + ob.len * (s / 5)); }
    ctx.stroke();

    // Ambient red light shaft (Wider)
    ctx.globalAlpha = .18;
    const lg = ctx.createLinearGradient(-30, 0, 30, 0);
    lg.addColorStop(0, 'rgba(255,0,50,0)'); lg.addColorStop(0.5, '#ff0033'); lg.addColorStop(1, 'rgba(255,0,50,0)');
    ctx.fillStyle = lg; ctx.fillRect(-30, -hl, 60, ob.len);
  }
  ctx.restore();
}
function drawMissiles() {
  missiles.forEach(m => {
    ctx.save(); ctx.translate(m.x, m.y);
    // Trailing glow
    ctx.globalAlpha = 0.15;
    const tg = ctx.createRadialGradient(-m.w * .2, 0, 0, -m.w * .2, 0, m.h * 1.5);
    tg.addColorStop(0, 'rgba(255,100,0,0.5)'); tg.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(-m.w * .2, 0, m.h * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Missile body (metallic gradient)
    const bg = ctx.createLinearGradient(0, -m.h / 2, 0, m.h / 2);
    bg.addColorStop(0, '#888'); bg.addColorStop(0.3, '#aaa'); bg.addColorStop(0.5, '#ccc');
    bg.addColorStop(0.7, '#999'); bg.addColorStop(1, '#666');
    ctx.fillStyle = bg; ctx.beginPath();
    ctx.moveTo(m.w * 0.8, 0); ctx.lineTo(m.w * 0.1, -m.h / 2); ctx.lineTo(-m.w * .3, -m.h / 2);
    ctx.lineTo(-m.w * .3, m.h / 2); ctx.lineTo(m.w * 0.1, m.h / 2); ctx.closePath(); ctx.fill();
    // Nose cone (red)
    const ng = ctx.createLinearGradient(m.w * 0.7, 0, m.w, 0);
    ng.addColorStop(0, '#cc2200'); ng.addColorStop(0.5, '#ff3311'); ng.addColorStop(1, '#ee2200');
    ctx.fillStyle = ng; ctx.beginPath();
    ctx.moveTo(m.w, 0); ctx.lineTo(m.w * 0.7, -m.h * 0.35); ctx.lineTo(m.w * 0.7, m.h * 0.35); ctx.closePath(); ctx.fill();
    // Fins
    ctx.fillStyle = '#cc3322';
    ctx.beginPath(); ctx.moveTo(-m.w * .25, -m.h / 2); ctx.lineTo(-m.w * .35, -m.h * 0.9);
    ctx.lineTo(-m.w * .15, -m.h / 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-m.w * .25, m.h / 2); ctx.lineTo(-m.w * .35, m.h * 0.9);
    ctx.lineTo(-m.w * .15, m.h / 2); ctx.closePath(); ctx.fill();
    // Body stripe
    ctx.fillStyle = '#dd4422'; ctx.fillRect(-m.w * 0.1, -m.h * 0.15, m.w * 0.5, m.h * 0.3);
    // Window
    ctx.fillStyle = '#88ddff'; ctx.beginPath(); ctx.arc(m.w * 0.5, 0, m.h * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(m.w * 0.48, -m.h * 0.05, m.h * 0.08, 0, Math.PI * 2); ctx.fill();
    // Exhaust flames (multi-layer)
    const eL = 18 + Math.random() * 14;
    // Outer flame (orange)
    ctx.fillStyle = `rgba(255,150,0,${.4 + Math.random() * .3})`;
    ctx.beginPath(); ctx.moveTo(-m.w * .3, -m.h * .4); ctx.lineTo(-m.w * .3 - eL * 1.2, 0);
    ctx.lineTo(-m.w * .3, m.h * .4); ctx.closePath(); ctx.fill();
    // Inner flame (yellow-white)
    ctx.fillStyle = `rgba(255,220,80,${.5 + Math.random() * .3})`;
    ctx.beginPath(); ctx.moveTo(-m.w * .3, -m.h * .2); ctx.lineTo(-m.w * .3 - eL * 0.7, 0);
    ctx.lineTo(-m.w * .3, m.h * .2); ctx.closePath(); ctx.fill();
    // Core (white)
    ctx.fillStyle = `rgba(255,255,220,${.6 + Math.random() * .3})`;
    ctx.beginPath(); ctx.moveTo(-m.w * .3, -m.h * .1); ctx.lineTo(-m.w * .3 - eL * 0.3, 0);
    ctx.lineTo(-m.w * .3, m.h * .1); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  // Warnings
  missileWarnings.forEach(w => {
    const W = canvas.gameW;
    ctx.save(); ctx.globalAlpha = .5 + .5 * Math.sin(frame * .25);
    ctx.fillStyle = '#ff3344'; ctx.font = 'bold 36px sans-serif';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 20;
    ctx.textAlign = 'right'; ctx.fillText('⚠️ 🚀', W - 20, w.y + 8);
    ctx.shadowBlur = 0; ctx.restore();
  });
}

// ── DRAW COINS & PICKUPS ────────────────────
function drawCoin(c) {
  if (c.collected) return;
  c.bob += 0.05;
  const cy = c.y + Math.sin(c.bob) * 3;

  ctx.save(); ctx.globalAlpha = c.alpha;
  ctx.translate(c.x, cy);

  // 3D edge (drop shadow / thickness) drawn bottom-right
  ctx.fillStyle = '#b36b00';
  ctx.beginPath(); ctx.arc(2, 2, c.r, 0, Math.PI * 2); ctx.fill();

  // Outer rim
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();

  // Inner darker circle
  ctx.fillStyle = '#d99a00';
  ctx.beginPath(); ctx.arc(0, 0, c.r * 0.7, 0, Math.PI * 2); ctx.fill();

  // Vertical slit (Sci-fi coin detail)
  ctx.fillStyle = '#aa6600';
  ctx.fillRect(-c.r * 0.15, -c.r * 0.4, c.r * 0.3, c.r * 0.8);

  // Bright highlight
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(-c.r * 0.4, -c.r * 0.4, c.r * 0.15, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}
function drawPickup2(p) {
  p.bob += .07; const py = p.y + Math.sin(p.bob) * 5; ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, py);
  if (p.type === 'ultimate') {
    // Ultimate pack — golden star with purple/gold energy
    const t = frame;
    const pulseS = 1 + Math.sin(t * 0.12) * 0.1;
    ctx.scale(pulseS, pulseS);
    ctx.save(); ctx.rotate(t * 0.04);
    // Rotating energy ring
    ctx.globalAlpha = p.alpha * 0.25;
    ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 1.2); ctx.stroke();
    ctx.strokeStyle = '#44ccff'; ctx.beginPath(); ctx.arc(0, 0, 28, Math.PI, Math.PI * 2.2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = p.alpha;
    // Background — dual gradient (purple + gold)
    const bg = ctx.createRadialGradient(0, -3, 2, 0, 0, 22);
    bg.addColorStop(0, '#fff'); bg.addColorStop(0.2, '#ff88ff'); bg.addColorStop(0.6, '#9933ff'); bg.addColorStop(1, '#4400aa');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    // Gold border
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
    // Star icon
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 0, 1);
    // Energy particles
    for (let i = 0; i < 5; i++) {
      const a = t * 0.08 + i * 1.257;
      const r = 26 + Math.sin(t * 0.1 + i) * 4;
      const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
      ctx.globalAlpha = p.alpha * (0.4 + 0.3 * Math.sin(t * 0.2 + i));
      ctx.fillStyle = i % 2 === 0 ? '#ff66ff' : '#ffdd00';
      ctx.beginPath(); ctx.arc(sx, sy, 1.8 + Math.sin(t * 0.15 + i) * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); return;
  }
  const gc = p.type === 'shield' ? ['#44ff88', '#228844', '#66ffaa'] : p.type === 'speed' ? ['#00ccff', '#0066aa', '#66ddff'] : ['#ffdd00', '#aa8800', '#ffee66'];
  const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, 18); pg.addColorStop(0, gc[0]); pg.addColorStop(1, gc[1]);
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = gc[2]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.type === 'shield' ? '🛡️' : p.type === 'speed' ? '⚡' : '🧲', 0, 0);
  ctx.globalAlpha *= .3; const gw = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  gw.addColorStop(0, gc[0]); gw.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gw;
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawHeartPack(hp) {
  hp.bob += 0.06; hp.pulse += 0.08;
  const py = hp.y + Math.sin(hp.bob) * 6;
  const pulseScale = 1 + Math.sin(hp.pulse) * 0.12;
  ctx.save(); ctx.globalAlpha = hp.alpha; ctx.translate(hp.x, py); ctx.scale(pulseScale, pulseScale);
  // Outer glow
  ctx.globalAlpha = hp.alpha * (0.2 + 0.1 * Math.sin(hp.pulse));
  const glowG = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
  glowG.addColorStop(0, 'rgba(255,60,80,0.6)'); glowG.addColorStop(0.5, 'rgba(255,100,120,0.2)'); glowG.addColorStop(1, 'rgba(255,50,80,0)');
  ctx.fillStyle = glowG; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
  // Background circle
  ctx.globalAlpha = hp.alpha;
  const bg = ctx.createRadialGradient(0, -2, 2, 0, 0, 20);
  bg.addColorStop(0, '#ff6688'); bg.addColorStop(0.6, '#ee2255'); bg.addColorStop(1, '#aa1133');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  // Border ring
  ctx.strokeStyle = '#ff88aa'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke();
  // Draw heart shape
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-2, 3, -8, -2, -8, -5);
  ctx.bezierCurveTo(-8, -9, -4, -11, 0, -7);
  ctx.bezierCurveTo(4, -11, 8, -9, 8, -5);
  ctx.bezierCurveTo(8, -2, 2, 3, 0, 5);
  ctx.fill();
  // Heart highlight
  ctx.globalAlpha = hp.alpha * 0.5;
  ctx.fillStyle = '#ffccdd';
  ctx.beginPath(); ctx.arc(-4, -6, 2.5, 0, Math.PI * 2); ctx.fill();
  // Plus sign
  ctx.globalAlpha = hp.alpha;
  ctx.fillStyle = '#22cc44'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', 10, -10);
  // Sparkle particles around it
  for (let i = 0; i < 3; i++) {
    const angle = hp.pulse * 0.7 + i * 2.09;
    const sx = Math.cos(angle) * 24, sy = Math.sin(angle) * 24;
    ctx.globalAlpha = hp.alpha * (0.4 + 0.3 * Math.sin(hp.pulse + i));
    ctx.fillStyle = '#ffddee';
    ctx.beginPath(); ctx.arc(sx, sy, 1.5 + Math.sin(hp.pulse + i) * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── PARTICLES ────────────────────────────────
function updateP() {
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.type === 'shockwave') { p.r += p.vx; p.life -= 0.04; }
    else if (p.type === 'ring') { p.r += p.vx; p.life -= 0.05; }
    else { p.vy += .15; p.vx *= .96; p.life -= .04; }
    if (p.life <= 0) return;

    ctx.save(); ctx.globalAlpha = Math.max(0, p.life);

    if (p.type === 'shockwave') {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.2, p.col); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'ring') {
      ctx.strokeStyle = p.col; ctx.lineWidth = p.vy * p.life;
      ctx.shadowColor = p.col; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    } else if (p.type === 'hex') {
      ctx.fillStyle = p.col; ctx.translate(p.x, p.y); ctx.rotate(p.life * 10);
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = j * Math.PI / 3; const rad = Math.max(0.1, p.r * p.life);
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fill();
    } else if (p.type === 'spark') {
      ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 10;
      ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      const len = Math.max(2, p.r * p.life * 3);
      ctx.beginPath(); ctx.ellipse(0, 0, len, p.r * p.life * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r * p.life), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
  particles = particles.filter(p => p.life > 0);
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
    player.x = W * .12; player.y = H * .4; player.vy = 0; player.vx = 0; player.rotation = 0; player.trail = []; player.onGround = false; player.exploded = false;
    player.laserAmmo = 10; player.missileAmmo = 5;
    obstacles = []; coins = []; pickups = []; heartPacks = []; particles = []; missiles = []; missileWarnings = [];
    enemies = []; enemyBullets = []; playerBullets = [];

    // Initialize pet
    const pData = getSkinColors().pet;
    petObj = (pData && pData.id !== 'none') ? { x: player.x - 40, y: player.y - 40, type: pData.id, cooldown: 60 } : null;

    score = 0; distance = 0; runCoins = 0; frame = 0;
    hearts = gameMode === 'pro' ? 3 : 5;
    BASE_SPEED = gameMode === 'pro' ? 6 : 5;
    invincible = 0;
    activePU = null; puTimer = 0; shieldActive = false; bgX = 0;
    boss = null; bossDefeated = [false, false, false, false, false]; bossWarning = 0;
    graceFrames = 60;
    curBiome = 'bridge'; window.curBiome = 'bridge';
    banner = { text: '', timer: 0 }; window.banner = banner;
    speed = BASE_SPEED; updateHearts(); updateHUD(); updatePUBar();
    for (let i = 0; i < 3; i++) spawnCoinPattern();
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
  if (state !== 'playing' && state !== 'dying') { loopRunning = false; return; }
  const rawDt = ts - lastT; lastT = ts;
  const dt = Math.min(rawDt / TARGET_DT, 3);
  frame++;
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const speedMult = (activePU === 'speed' || activePU === 'ultimate') ? 1.6 : 1;
  // Phase-based difficulty (Flattens out endgame to prevent impossibility)
  let speedAccel;
  if (gameMode === 'pro') {
    if (distance < 2000) speedAccel = distance * 0.0008;
    else if (distance < 4000) speedAccel = 1.6 + (distance - 2000) * 0.0018;
    else if (distance < 9000) speedAccel = 5.2 + (distance - 4000) * 0.0012;
    else speedAccel = 11.2 + (distance - 9000) * 0.0005;
  } else {
    if (distance < 2000) speedAccel = distance * 0.0005;
    else if (distance < 4000) speedAccel = 1.0 + (distance - 2000) * 0.0010;
    else if (distance < 9000) speedAccel = 3.0 + (distance - 4000) * 0.0008;
    else speedAccel = 7.0 + (distance - 9000) * 0.0003;
  }
  if (state === 'dying') {
    player.deathSpeed *= 0.98;
    speed = player.deathSpeed;
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
  if (!boss && distance >= 2000 && !bossDefeated[1]) spawnBoss(2); // Warden Mech at 2000m (index 1)
  if (!boss && distance >= 4000 && !bossDefeated[0]) spawnBoss(1); // Sentinel Turret at 4000m (index 0)
  if (!boss && distance >= 6000 && !bossDefeated[2]) spawnBoss(3); // Overlord Gunship at 6000m (index 2)
  if (!boss && distance >= 12000 && !bossDefeated[3]) spawnBoss(4); // Supreme Overlord at 12000m (index 3)
  if (!boss && distance >= 19000 && !bossDefeated[4]) spawnBoss(5); // Annihilator at 19000m (index 4)
  // ── PHASE-BASED SPAWNING ──
  let si, enemyChance, missileChance;
  if (gameMode === 'pro') {
    if (distance < 2000) { si = Math.max(80, 140 - distance * 0.02); enemyChance = 0.35; missileChance = 0.20; }
    else if (distance < 5000) { si = Math.max(65, 100 - (distance - 2000) * 0.015); enemyChance = 0.50; missileChance = 0.25; }
    else if (distance < 9000) { si = Math.max(50, 75 - (distance - 5000) * 0.01); enemyChance = 0.65; missileChance = 0.30; }
    else { si = Math.max(45, 55 - (distance - 9000) * 0.005); enemyChance = 0.75; missileChance = 0.35; }
  } else {
    // Beginner: Very relaxed, low enemy spawn chance
    if (distance < 2000) { si = Math.max(220, 300 - distance * 0.01); enemyChance = 0.15; missileChance = 0.02; }
    else if (distance < 5000) { si = Math.max(200, 260 - (distance - 2000) * 0.01); enemyChance = 0.20; missileChance = 0.04; }
    else if (distance < 9000) { si = Math.max(180, 220 - (distance - 5000) * 0.01); enemyChance = 0.25; missileChance = 0.06; }
    else { si = Math.max(160, 200 - (distance - 9000) * 0.005); enemyChance = 0.35; missileChance = 0.08; }
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

  if (state === 'playing' && frame % 400 === 0) spawnPickup();
  // Heart packs: spawn every ~500 frames, only when player has lost hearts (now up to 5 hearts max)
  if (state === 'playing' && frame % 500 === 0 && hearts < 5) spawnHeartPack();
  // Ultimate packs: rare, every ~700 frames, only after 1200m
  if (state === 'playing' && frame % 700 === 0 && distance > 1200 && Math.random() < 0.3) spawnUltimatePack();

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
    const moveSpeed = (e.type === 'dragon' ? spd * 0.25 : e.type === 'robot' ? spd * 0.35 : spd * 0.3) * baseMult;
    e.x -= moveSpeed;
    // Movement: all enemies hover now
    e.hoverPhase += (e.hoverSpeed || 0.01) * dt;
    e.y = e.baseY + Math.sin(e.hoverPhase) * (e.hoverAmp || 8);
    if (e.flash > 0) e.flash -= dt;
    // Shooting (randomized timing)
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && e.x < canvas.gameW - 40 && e.x > player.x) {
      // Add random delay so shooting is unpredictable
      e.shootTimer = e.shootInterval * (0.7 + Math.random() * 0.8);
      e.shotCount = (e.shotCount || 0) + 1;
      const btype = e.type === 'robot' ? 'laser_beam' : e.type === 'dragon' ? 'fireball' : undefined;
      spawnEnemyBullet(e.x, e.y, btype);
      // After 3 shots, start fleeing
      if (e.shotCount >= 3) {
        e.fleeing = true;
      }
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
