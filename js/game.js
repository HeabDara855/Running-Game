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
const BASE_SPEED = 4.5, GROUND_RATIO = 0.87, TARGET_DT = 1000 / 60;

// ── STATE ────────────────────────────────────
let state = 'start', score = 0, distance = 0, runCoins = 0;
let frame = 0, speed = 0, bgX = 0;
let hearts = 3, invincible = 0;
let activePU = null, puTimer = 0, puMaxTime = 0;
let shieldActive = false;
let graceFrames = 0, lastT = 0, loopRunning = false;
// Boss system
let boss = null, bossDefeated = [false, false, false], bossWarning = 0;
let isHolding = false, startClickGuard = false;
let curBiome = 'bridge'; window.curBiome = curBiome;
let banner = { text: '', timer: 0 }; window.banner = banner;
// Screen effects
let screenShake = 0;
let floatingTexts = [];
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
  startClickGuard = true; setTimeout(() => startClickGuard = false, 150);
  startGame();
});
document.getElementById('restartBtn').addEventListener('click', e => {
  e.stopPropagation(); initAudio();
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
    // Dynamic Volleys (1, 2, or 4 at once) past 1000m
    let count = 1;
    if (distance > 1000) {
      const roll = Math.random();
      if (roll < 0.15) count = 4;
      else if (roll < 0.40) count = 2;
    }

    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let beamH = 120 + Math.random() * 50; // Buffed 'Short'
      if (r > 0.35) beamH = 280 + Math.random() * 120; // Massive 'Medium'
      if (count === 1 && r > 0.75) beamH = 450 + Math.random() * 100; // Screen-dominating 'Mega-Blade' (only solo)

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

  // Dynamic Volleys past 1000m
  let count = 1;
  const roll = Math.random();
  if (distance > 1000) {
    if (roll < 0.2) count = 4;
    else if (roll < 0.4) count = 2;
  }

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
  const type = forceType || (Math.random() < 0.55 ? 'demon' : Math.random() < 0.7 ? 'robot' : 'dragon');
  const shootInterval = Math.max(90, 160 - distance * 0.006);
  if (type === 'robot') {
    // Robot hovers mid-height (not underground)
    const ey = gY * 0.45 + Math.random() * (gY * 0.3);
    enemies.push({
      type: 'robot', x: W + 40, y: ey, baseY: ey, w: 36, h: 42,
      hoverAmp: 8, hoverSpeed: 0.01, hoverPhase: Math.random() * 6.28, walkFrame: 0,
      shootTimer: shootInterval + Math.random() * 60, shootInterval: shootInterval,
      hp: 2, flash: 0, shotCount: 0, fleeing: false
    });
  } else if (type === 'dragon') {
    // Dragon flies high
    const ey = 40 + Math.random() * (gY * 0.35);
    enemies.push({
      type: 'dragon', x: W + 60, y: ey, baseY: ey, w: 52, h: 36,
      hoverAmp: 25 + Math.random() * 20, hoverSpeed: 0.015 + Math.random() * 0.01,
      hoverPhase: Math.random() * 6.28, wingFrame: 0,
      shootTimer: shootInterval * 1.3 + Math.random() * 40, shootInterval: shootInterval * 1.3,
      hp: 3, flash: 0, shotCount: 0, fleeing: false
    });
  } else {
    // Demon
    const ey = 50 + Math.random() * (gY - 120);
    enemies.push({
      type: 'demon', x: W + 30, y: ey, baseY: ey, w: 28, h: 28,
      hoverAmp: 20 + Math.random() * 30, hoverSpeed: 0.02 + Math.random() * 0.02,
      hoverPhase: Math.random() * 6.28,
      shootTimer: shootInterval + Math.random() * 50, shootInterval,
      hp: 1, flash: 0, shotCount: 0, fleeing: false
    });
  }
}
function spawnEnemyBullet(ex, ey, bulletType) {
  const bulletSpeed = 2.8 + distance * 0.0003;
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
  if (e.type === 'robot') drawRobot(e);
  else if (e.type === 'dragon') drawDragon(e);
  else drawDemon(e);
}

// ── BOSS SYSTEM ──────────────────────────────
function spawnBoss(bossType) {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  bossWarning = 120; // 2 second warning
  if (bossType === 1) {
    // Sentinel Turret at 2000m
    boss = {
      type: 'sentinel', x: W + 80, y: gY * 0.35, targetX: W * 0.72, w: 60, h: 70,
      hp: 1200, maxHp: 1200, phase: 0, shootTimer: 60, shootInterval: 30, bossIdx: 0,
      entered: false, defeated: false, retreating: false, t: 0
    };
  } else if (bossType === 2) {
    // Warden Mech at 4000m
    boss = {
      type: 'warden', x: W + 100, y: gY * 0.4, targetX: W * 0.68, w: 80, h: 90,
      hp: 800, maxHp: 800, phase: 0, shootTimer: 45, shootInterval: 75, bossIdx: 1,
      entered: false, defeated: false, retreating: false, t: 0, walkFrame: 0
    };
  } else if (bossType === 3) {
    // Overlord Gunship at 6000m
    boss = {
      type: 'overlord', x: W + 120, y: gY * 0.25, targetX: W * 0.65, w: 100, h: 60,
      hp: 1000, maxHp: 1000, phase: 0, shootTimer: 40, shootInterval: 45, bossIdx: 2,
      entered: false, defeated: false, retreating: false, t: 0, wingFrame: 0
    };
  } else {
    // Supreme Overlord at 12000m (Final Boss)
    boss = {
      type: 'overlord', x: W + 120, y: gY * 0.25, targetX: W * 0.65, w: 100, h: 60,
      hp: 2000, maxHp: 2000, phase: 0, shootTimer: 25, shootInterval: 30, bossIdx: 3,
      entered: false, defeated: false, retreating: false, t: 0, wingFrame: 0
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
  // HP drains over time (survival boss — tuned for fairness)
  boss.hp -= dt * (boss.type === 'overlord' ? 1.5 : boss.type === 'warden' ? 1.2 : 1.0);
  // Dynamic vertical movement: Sentinel sweeps aggressively but stays visible
  const gY = canvas.gameH * GROUND_RATIO; // Required for vertical movement calculations
  if (boss.type === 'sentinel' && !boss.retreating) {
    boss.y = (gY * 0.35 + Math.sin(boss.t * 0.015) * gY * 0.3); // Keeps Sentinel within screen bounds
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
      const bs = 5.0;
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
      [-60, -30].forEach(yOff => {
        enemyBullets.push({ x: boss.x - 40, y: boss.y + yOff, vx: -4.0, vy: 0, r: 13, life: 1, btype: 'warden_shell' });
      });
      setTimeout(() => {
        if (!boss || boss.type !== 'warden') return;
        [60, 110, 160, 220].forEach(yOff => {
          enemyBullets.push({ x: boss.x - 40, y: boss.y + yOff, vx: -4.0, vy: 0, r: 13, life: 1, btype: 'warden_shell' });
        });
        sfx.laser();
      }, 320);
      // Slow homing fireball — easy to drift away from
      enemyBullets.push({ x: boss.x - 30, y: boss.y, vx: -2.5, vy: 0, r: 18, life: 1, btype: 'warden_fireball' });
      sfx.laser();

    } else {
      // Overlord: alternating UP wave / DOWN wave — player ducks to whichever side is clear
      boss._waveToggle = !boss._waveToggle;
      const yDir = boss._waveToggle ? -1 : 1;
      const bs = 3.5;
      [-1.5, -0.5, 0.5, 1.5].forEach(mult => {
        const angle = Math.PI + (mult * 0.14 * yDir);
        enemyBullets.push({
          x: boss.x - 50, y: boss.y + mult * 18,
          vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs * 0.5,
          r: 13, life: 1, btype: 'overlord_missile'
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
    b.walkFrame = (b.walkFrame || 0) + 0.08;
    const legL = Math.sin(b.walkFrame) * 6, legR = Math.sin(b.walkFrame + Math.PI) * 6;
    // Legs
    ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, 16); ctx.lineTo(-16 + legL, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 16); ctx.lineTo(16 + legR, 28); ctx.stroke();
    ctx.fillStyle = '#3a4a5a';
    ctx.fillRect(-22 + legL, 26, 16, 6); ctx.fillRect(6 + legR, 26, 16, 6);
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
  } else {
    // OVERLORD GUNSHIP — huge attack helicopter
    const scale = 2.8;
    ctx.scale(scale, scale);
    b.wingFrame = (b.wingFrame || 0) + 0.3;
    // Tail
    ctx.fillStyle = '#4a5a68';
    ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(42, -4); ctx.lineTo(44, -2);
    ctx.lineTo(44, 2); ctx.lineTo(42, 4); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#dd4400'; ctx.fillRect(34, -2, 6, 4);
    // Tail rotor
    ctx.save(); ctx.translate(44, 0);
    ctx.rotate(t * 0.5);
    ctx.strokeStyle = 'rgba(150,180,200,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
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
    ctx.beginPath(); ctx.arc(-38, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(38, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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

// ── SCOUT DRONE (replaces Demon) ──
function drawDemon(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame;
  // Propeller (spinning)
  ctx.save();
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = 'rgba(150,180,200,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 16); ctx.stroke();
  ctx.globalAlpha = 0.08; ctx.fillStyle = '#88bbdd';
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Drone body (hexagonal)
  const bg = ctx.createRadialGradient(0, 2, 2, 0, 0, 14);
  bg.addColorStop(0, '#5a6a7a'); bg.addColorStop(0.6, '#3a4a5a'); bg.addColorStop(1, '#2a3a4a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(11, -6); ctx.lineTo(11, 6);
  ctx.lineTo(0, 12); ctx.lineTo(-11, 6); ctx.lineTo(-11, -6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6a8090'; ctx.lineWidth = 1.5;
  ctx.stroke();
  // Red scanning eye
  const eyeP = 0.6 + Math.sin(t * 0.15) * 0.4;
  ctx.fillStyle = `rgba(255,30,30,${eyeP})`;
  ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffaaaa';
  ctx.beginPath(); ctx.arc(-1, -1, 1.5, 0, Math.PI * 2); ctx.fill();
  // Antenna
  ctx.strokeStyle = '#7a8a9a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -18); ctx.stroke();
  ctx.fillStyle = `rgba(0,200,255,${0.5 + Math.sin(t * 0.2) * 0.5})`;
  ctx.beginPath(); ctx.arc(0, -19, 2, 0, Math.PI * 2); ctx.fill();
  // Side thrusters
  ctx.fillStyle = '#4a5a6a';
  ctx.fillRect(-15, -3, 5, 6); ctx.fillRect(10, -3, 5, 6);
  ctx.fillStyle = `rgba(0,180,255,${0.3 + Math.sin(t * 0.12) * 0.15})`;
  ctx.beginPath(); ctx.arc(-15, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(15, 0, 3, 0, Math.PI * 2); ctx.fill();
  // Scan beam
  ctx.globalAlpha = 0.06 + 0.04 * Math.sin(t * 0.08);
  ctx.fillStyle = '#ff3300';
  ctx.beginPath(); ctx.moveTo(-3, 12); ctx.lineTo(3, 12);
  ctx.lineTo(10, 40); ctx.lineTo(-10, 40); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ── HEAVY MECH (replaces Robot) ──
function drawRobot(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame;
  e.walkFrame = (e.walkFrame || 0) + 0.12;
  const legL = Math.sin(e.walkFrame) * 5, legR = Math.sin(e.walkFrame + Math.PI) * 5;
  // Hydraulic legs
  ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(-14 + legL, 24); ctx.stroke();
  ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-14 + legL, 24); ctx.lineTo(-10 + legL * 0.5, 32); ctx.stroke();
  ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(10, 14); ctx.lineTo(14 + legR, 24); ctx.stroke();
  ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(14 + legR, 24); ctx.lineTo(10 + legR * 0.5, 32); ctx.stroke();
  // Feet
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(-16 + legL * 0.5, 30, 14, 5); ctx.fillRect(4 + legR * 0.5, 30, 14, 5);
  // Pistons
  ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(-12 + legL * 0.7, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 16); ctx.lineTo(12 + legR * 0.7, 28); ctx.stroke();
  // Main body
  const mbg = ctx.createLinearGradient(-18, -20, 18, 16);
  mbg.addColorStop(0, '#5a6a78'); mbg.addColorStop(0.3, '#7a8a98');
  mbg.addColorStop(0.5, '#8a9aa8'); mbg.addColorStop(1, '#4a5a68');
  ctx.fillStyle = mbg;
  ctx.beginPath();
  ctx.moveTo(-16, -14); ctx.lineTo(-14, -22); ctx.lineTo(14, -22); ctx.lineTo(16, -14);
  ctx.lineTo(18, 16); ctx.lineTo(-18, 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(14, 4); ctx.stroke();
  // Reactor core
  const coreP = Math.sin(t * 0.12) * 0.3 + 0.7;
  ctx.fillStyle = `rgba(0,200,255,${coreP * 0.3})`;
  ctx.beginPath(); ctx.arc(0, -2, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(0,220,255,${coreP})`;
  ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#aaeeff';
  ctx.beginPath(); ctx.arc(-1, -3, 2, 0, Math.PI * 2); ctx.fill();
  // Head visor
  const hbg = ctx.createLinearGradient(-12, -32, 12, -22);
  hbg.addColorStop(0, '#4a5a68'); hbg.addColorStop(0.5, '#6a7a88'); hbg.addColorStop(1, '#3a4a58');
  ctx.fillStyle = hbg; ctx.fillRect(-12, -32, 24, 12);
  const visorP = 0.7 + Math.sin(t * 0.18) * 0.3;
  ctx.fillStyle = `rgba(255,40,40,${visorP})`;
  ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 8;
  ctx.fillRect(-9, -28, 18, 4); ctx.shadowBlur = 0;
  const scanX = Math.sin(t * 0.15) * 6;
  ctx.fillStyle = '#ffcccc'; ctx.fillRect(-3 + scanX, -28, 3, 4);
  // Antenna
  ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, -32); ctx.lineTo(10, -38); ctx.stroke();
  ctx.fillStyle = '#ff4400';
  ctx.beginPath(); ctx.arc(10, -39, 2, 0, Math.PI * 2); ctx.fill();
  // Shoulder cannons
  ctx.save(); ctx.translate(-18, -12);
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = '#4a5a68'; ctx.fillRect(-6, -2, 4, 12);
  ctx.fillStyle = '#3a4a58'; ctx.fillRect(-8, 2, 6, 4);
  ctx.fillStyle = `rgba(255,100,0,${0.3 + Math.sin(t * 0.1) * 0.2})`;
  ctx.beginPath(); ctx.arc(-9, 4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(18, -12);
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = '#4a5a68'; ctx.fillRect(2, -2, 4, 12);
  ctx.fillStyle = '#3a4a58'; ctx.fillRect(2, 2, 6, 4);
  ctx.fillStyle = `rgba(255,100,0,${0.3 + Math.sin(t * 0.1 + 1) * 0.2})`;
  ctx.beginPath(); ctx.arc(9, 4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Glow
  ctx.globalAlpha = 0.08;
  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 35);
  rg.addColorStop(0, 'rgba(0,200,255,0.4)'); rg.addColorStop(1, 'rgba(0,100,255,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── GUNSHIP (replaces Dragon) ──
function drawDragon(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame;
  e.wingFrame = (e.wingFrame || 0) + 0.3;
  // Tail boom
  ctx.fillStyle = '#4a5a68';
  ctx.beginPath();
  ctx.moveTo(10, -3); ctx.lineTo(38, -4); ctx.lineTo(40, -2);
  ctx.lineTo(40, 2); ctx.lineTo(38, 4); ctx.lineTo(10, 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#dd4400'; ctx.fillRect(30, -2, 6, 4);
  // Tail rotor
  ctx.save(); ctx.translate(40, 0);
  ctx.rotate(t * 0.5);
  ctx.strokeStyle = 'rgba(150,180,200,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
  ctx.globalAlpha = 0.1; ctx.fillStyle = '#aabbcc';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Main fuselage
  const fbg = ctx.createLinearGradient(0, -14, 0, 14);
  fbg.addColorStop(0, '#6a7a88'); fbg.addColorStop(0.3, '#8a9aa8');
  fbg.addColorStop(0.5, '#9aabb8'); fbg.addColorStop(0.7, '#7a8a98'); fbg.addColorStop(1, '#5a6a78');
  ctx.fillStyle = fbg;
  ctx.beginPath();
  ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-28, -12, -10, -13);
  ctx.lineTo(12, -10); ctx.lineTo(14, -6); ctx.lineTo(14, 6);
  ctx.lineTo(12, 10); ctx.lineTo(-10, 12);
  ctx.quadraticCurveTo(-28, 12, -30, 0);
  ctx.closePath(); ctx.fill();
  // Cockpit windshield
  const wbg = ctx.createLinearGradient(-28, -6, -18, 6);
  wbg.addColorStop(0, '#88ccff'); wbg.addColorStop(0.5, '#66aadd'); wbg.addColorStop(1, '#4488bb');
  ctx.fillStyle = wbg;
  ctx.beginPath();
  ctx.moveTo(-28, -2); ctx.quadraticCurveTo(-26, -8, -16, -8);
  ctx.lineTo(-12, -7); ctx.lineTo(-12, 7); ctx.lineTo(-16, 8);
  ctx.quadraticCurveTo(-26, 8, -28, 2);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#cceeff';
  ctx.beginPath();
  ctx.moveTo(-26, -4); ctx.quadraticCurveTo(-24, -7, -18, -6);
  ctx.lineTo(-20, -3); ctx.lineTo(-26, -2); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // Engine intakes
  ctx.fillStyle = '#3a4a58'; ctx.fillRect(-6, -14, 16, 4);
  ctx.fillStyle = '#2a3a48'; ctx.fillRect(-4, -13, 12, 2);
  // Missile pods
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-18, 10, 16, 5);
  ctx.fillStyle = '#dd3300';
  ctx.beginPath(); ctx.arc(-20, 12.5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-10, 12.5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-18, -15, 16, 5);
  ctx.fillStyle = '#dd3300';
  ctx.beginPath(); ctx.arc(-20, -12.5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-10, -12.5, 2, 0, Math.PI * 2); ctx.fill();
  // Landing skids
  ctx.strokeStyle = '#4a5a68'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-8, 18); ctx.lineTo(6, 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-8, -18); ctx.lineTo(6, -18); ctx.stroke();
  // Main rotor
  ctx.save(); ctx.translate(0, -14);
  ctx.fillStyle = '#6a7a88'; ctx.fillRect(-3, -6, 6, 6);
  ctx.translate(0, -6); ctx.rotate(t * 0.35);
  ctx.strokeStyle = 'rgba(120,150,180,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-32, 0); ctx.lineTo(32, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(0, 32); ctx.stroke();
  ctx.fillStyle = '#dd4400';
  ctx.beginPath(); ctx.arc(-32, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(32, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -32, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 32, 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#8899bb';
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Engine exhaust
  ctx.globalAlpha = 0.2 + Math.sin(t * 0.15) * 0.1;
  ctx.fillStyle = 'rgba(200,220,240,0.3)';
  ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(22 + Math.random() * 4, 0); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();
  // Nav lights
  ctx.globalAlpha = 0.6 + Math.sin(t * 0.2) * 0.4;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath(); ctx.arc(-10, 12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#00ff00';
  ctx.beginPath(); ctx.arc(-10, -12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Glow
  ctx.globalAlpha = 0.06;
  const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
  fg.addColorStop(0, 'rgba(100,180,255,0.3)'); fg.addColorStop(1, 'rgba(0,100,200,0)');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
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
  }
  ctx.restore();
}
function checkCollBullet(b) {
  const px = player.x + 8, py = player.y + 8, pw = player.w - 16, ph = player.h - 16;
  return b.x + b.r > px && b.x - b.r < px + pw && b.y + b.r > py && b.y - b.r < py + ph;
}

// ── UI UPDATES ──────────────────────────────
function updateHearts() { 
  const hSVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#ff2a55" stroke="#ff2a55" stroke-width="1" style="filter:drop-shadow(0 0 4px #ff2a55);"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  heartsEl.innerHTML = hSVG.repeat(hearts); 
}
function updateHUD() { distEl.textContent = Math.floor(distance) + ' m'; coinEl.textContent = runCoins; }
function updatePUBar() {
  if (activePU && puTimer > 0) {
    puBarEl.classList.remove('hidden'); puFillEl.style.width = (puTimer / puMaxTime * 100) + '%';
    if(activePU === 'shield') puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
    else if(activePU === 'speed') puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    else if(activePU === 'ultimate') puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    else puIconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/></svg>';
    if (activePU === 'ultimate') puFillEl.style.background = 'linear-gradient(90deg,#9933ff,#ff44ff,#ffd700)';
    else puFillEl.style.background = '';
  } else { puBarEl.classList.add('hidden'); puFillEl.style.background = ''; }
}

// ── DRAW PLAYER ──────────────────────────────
function drawPlayer() {
  const px = player.x, py = player.y, t = frame;
  const { char, jet } = getSkinColors();

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
  ctx.save(); ctx.translate(px + player.w * .5, py + player.h * .5);
  const tilt = Math.max(-0.2, Math.min(0.2, player.vy * 0.02)); ctx.rotate(tilt);
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

  // ── LEGS (Cyber Armor) ──
  const legColor = char.id === 'apsara' ? cAccent : '#1a1d24'; // Brighter gold/white legs for Apsara
  if (player.onGround) {
    player.runFrame += .22;
    const lL = Math.sin(player.runFrame) * 11, lR = Math.sin(player.runFrame + Math.PI) * 11;
    ctx.save(); ctx.strokeStyle = legColor; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(-6 + lL, 24); ctx.stroke();
    ctx.fillStyle = cAccent; ctx.fillRect(-10 + lL, 22, 12, 5); // left boot
    ctx.fillStyle = cGlow; ctx.fillRect(-8 + lL, 24, 4, 2); // left heel
    ctx.restore();
    ctx.save(); ctx.strokeStyle = legColor; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, 12); ctx.lineTo(6 + lR, 24); ctx.stroke();
    ctx.fillStyle = cAccent; ctx.fillRect(-2 + lR, 22, 12, 5); // right boot
    ctx.fillStyle = cGlow; ctx.fillRect(0 + lR, 24, 4, 2);
    ctx.restore();
  } else {
    const d2 = Math.sin(frame * .08) * 4;
    ctx.save(); ctx.strokeStyle = legColor; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(-8 + d2, 23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(8 - d2, 23); ctx.stroke(); ctx.restore();
    ctx.fillStyle = cAccent;
    ctx.fillRect(-12 + d2, 21, 10, 5); ctx.fillStyle = cGlow; ctx.fillRect(-10 + d2, 23, 4, 2);
    ctx.fillStyle = cAccent;
    ctx.fillRect(4 - d2, 21, 10, 5); ctx.fillStyle = cGlow; ctx.fillRect(6 - d2, 23, 4, 2);
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
  ctx.save(); ctx.translate(10, -6); ctx.rotate(0.3 - armSwing * 0.5 - attackAngle * 0.5);
  ctx.fillStyle = cBody; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cAccent; ctx.fillRect(-3, 0, 7, 14);

  ctx.translate(1, 14); // Hand grip
  ctx.rotate(-1.6); // Forward horizontal point

  // Hilt
  ctx.fillStyle = cAccent; ctx.fillRect(-3, -2, 6, 12);
  ctx.fillStyle = '#222'; ctx.fillRect(-4, -4, 8, 3);
  ctx.fillStyle = cGlow; ctx.fillRect(-1, 8, 2, 2);

  // Energy Saber
  const sLen = 38 + Math.random() * 2;
  ctx.shadowColor = cSaber; ctx.shadowBlur = 20 + Math.sin(t * 0.7) * 5;
  ctx.fillStyle = cSaber;
  ctx.beginPath(); ctx.roundRect(-3, -sLen - 4, 6, sLen, 3); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-1.5, -sLen - 3, 3, sLen - 2, 1.5); ctx.fill();

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
    p.x += p.vx; p.y += p.vy; p.vy += .15; p.vx *= .96; p.life -= .04; if (p.life <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.1, p.r * p.life), 0, Math.PI * 2); ctx.fill(); ctx.restore();
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

function hitPlayer() {
  if (invincible > 0) return;
  if (shieldActive) {
    shieldActive = false; activePU = null; puTimer = 0; invincible = 60;
    sfx.shieldBreak(); spawnP(player.x + player.w * .5, player.y + player.h * .5, '#44ff88', 15);
    screenShake = 12; return;
  }
  hearts--; updateHearts(); invincible = 90;
  sfx.hit(); spawnP(player.x + player.w * .5, player.y + player.h * .5, '#FF2200', 12);
  screenShake = 18;
  floatingTexts.push({ x: player.x + player.w * .5, y: player.y - 10, text: '💔', color: '#ff3344', life: 1, vy: -2 });
  if (hearts <= 0) gameOver();
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
    player.x = W * .12; player.y = H * .4; player.vy = 0; player.trail = []; player.onGround = false;
    obstacles = []; coins = []; pickups = []; heartPacks = []; particles = []; missiles = []; missileWarnings = [];
    enemies = []; enemyBullets = [];
    score = 0; distance = 0; runCoins = 0; frame = 0; hearts = 3; invincible = 0;
    activePU = null; puTimer = 0; shieldActive = false; bgX = 0;
    boss = null; bossDefeated = [false, false, false, false]; bossWarning = 0;
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
  if (state !== 'playing') { loopRunning = false; return; }
  const rawDt = ts - lastT; lastT = ts;
  const dt = Math.min(rawDt / TARGET_DT, 3);
  frame++;
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const speedMult = (activePU === 'speed' || activePU === 'ultimate') ? 1.6 : 1;
  // Phase-based difficulty (Flattens out endgame to prevent impossibility)
  let speedAccel;
  if (distance < 2000) speedAccel = distance * 0.0008;       // Phase 1: Easy
  else if (distance < 4000) speedAccel = 1.6 + (distance - 2000) * 0.0018; // Phase 2: Medium
  else if (distance < 9000) speedAccel = 5.2 + (distance - 4000) * 0.0012; // Phase 3: Hard (5k-9k growth slowed)
  else speedAccel = 11.2 + (distance - 9000) * 0.0005;       // Phase 4: Extreme 9k+ (growth very slow)
  speed = (BASE_SPEED + speedAccel) * speedMult;
  const spd = speed * dt;
  bgX += spd;
  distance += spd * 0.1;
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
  if (graceFrames > 0) { graceFrames -= dt; player.vy = 0; player.y = H * .4 + Math.sin(frame * .08) * 4; }
  else {
    // Physics
    if (isHolding && !startClickGuard) {
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
  if (player.y + player.h > gY) { player.y = gY - player.h; player.vy = 0; player.onGround = true; }
  else { player.onGround = false; }

  // ── BOSS SPAWNING ──
  if (!boss && distance >= 2000 && !bossDefeated[1]) spawnBoss(2); // Warden Mech at 2000m (index 1)
  if (!boss && distance >= 4000 && !bossDefeated[0]) spawnBoss(1); // Sentinel Turret at 4000m (index 0)
  if (!boss && distance >= 6000 && !bossDefeated[2]) spawnBoss(3); // Overlord Gunship at 6000m (index 2)
  if (!boss && distance >= 12000 && !bossDefeated[3]) spawnBoss(4); // Supreme Overlord at 12000m (index 3)

  // ── PHASE-BASED SPAWNING (fewer enemies!) ──
  let si, enemyChance, missileChance;
  if (distance < 2000) {
    // PHASE 1: Easy — mostly obstacles, rare enemies
    si = Math.max(80, 140 - distance * 0.02);
    enemyChance = 0.12;
    missileChance = 0.20;
  } else if (distance < 5000) {
    // PHASE 2: Medium — tighter intervals and more enemies
    si = Math.max(65, 100 - (distance - 2000) * 0.015);
    enemyChance = 0.22;
    missileChance = 0.25;
  } else if (distance < 9000) {
    // PHASE 3: Hard — 5000-9000 density scaled back slightly
    si = Math.max(50, 75 - (distance - 5000) * 0.01);
    enemyChance = 0.25;
    missileChance = 0.30;
  } else {
    // PHASE 4: 9000+ Balanced end-game density (Not hard also not easy)
    si = Math.max(45, 55 - (distance - 9000) * 0.005);
    enemyChance = 0.28;
    missileChance = 0.35;
  }
  // Don't spawn regular enemies during boss fights
  const bossActive = boss && boss.entered && !boss.retreating;
  if (frame > 80 && frame % Math.floor(si) === 0 && !bossActive) {
    const r = Math.random();

    if (distance < 2000) {
      // 0 - 2000: Missiles, Electric Zappers, Cyberpunk Emitters, AND Vertical Lasers
      if (r < 0.15) spawnLaser('vert');
      else if (r < 0.30) spawnLaser('horiz');
      else if (r < 0.70) spawnElectric();
      else spawnMissileWarning();
    }
    else if (distance < 4000) {
      // 2000 - 4000: Missiles, Electric Zappers, and Cyberpunk Laser Emitter (Horiz)
      if (r < 0.30) spawnLaser('horiz');
      else if (r < 0.60) spawnElectric();
      else spawnMissileWarning();
    }

    else if (distance < 9900) {
      // 4000 - 9900: ONLY Vertical Lasers, SOME Electric Zappers, and Cyberpunk Emitters (NO MISSILES)
      // Reduced vertical laser chance from 40% to 15%
      if (r < 0.15) spawnLaser('vert');
      else if (r < 0.60) spawnLaser('horiz');
      else spawnElectric();
    }
    else {
      // 9900+: All obstacles: Missiles, Zappers, Cyberpunk Emitters, and Vertical Lasers (Hard but balanced)
      // Reduced vertical laser chance from 25% to 10%
      if (r < 0.10) spawnLaser('vert');
      else if (r < 0.30) spawnLaser('horiz');
      else if (r < 0.65) spawnElectric();
      else spawnMissileWarning();
    }
  }

  // Phase 2+: occasional extra mech/gunship (rare background spawns)
  if (distance > 2500 && frame % Math.floor(si * 1.5) === 0 && Math.random() < 0.05 && !bossActive) spawnEnemy('robot');
  if (distance > 3500 && frame % Math.floor(si * 1.5) === 0 && Math.random() < 0.05 && !bossActive) spawnEnemy('dragon');

  // Coin clusters: Only spawn if the screen is relatively clear of coins on the right side to prevent grids smashing together!
  let maxCoinX = 0;
  for (let c of coins) { if (c.x > maxCoinX) maxCoinX = c.x; }
  if (maxCoinX < canvas.gameW - 100 && frame % 180 === 0 && !bossActive) spawnCoinPattern();

  if (frame % 400 === 0) spawnPickup();
  // Heart packs: spawn every ~500 frames, only when player has lost hearts (now up to 4 hearts max)
  if (frame % 500 === 0 && hearts < 4) spawnHeartPack();
  // Ultimate packs: rare, every ~700 frames, only after 1200m
  if (frame % 700 === 0 && distance > 1200 && Math.random() < 0.3) spawnUltimatePack();

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
      if (invincible <= 0 && !shieldActive && activePU !== 'speed' && ob.beamOn && checkCollLaserHoriz(ob)) hitPlayer();
      else if ((shieldActive || activePU === 'speed') && ob.beamOn && checkCollLaserHoriz(ob) && invincible <= 0) hitPlayer();
    }

    if (ob.type === 'laser') {
      ob.angle += ob.spinSpeed * dt; // Dynamic active rotation!
      if (ob.warningTimer > 0) {
        ob.warningTimer -= dt;
        if (ob.warningTimer <= 0) { ob.beamOn = true; }
      }
      if (!ob.passed && ob.x + ob.w < player.x) { ob.passed = true; sfx.pass(); }
      if (invincible <= 0 && !shieldActive && activePU !== 'speed' && checkCollLaser(ob)) hitPlayer();
      else if ((shieldActive || activePU === 'speed') && checkCollLaser(ob) && invincible <= 0) hitPlayer();
    }
    if (ob.type === 'electric') {
      ob.phase += .08 * dt; // and blinks much faster
      ob.on = Math.sin(ob.phase) > -0.6;
      ob.angle += ob.spinSpeed * dt; // Apply dynamic active rotation!
      if (!ob.passed && ob.x + ob.w < player.x) { ob.passed = true; sfx.pass(); }
      if (invincible <= 0 && checkCollElec(ob)) hitPlayer();
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
    if (invincible <= 0 && checkCollMissile(m)) hitPlayer();
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
    const moveSpeed = e.type === 'dragon' ? spd * 0.25 : e.type === 'robot' ? spd * 0.35 : spd * 0.3;
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
    if (invincible <= 0 && checkCollBullet(b)) {
      hitPlayer();
      b.life = 0;
      spawnP(b.x, b.y, '#cc44ff', 8);
    }
  });

  // Coins
  coins = coins.filter(c => c.x > -30 && c.alpha > 0);
  coins.forEach(c => {
    c.x -= spd; if (!c.collected) {
      drawCoin(c);
      if (dist(player.x + player.w * .5, player.y + player.h * .5, c.x, c.y) < 22) {
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
      if (hearts < 4) { hearts++; updateHearts(); }
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

  if (state === 'playing') requestAnimationFrame(loop);
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
