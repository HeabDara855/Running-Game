// ── CANVAS SETUP ─────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('gameWrapper');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrapper.offsetWidth, h = wrapper.offsetHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas._logicalW = w; canvas._logicalH = h;
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
  { id:'bridge', label:'🌉 Sci-Fi Bridge', minDist:0 },
  { id:'village', label:'🧪 Lab Sector', minDist:1000 },
  { id:'forest', label:'📦 Cargo Bay', minDist:2000 },
  { id:'city', label:'🖥️ Command Center', minDist:3000 },
  { id:'mountain', label:'☢️ Reactor Core', minDist:4000 },
  { id:'ocean', label:'🚀 Launch Hangar', minDist:5000 }
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
const player = { x:0, y:0, vy:0, w:44, h:52, onGround:false, runFrame:0, scarf:0, trail:[] };

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
  if (e) e.preventDefault();
  isHolding = false;
  stopJetpackSound();
}
canvas.addEventListener('pointerdown', onInputStart);
canvas.addEventListener('pointerup', onInputEnd);
canvas.addEventListener('pointercancel', onInputEnd);
canvas.addEventListener('pointerleave', onInputEnd);
document.addEventListener('keydown', e => {
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
  document.getElementById('muteBtn').textContent = toggleMute(state) ? '🔇' : '🔊';
});

// ── SPAWN ────────────────────────────────────
function spawnLaser() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const beamH = 70 + Math.random() * 100;
  const y = 35 + Math.random() * (gY - beamH - 70);
  obstacles.push({ type:'laser', x:W+40, y, beamH, w:22, warningTimer:50, beamOn:false, passed:false });
}
function spawnElectric() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const y1 = 30 + Math.random() * (gY * 0.35);
  const y2 = y1 + 90 + Math.random() * 100;
  obstacles.push({ type:'electric', x:W+30, y1, y2, w:24, phase:Math.random()*6.28, on:true, passed:false });
}
function spawnMissileWarning() {
  const H = canvas.gameH, gY = H * GROUND_RATIO;
  const ty = Math.max(30, Math.min(gY - 30, player.y + player.h / 2));
  missileWarnings.push({ timer:75, y:ty, speed:speed * 2.2 + 4 });
  sfx.missile();
}
function spawnMissile(y, spd) {
  const W = canvas.gameW;
  missiles.push({ x:W+50, y, vx:-spd, w:60, h:24, passed:false });
}
function spawnCoinPattern() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const p = Math.floor(Math.random() * 6);
  // safe 'by' must leave room for tall patterns like Star, Text
  const bx = W + 80, by = 130 + Math.random() * (gY - 260); 
  const addC = (dx, dy) => coins.push({ x: bx + dx, y: by + dy, collected: false, bob: Math.random() * 6.28, r: 14, alpha: 1 });

  // Honeycomb spacing for perfectly packed coins (r=14)
  const dX = 28, dY = 24;

  if (p === 0) {
    // 0: LINE
    for (let i = 0; i < 9; i++) addC(i * dX, 0);
  } else if (p === 1) {
    // 1: HEXAGONAL BLOCK (Exact match from screenshot: 6-7-6)
    for(let i=0; i<6; i++) addC(i*dX + dX*0.5, -dY); // top
    for(let i=0; i<7; i++) addC(i*dX, 0);            // middle
    for(let i=0; i<6; i++) addC(i*dX + dX*0.5, dY);  // bottom
  } else if (p === 2) {
    // 2: DIAMOND CLUSTER
    for(let i=0; i<3; i++) addC(i*dX + dX*1, -dY*2);
    for(let i=0; i<4; i++) addC(i*dX + dX*0.5, -dY);
    for(let i=0; i<5; i++) addC(i*dX, 0);
    for(let i=0; i<4; i++) addC(i*dX + dX*0.5, dY);
    for(let i=0; i<3; i++) addC(i*dX + dX*1, dY*2);
  } else if (p === 3) {
    // 3: ARROW (">" formation)
    for(let i=0; i<4; i++) {
       addC(i*dX, -dY*i); addC(i*dX, dY*i);
    }
    for(let i=1; i<3; i++) {
       addC(i*dX + dX, -dY*i); addC(i*dX + dX, dY*i);
    }
  } else if (p === 4) {
    // 4: SINE WAVE
    for (let i = 0; i < 11; i++) addC(i * dX, -Math.sin(i / 10 * Math.PI) * 70);
  } else {
    // 5: RANDOM CLUSTER
    for (let i = 0; i < 14; i++) addC(Math.random() * 200, (Math.random() - 0.5) * 120);
  }
}
function spawnPickup() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const types = ['shield','speed','magnet'];
  pickups.push({ type:types[Math.floor(Math.random()*3)], x:W+30, y:80+Math.random()*(gY-160), bob:0, alpha:1 });
}
function spawnUltimatePack() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const y = 50 + Math.random() * (gY * 0.5);
  pickups.push({ type:'ultimate', x:W+30, y, bob:0, alpha:1 });
}
function spawnHeartPack() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  // Spawn heart packs in the air (upper 70% of playable area) to reward flying
  const y = 60 + Math.random() * (gY * 0.55);
  heartPacks.push({ x: W + 30, y, bob: 0, alpha: 1, pulse: Math.random() * 6.28 });
}
function spawnP(x, y, col, n) {
  for (let i = 0; i < n; i++) { const a = Math.random()*6.28, s = 2+Math.random()*5;
    particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:1, col, r:2+Math.random()*4 }); }
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
    boss = { type:'sentinel', x:W+80, y:gY*0.35, targetX:W*0.72, w:60, h:70,
      hp:600, maxHp:600, phase:0, shootTimer:60, shootInterval:50,
      entered:false, defeated:false, retreating:false, t:0 };
  } else if (bossType === 2) {
    // Warden Mech at 4000m
    boss = { type:'warden', x:W+100, y:gY*0.4, targetX:W*0.68, w:80, h:90,
      hp:900, maxHp:900, phase:0, shootTimer:40, shootInterval:35,
      entered:false, defeated:false, retreating:false, t:0, walkFrame:0 };
  } else {
    // Overlord Gunship at 5000m
    boss = { type:'overlord', x:W+120, y:gY*0.25, targetX:W*0.65, w:100, h:60,
      hp:1200, maxHp:1200, phase:0, shootTimer:30, shootInterval:25,
      entered:false, defeated:false, retreating:false, t:0, wingFrame:0 };
  }
  banner = { text:'⚠️ BOSS INCOMING ⚠️', timer:150 }; window.banner = banner;
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
      banner = { text:'🏆 BOSS DEFEATED! 🏆', timer:200 }; window.banner = banner;
      // Reward
      runCoins += 25; sfx.coin();
      for (let i = 0; i < 40; i++) spawnP(canvas.gameW*0.5, canvas.gameH*0.4, ['#FFD700','#ff6600','#00ffaa','#ff44cc'][i%4], 1);
    }
    return;
  }
  // HP drains over time (survival boss — ~10-15 seconds)
  boss.hp -= dt * (boss.type === 'overlord' ? 1.5 : boss.type === 'warden' ? 1.2 : 1.0);
  // Hover movement
  const gY = canvas.gameH * GROUND_RATIO;
  boss.y = boss.targetX ? (gY * 0.2 + Math.sin(boss.t * 0.02) * gY * 0.25) : boss.y;
  // Shooting
  boss.shootTimer -= dt;
  if (boss.shootTimer <= 0) {
    boss.shootTimer = boss.shootInterval * (0.6 + Math.random() * 0.6);
    // Different attack patterns per boss
    if (boss.type === 'sentinel') {
      // Triple spread shot — cyan plasma bolts
      for (let a = -1; a <= 1; a++) {
        const bs = 3; const angle = Math.PI + a * 0.25;
        enemyBullets.push({ x:boss.x-30, y:boss.y+a*15, vx:Math.cos(angle)*bs, vy:Math.sin(angle)*bs*0.5, r:12, life:1, btype:'sentinel_plasma' });
      }
      sfx.laser();
    } else if (boss.type === 'warden') {
      // Rapid burst — explosive orange shells
      for (let b = 0; b < 2; b++) {
        const spread = (Math.random()-0.5)*2;
        enemyBullets.push({ x:boss.x-40, y:boss.y-15+b*30, vx:-4.5, vy:spread, r:14, life:1, btype:'warden_shell' });
      }
      // Plus a large homing fireball
      enemyBullets.push({ x:boss.x-30, y:boss.y, vx:-3, vy:(Math.random()-0.5)*1.5, r:20, life:1, btype:'warden_fireball' });
      sfx.laser();
    } else {
      // Overlord: missile barrage — green plasma missiles
      for (let a = -2; a <= 2; a++) {
        const bs = 3.5; const angle = Math.PI + a * 0.18;
        enemyBullets.push({ x:boss.x-50, y:boss.y+a*12, vx:Math.cos(angle)*bs, vy:Math.sin(angle)*bs*0.4, r:14, life:1, btype:'overlord_missile' });
      }
      sfx.missile();
    }
  }
  // Check defeated
  if (boss.hp <= 0) {
    boss.defeated = true; boss.retreating = true;
    const idx = boss.type==='sentinel'?0:boss.type==='warden'?1:2;
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
    ctx.fillStyle = `rgba(255,100,0,${0.3+Math.sin(t*0.15)*0.2})`;
    ctx.beginPath(); ctx.arc(-31, -2.5, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-31, 2.5, 2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Dome
    const dbg = ctx.createRadialGradient(0, -2, 3, 0, 0, 16);
    dbg.addColorStop(0, '#7a8a9a'); dbg.addColorStop(0.6, '#5a6a7a'); dbg.addColorStop(1, '#3a4a5a');
    ctx.fillStyle = dbg;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#8a9aaa'; ctx.lineWidth = 1; ctx.stroke();
    // Central eye
    const eyeP = 0.6 + Math.sin(t * 0.1) * 0.4;
    ctx.fillStyle = `rgba(255,40,40,${eyeP})`;
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath(); ctx.arc(-2, -2, 2.5, 0, Math.PI*2); ctx.fill();
    // Antenna
    ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, -22); ctx.stroke();
    ctx.fillStyle = `rgba(255,0,0,${0.5+Math.sin(t*0.2)*0.5})`;
    ctx.beginPath(); ctx.arc(0, -23, 2.5, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'warden') {
    // WARDEN MECH — massive armored bipedal walker
    const scale = 2.5;
    ctx.scale(scale, scale);
    b.walkFrame = (b.walkFrame||0) + 0.08;
    const legL = Math.sin(b.walkFrame)*6, legR = Math.sin(b.walkFrame+Math.PI)*6;
    // Legs
    ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, 16); ctx.lineTo(-16+legL, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 16); ctx.lineTo(16+legR, 28); ctx.stroke();
    ctx.fillStyle = '#3a4a5a';
    ctx.fillRect(-22+legL, 26, 16, 6); ctx.fillRect(6+legR, 26, 16, 6);
    // Body
    const mbg = ctx.createLinearGradient(-20, -24, 20, 18);
    mbg.addColorStop(0, '#5a6878'); mbg.addColorStop(0.5, '#8a9aa8'); mbg.addColorStop(1, '#4a5868');
    ctx.fillStyle = mbg;
    ctx.beginPath();
    ctx.moveTo(-18, -16); ctx.lineTo(-16, -25); ctx.lineTo(16, -25); ctx.lineTo(18, -16);
    ctx.lineTo(20, 18); ctx.lineTo(-20, 18); ctx.closePath(); ctx.fill();
    // Reactor core (orange for warden)
    const cP = Math.sin(t*0.1)*0.3+0.7;
    ctx.fillStyle = `rgba(255,150,0,${cP})`;
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, -2, 7, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Head
    ctx.fillStyle = '#4a5868'; ctx.fillRect(-14, -35, 28, 12);
    const vP = 0.7 + Math.sin(t*0.15)*0.3;
    ctx.fillStyle = `rgba(255,60,0,${vP})`;
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10;
    ctx.fillRect(-10, -31, 20, 5); ctx.shadowBlur = 0;
    // Shoulder gatlings
    ctx.fillStyle = '#5a6878';
    ctx.fillRect(-28, -18, 12, 10); ctx.fillRect(16, -18, 12, 10);
    ctx.fillStyle = '#3a4858';
    ctx.fillRect(-30, -14, 6, 6); ctx.fillRect(24, -14, 6, 6);
    ctx.fillStyle = `rgba(255,80,0,${0.4+Math.sin(t*0.12)*0.3})`;
    ctx.beginPath(); ctx.arc(-31, -11, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(28, -11, 3, 0, Math.PI*2); ctx.fill();
  } else {
    // OVERLORD GUNSHIP — huge attack helicopter
    const scale = 2.8;
    ctx.scale(scale, scale);
    b.wingFrame = (b.wingFrame||0) + 0.3;
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
      ctx.beginPath(); ctx.arc(-18+i*6, 15, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-18+i*6, -15, 2, 0, Math.PI*2); ctx.fill();
    }
    // Main rotor
    ctx.save(); ctx.translate(0, -16);
    ctx.fillStyle = '#6a7a88'; ctx.fillRect(-4, -7, 8, 7);
    ctx.translate(0, -7); ctx.rotate(t * 0.4);
    ctx.strokeStyle = 'rgba(120,150,180,0.7)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(38, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 38); ctx.stroke();
    ctx.fillStyle = '#dd4400';
    ctx.beginPath(); ctx.arc(-38, 0, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(38, 0, 3, 0, Math.PI*2); ctx.fill();
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
  const bossName = boss.type==='sentinel'?'🎯 SENTINEL TURRET':boss.type==='warden'?'🤖 WARDEN MECH':'🚁 OVERLORD GUNSHIP';
  ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 8;
  ctx.fillText(bossName, W / 2, by - 8);
  ctx.shadowBlur = 0;
}

// ── SCOUT DRONE (replaces Demon) ──
function drawDemon(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash*2)*0.5;
  const t = frame;
  // Propeller (spinning)
  ctx.save();
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = 'rgba(150,180,200,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 16); ctx.stroke();
  ctx.globalAlpha = 0.08; ctx.fillStyle = '#88bbdd';
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI*2); ctx.fill();
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
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffaaaa';
  ctx.beginPath(); ctx.arc(-1, -1, 1.5, 0, Math.PI*2); ctx.fill();
  // Antenna
  ctx.strokeStyle = '#7a8a9a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -18); ctx.stroke();
  ctx.fillStyle = `rgba(0,200,255,${0.5 + Math.sin(t*0.2)*0.5})`;
  ctx.beginPath(); ctx.arc(0, -19, 2, 0, Math.PI*2); ctx.fill();
  // Side thrusters
  ctx.fillStyle = '#4a5a6a';
  ctx.fillRect(-15, -3, 5, 6); ctx.fillRect(10, -3, 5, 6);
  ctx.fillStyle = `rgba(0,180,255,${0.3 + Math.sin(t*0.12)*0.15})`;
  ctx.beginPath(); ctx.arc(-15, 0, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(15, 0, 3, 0, Math.PI*2); ctx.fill();
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
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash*2)*0.5;
  const t = frame;
  e.walkFrame = (e.walkFrame||0) + 0.12;
  const legL = Math.sin(e.walkFrame)*5, legR = Math.sin(e.walkFrame+Math.PI)*5;
  // Hydraulic legs
  ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(-14+legL, 24); ctx.stroke();
  ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-14+legL, 24); ctx.lineTo(-10+legL*0.5, 32); ctx.stroke();
  ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(10, 14); ctx.lineTo(14+legR, 24); ctx.stroke();
  ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(14+legR, 24); ctx.lineTo(10+legR*0.5, 32); ctx.stroke();
  // Feet
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(-16+legL*0.5, 30, 14, 5); ctx.fillRect(4+legR*0.5, 30, 14, 5);
  // Pistons
  ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(-12+legL*0.7, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 16); ctx.lineTo(12+legR*0.7, 28); ctx.stroke();
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
  ctx.beginPath(); ctx.arc(0, -2, 10, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(0,220,255,${coreP})`;
  ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#aaeeff';
  ctx.beginPath(); ctx.arc(-1, -3, 2, 0, Math.PI*2); ctx.fill();
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
  ctx.beginPath(); ctx.arc(10, -39, 2, 0, Math.PI*2); ctx.fill();
  // Shoulder cannons
  ctx.save(); ctx.translate(-18, -12);
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = '#4a5a68'; ctx.fillRect(-6, -2, 4, 12);
  ctx.fillStyle = '#3a4a58'; ctx.fillRect(-8, 2, 6, 4);
  ctx.fillStyle = `rgba(255,100,0,${0.3 + Math.sin(t*0.1)*0.2})`;
  ctx.beginPath(); ctx.arc(-9, 4, 2, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(18, -12);
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = '#4a5a68'; ctx.fillRect(2, -2, 4, 12);
  ctx.fillStyle = '#3a4a58'; ctx.fillRect(2, 2, 6, 4);
  ctx.fillStyle = `rgba(255,100,0,${0.3 + Math.sin(t*0.1+1)*0.2})`;
  ctx.beginPath(); ctx.arc(9, 4, 2, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  // Glow
  ctx.globalAlpha = 0.08;
  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 35);
  rg.addColorStop(0, 'rgba(0,200,255,0.4)'); rg.addColorStop(1, 'rgba(0,100,255,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// ── GUNSHIP (replaces Dragon) ──
function drawDragon(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash*2)*0.5;
  const t = frame;
  e.wingFrame = (e.wingFrame||0) + 0.3;
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
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
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
  ctx.beginPath(); ctx.arc(-20, 12.5, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-10, 12.5, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#5a6a78'; ctx.fillRect(-18, -15, 16, 5);
  ctx.fillStyle = '#dd3300';
  ctx.beginPath(); ctx.arc(-20, -12.5, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-10, -12.5, 2, 0, Math.PI*2); ctx.fill();
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
  ctx.beginPath(); ctx.arc(-32, 0, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(32, 0, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -32, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 32, 3, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#8899bb';
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  // Engine exhaust
  ctx.globalAlpha = 0.2 + Math.sin(t*0.15)*0.1;
  ctx.fillStyle = 'rgba(200,220,240,0.3)';
  ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(22+Math.random()*4, 0); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();
  // Nav lights
  ctx.globalAlpha = 0.6 + Math.sin(t*0.2)*0.4;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath(); ctx.arc(-10, 12, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#00ff00';
  ctx.beginPath(); ctx.arc(-10, -12, 2, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  // Glow
  ctx.globalAlpha = 0.06;
  const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
  fg.addColorStop(0, 'rgba(100,180,255,0.3)'); fg.addColorStop(1, 'rgba(0,100,200,0)');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2); ctx.fill();
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
    const blur = 10 + Math.sin(t*0.5)*4;
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = blur;
    const len = b.r * 2.8; // Reduced size per user request
    const wid = b.r * 0.45; 
    // Outer red glow beam
    ctx.fillStyle = 'rgba(255, 40, 40, 0.8)';
    ctx.beginPath(); ctx.ellipse(-len*0.3, 0, len, wid*1.5, 0, 0, Math.PI*2); ctx.fill();
    // Inner white hot core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-len*0.2, 0, len*0.6, wid*0.5, 0, 0, Math.PI*2); ctx.fill();
  } else if (b.btype === 'fireball') {
    // Dynamic Comet Fireball (Dragon)
    const waggle = Math.sin(t*0.6) * 3;
    // Trail
    const grad = ctx.createLinearGradient(0, 0, -b.r*4, waggle);
    grad.addColorStop(0, 'rgba(255, 200, 0, 0.9)');
    grad.addColorStop(0.5, 'rgba(255, 50, 0, 0.5)');
    grad.addColorStop(1, 'rgba(100, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b.r, 0);
    ctx.lineTo(-b.r*3, -b.r*1.5 + waggle);
    ctx.lineTo(-b.r*5, waggle*1.5);
    ctx.lineTo(-b.r*3, b.r*1.5 + waggle);
    ctx.closePath(); ctx.fill();
    // Core head
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.r*0.3, 0, b.r*0.4, 0, Math.PI*2); ctx.fill();
  } else if (b.btype === 'demon') {
    // Pulsing Void Orb (Scout Drone) completely decoupled from rotation for chaotic feel
    ctx.rotate(-angle); // Reverse angle to draw localized
    // Swirling black hole effect
    const pulse = b.r * (0.8 + 0.3 * Math.sin(t*0.3));
    ctx.shadowColor = '#cc00ff'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#220044';
    ctx.beginPath(); ctx.arc(0, 0, pulse*1.2, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    
    // Core
    ctx.fillStyle = '#ff44ff';
    ctx.beginPath(); ctx.arc(0, 0, b.r*0.6, 0, Math.PI*2); ctx.fill();
    // Orbiting dark matter
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
        const a = t*0.3 + i*(Math.PI*2/3);
        ctx.beginPath(); ctx.arc(Math.cos(a)*b.r*1.5, Math.sin(a)*b.r*1.5, b.r*0.3, 0, Math.PI*2); ctx.fill();
    }
  } else if (b.btype === 'sentinel_plasma') {
    // Massive Cyan Plasma sphere
    ctx.rotate(-angle);
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 25 + Math.sin(t*0.5)*15;
    // Plasma aura
    const pg = ctx.createRadialGradient(0,0,b.r*0.5, 0,0,b.r*1.8);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.3, '#00ffff'); pg.addColorStop(1, 'rgba(0,100,255,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(0, 0, b.r*1.8, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Violent electrical arcs
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, b.r * 0.15);
    for (let i = 0; i < 4; i++) {
      const a = t*0.4 + i*1.57;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*b.r*1.4 + (Math.random()-0.5)*b.r, Math.sin(a)*b.r*1.4 + (Math.random()-0.5)*b.r);
      ctx.stroke();
    }
  } else if (b.btype === 'warden_shell') {
    // Heavy Artillery Shell
    // Smoke trail
    ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath(); ctx.arc(-b.r*1.2*i, 0, b.r*(0.4+i*0.15), 0, Math.PI*2); ctx.fill();
    }
    // Thrust flame
    ctx.fillStyle = '#ff6600';
    ctx.beginPath(); ctx.moveTo(-b.r, -b.r*0.4); ctx.lineTo(-b.r*2.5, 0); ctx.lineTo(-b.r, b.r*0.4); ctx.fill();
    ctx.fillStyle = '#ffeebb';
    ctx.beginPath(); ctx.moveTo(-b.r, -b.r*0.2); ctx.lineTo(-b.r*1.8, 0); ctx.lineTo(-b.r, b.r*0.2); ctx.fill();
    // Metal shell casing
    ctx.fillStyle = '#555555';
    ctx.fillRect(-b.r, -b.r*0.5, b.r*1.5, b.r);
    // Dark grey tip
    ctx.fillStyle = '#222222';
    ctx.beginPath(); ctx.moveTo(b.r*0.5, -b.r*0.5); ctx.lineTo(b.r*1.2, 0); ctx.lineTo(b.r*0.5, b.r*0.5); ctx.fill();
    // Detail lines
    ctx.strokeStyle = '#333333'; ctx.lineWidth = Math.max(1, b.r*0.1);
    ctx.beginPath(); ctx.moveTo(-b.r*0.5, -b.r*0.5); ctx.lineTo(-b.r*0.5, b.r*0.5); ctx.stroke();
  } else if (b.btype === 'warden_fireball') {
    // Sun-like Massive Fireball
    ctx.rotate(-angle);
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 30 + Math.sin(t*0.3)*10;
    const wfg = ctx.createRadialGradient(0,0,0, 0,0,b.r*1.4);
    wfg.addColorStop(0, '#ffffff'); wfg.addColorStop(0.2, '#ffcc00'); wfg.addColorStop(0.6, '#ff4400'); wfg.addColorStop(1, 'rgba(150,0,0,0)');
    ctx.fillStyle = wfg;
    ctx.beginPath(); ctx.arc(0, 0, b.r*1.4, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Chaotic sun flares
    ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
    for(let i=0; i<6; i++) {
        const a = t*0.15 + i*1.04;
        const R = b.r * (1 + 0.4*Math.sin(t*0.5 + i));
        ctx.beginPath(); ctx.arc(Math.cos(a)*R, Math.sin(a)*R, b.r*0.3, 0, Math.PI*2); ctx.fill();
    }
  } else if (b.btype === 'overlord_missile') {
    // Advanced Sci-Fi Missile
    // Green fusion trail
    ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath(); ctx.arc(-b.r*1.2*i, Math.sin(t*0.4+i)*b.r*0.2, b.r*(0.5-i*0.08), 0, Math.PI*2); ctx.fill();
    }
    // Trust flame
    ctx.shadowColor = '#00ff55'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#aaffcc';
    ctx.beginPath(); ctx.moveTo(-b.r, -b.r*0.3); ctx.lineTo(-b.r*2.2, 0); ctx.lineTo(-b.r, b.r*0.3); ctx.fill();
    ctx.shadowBlur = 0;
    // Missile Body (sleek white/grey)
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.ellipse(0, 0, b.r*1.2, b.r*0.5, 0, 0, Math.PI*2); ctx.fill();
    // Green glowing stripes
    ctx.strokeStyle = '#00ff55'; ctx.lineWidth = b.r*0.15;
    ctx.beginPath(); ctx.moveTo(-b.r*0.4, -b.r*0.45); ctx.lineTo(-b.r*0.4, b.r*0.45); ctx.stroke();
    // High-tech red sensor tip
    ctx.fillStyle = '#ff0044';
    ctx.beginPath(); ctx.arc(b.r*1.1, 0, b.r*0.25, 0, Math.PI*2); ctx.fill();
    // Fins
    ctx.fillStyle = '#888888';
    ctx.beginPath(); ctx.moveTo(-b.r*0.6, -b.r*0.4); ctx.lineTo(-b.r*0.9, -b.r*0.9); ctx.lineTo(-b.r*0.2, -b.r*0.4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-b.r*0.6, b.r*0.4); ctx.lineTo(-b.r*0.9, b.r*0.9); ctx.lineTo(-b.r*0.2, b.r*0.4); ctx.fill();
  }
  ctx.restore();
}
function checkCollBullet(b) {
  const px = player.x + 8, py = player.y + 8, pw = player.w - 16, ph = player.h - 16;
  return b.x + b.r > px && b.x - b.r < px + pw && b.y + b.r > py && b.y - b.r < py + ph;
}

// ── UI UPDATES ──────────────────────────────
function updateHearts() { heartsEl.textContent = '❤️'.repeat(hearts) + (hearts < 3 ? '🖤'.repeat(3-hearts) : ''); }
function updateHUD() { distEl.textContent = Math.floor(distance) + ' m'; coinEl.textContent = runCoins; }
function updatePUBar() {
  if (activePU && puTimer > 0) { puBarEl.classList.remove('hidden'); puFillEl.style.width = (puTimer/puMaxTime*100)+'%';
    puIconEl.textContent = activePU==='shield'?'🛡️':activePU==='speed'?'⚡':activePU==='ultimate'?'⭐':'🧲';
    if (activePU==='ultimate') puFillEl.style.background = 'linear-gradient(90deg,#9933ff,#ff44ff,#ffd700)';
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
  player.trail.push({ x:px, y:py, life:1 });
  if (player.trail.length > 12) player.trail.shift();
  // Trail
  player.trail.forEach(tr => { tr.life -= 0.09; if (tr.life <= 0) return;
    ctx.save(); ctx.globalAlpha = tr.life * 0.15; ctx.fillStyle = shieldActive ? '#44ff88' : cGlow;
    ctx.beginPath(); ctx.ellipse(tr.x+player.w*.5, tr.y+player.h*.5, player.w*.2*tr.life, player.h*.15*tr.life, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  });
  ctx.save(); ctx.translate(px+player.w*.5, py+player.h*.5);
  const tilt = Math.max(-0.2, Math.min(0.2, player.vy * 0.02)); ctx.rotate(tilt);
  if (invincible > 0 && Math.floor(invincible/4)%2===0) { ctx.restore(); return; }
  // Shield bubble
  if (shieldActive) { ctx.save(); ctx.globalAlpha=.2+.1*Math.sin(t*.1); ctx.strokeStyle='#44ff88'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=.06; ctx.fillStyle='#44ff88'; ctx.fill(); ctx.restore(); }

  // ── JETPACK (Dynamic Shapes) ──
  ctx.save();
  if (jet.id === 'dragon') {
    // Golden Dragon Turbine
    ctx.fillStyle='#553300'; ctx.fillRect(-player.w*.55, -8, 14, 28);
    ctx.fillStyle='#ccaa00'; ctx.fillRect(-player.w*.55+2, -5, 10, 20); // Gold plates
    ctx.fillStyle='#ff4400'; ctx.fillRect(-player.w*.55+1, 10, 4, 8); // Red vents
    ctx.fillStyle='#222'; ctx.fillRect(-player.w*.55+2, 20, 10, 6); // Wide nozzle
  } else if (jet.id === 'void') {
    // Void Singularity Core
    ctx.translate(-player.w*.5, 5);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#aa00ff'; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
    // Orbit rings
    ctx.strokeStyle = `rgba(170,0,255,${0.5 + Math.sin(t*.2)*0.5})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0,0, 14, 6, t*.1, 0, Math.PI*2); ctx.stroke();
  } else {
    // Plasma Pack (Default)
    ctx.fillStyle='#1c1f26'; ctx.fillRect(-player.w*.55, -8, 12, 26);
    ctx.fillStyle='#2b303a'; ctx.fillRect(-player.w*.55+2, -5, 8, 20);
    ctx.fillStyle='#00f3ff'; ctx.fillRect(-player.w*.55+1, 8, 2, 6); // glowing accent
    ctx.fillStyle='#111'; ctx.fillRect(-player.w*.55+2, 18, 8, 5); // Nozzles
  }
  ctx.restore();

  // ── JETPACK FLAMES & EXHAUST ──
  if (isHolding && state==='playing' && !player.onGround) {
    ctx.save();
    const fx = -player.w*.44, fy = 20;
    if (jet.id === 'dragon') {
      const fH = 25 + Math.random() * 15;
      const fg = ctx.createLinearGradient(fx, fy, fx, fy + fH);
      fg.addColorStop(0, '#ffff00'); fg.addColorStop(.3, '#ffaa00'); fg.addColorStop(.7, '#ff0000'); fg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.lineTo(fx - 2, fy + fH); ctx.lineTo(fx + 8, fy + fH*0.8); ctx.lineTo(fx + 10, fy); ctx.fill();
      if(frame%2===0) spawnP(px + player.w*.1, py + player.h*.8, '#ff9900', 1.5);
    } else if (jet.id === 'void') {
      ctx.strokeStyle=`rgba(170,0,255,${0.8 - (frame%15)/15})`; ctx.lineWidth=3;
      const ps = (frame%15)/15;
      ctx.beginPath(); ctx.ellipse(fx+3, fy + ps*25, 8 + ps*12, 3 + ps*6, 0, 0, Math.PI*2); ctx.stroke();
      if(frame%3===0) spawnP(px + player.w*.1, py + player.h*.8, '#aa00ff', 1);
    } else {
      const fH = 22 + Math.random() * 14;
      const fg = ctx.createLinearGradient(fx, fy, fx, fy + fH);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(.2, '#00f3ff'); fg.addColorStop(.6, '#0044ff'); fg.addColorStop(1, 'rgba(0,100,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.quadraticCurveTo(fx + Math.random()*5 - 2, fy + fH*.6, fx, fy + fH);
      ctx.quadraticCurveTo(fx + Math.random()*5, fy + fH*.6, fx + 8, fy); ctx.closePath(); ctx.fill();
      if(frame%2===0) spawnP(px + player.w*.1, py + player.h*.8, '#00f3ff', 1);
    }
    ctx.restore();
  }

  // ── LEGS (Cyber Armor) ──
  const legColor = char.id === 'apsara' ? cAccent : '#1a1d24'; // Brighter gold/white legs for Apsara
  if(player.onGround) {
    player.runFrame += .22;
    const lL = Math.sin(player.runFrame) * 11, lR = Math.sin(player.runFrame + Math.PI) * 11;
    ctx.save(); ctx.strokeStyle=legColor; ctx.lineWidth=7; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(-6 + lL, 24); ctx.stroke(); 
    ctx.fillStyle=cAccent; ctx.fillRect(-10 + lL, 22, 12, 5); // left boot
    ctx.fillStyle=cGlow; ctx.fillRect(-8 + lL, 24, 4, 2); // left heel
    ctx.restore();
    ctx.save(); ctx.strokeStyle=legColor; ctx.lineWidth=7; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(6, 12); ctx.lineTo(6 + lR, 24); ctx.stroke(); 
    ctx.fillStyle=cAccent; ctx.fillRect(-2 + lR, 22, 12, 5); // right boot
    ctx.fillStyle=cGlow; ctx.fillRect(0 + lR, 24, 4, 2); 
    ctx.restore();
  } else {
    const d2 = Math.sin(frame * .08) * 4;
    ctx.save(); ctx.strokeStyle=legColor; ctx.lineWidth=6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(-8 + d2, 23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(8 - d2, 23); ctx.stroke(); ctx.restore();
    ctx.fillStyle=cAccent;
    ctx.fillRect(-12 + d2, 21, 10, 5); ctx.fillStyle=cGlow; ctx.fillRect(-10+d2, 23, 4, 2);
    ctx.fillStyle=cAccent;
    ctx.fillRect(4 - d2, 21, 10, 5); ctx.fillStyle=cGlow; ctx.fillRect(6-d2, 23, 4, 2);
  }

  // ── TORSO (Cyber Suit) ──
  ctx.save();
  ctx.fillStyle = cAccent;
  ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(-8, -14); ctx.lineTo(8, -14); ctx.lineTo(11, -8);
  ctx.lineTo(12, 13); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = cBody; 
  ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(7, -12); ctx.lineTo(9, 2); ctx.lineTo(-9, 2); ctx.closePath(); ctx.fill();
  ctx.shadowColor = cGlow; ctx.shadowBlur = 10;
  ctx.fillStyle = cGlow; ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = cBody; ctx.fillRect(-13, 9, 26, 5); // Belt
  ctx.fillStyle = cGlow; ctx.fillRect(-3, 10, 6, 3);
  ctx.restore();

  // ── ARMS & WEAPON ──
  const armSwing = player.onGround ? Math.sin(player.runFrame * 0.5) * 0.2 : Math.sin(frame * 0.05) * 0.1;
  const attackAngle = player.onGround ? 0 : (player.vy * 0.05);
  
  // Back Arm
  ctx.save(); ctx.translate(-10, -6); ctx.rotate(-0.4 + armSwing);
  ctx.fillStyle = cBody; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill(); 
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
    ctx.beginPath(); ctx.moveTo(-10,-28); ctx.lineTo(-14,-36); ctx.lineTo(-6,-28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2,-30); ctx.lineTo(0,-42); ctx.lineTo(2,-30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6,-28); ctx.lineTo(14,-36); ctx.lineTo(10,-28); ctx.fill();
    // Sun Visor
    ctx.shadowColor = cGlow; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(2, -22, 5, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (char.id === 'demon') {
    // Demonic Horns
    ctx.fillStyle = cGlow;
    ctx.beginPath(); ctx.moveTo(-8,-28); ctx.lineTo(-14,-40); ctx.lineTo(-3,-30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4,-30); ctx.lineTo(14,-40); ctx.lineTo(8,-28); ctx.fill();
    // Slit Visor
    ctx.shadowColor = cGlow; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0,-24); ctx.lineTo(8,-20); ctx.lineTo(0,-22); ctx.lineTo(-8,-20); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // Cyber Ninja Visor
    ctx.fillStyle = cAccent; ctx.fillRect(-11, -22, 22, 4); // Ridge
    ctx.shadowColor = cGlow; ctx.shadowBlur = 12 + Math.sin(t*0.5)*4;
    ctx.fillStyle = cGlow; ctx.beginPath(); ctx.roundRect(-3, -24, 14, 5, 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Ear piece
    ctx.fillStyle = cAccent; ctx.beginPath(); ctx.arc(-6, -20, 3, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Front Arm + ENERGY SABER
  ctx.save(); ctx.translate(10, -6); ctx.rotate(0.3 - armSwing * 0.5 - attackAngle * 0.5);
  ctx.fillStyle = cBody; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = cAccent; ctx.fillRect(-3, 0, 7, 14); 
  
  ctx.translate(1, 14); // Hand grip
  ctx.rotate(-1.6); // Forward horizontal point

  // Hilt
  ctx.fillStyle = cAccent; ctx.fillRect(-3, -2, 6, 12); 
  ctx.fillStyle = '#222'; ctx.fillRect(-4, -4, 8, 3);
  ctx.fillStyle = cGlow; ctx.fillRect(-1, 8, 2, 2);

  // Energy Saber
  const sLen = 38 + Math.random() * 2;
  ctx.shadowColor = cSaber; ctx.shadowBlur = 20 + Math.sin(t*0.7)*5;
  ctx.fillStyle = cSaber;
  ctx.beginPath(); ctx.roundRect(-3, -sLen-4, 6, sLen, 3); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-1.5, -sLen-3, 3, sLen-2, 1.5); ctx.fill();
  
  if (!player.onGround && player.vy > 1) {
    ctx.globalAlpha = 0.4; ctx.fillStyle = cSaber;
    ctx.beginPath(); ctx.moveTo(-3, -sLen); ctx.lineTo(-18, -sLen - player.vy*2); ctx.lineTo(0,-4); ctx.fill();
  }
  ctx.restore();

  // Speed aura
  if(activePU==='speed'){ ctx.save(); ctx.globalAlpha=.25+.12*Math.sin(t*.25);
    const sg=ctx.createRadialGradient(0,0,0,0,0,40); sg.addColorStop(0,'rgba(0,200,255,.4)'); sg.addColorStop(1,'rgba(0,100,255,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  // Ultimate aura (purple + gold electric)
  if(activePU==='ultimate'){ ctx.save();
    // Inner gold shield glow
    ctx.globalAlpha=.2+.1*Math.sin(t*.15); ctx.strokeStyle='#ffd700'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,38,0,Math.PI*2); ctx.stroke();
    // Outer purple energy ring
    ctx.globalAlpha=.3+.12*Math.sin(t*.2);
    const ug=ctx.createRadialGradient(0,0,10,0,0,48); ug.addColorStop(0,'rgba(200,80,255,.4)'); ug.addColorStop(0.6,'rgba(150,0,255,.2)'); ug.addColorStop(1,'rgba(100,0,200,0)');
    ctx.fillStyle=ug; ctx.beginPath(); ctx.arc(0,0,48,0,Math.PI*2); ctx.fill();
    // Electric arcs
    ctx.save(); ctx.rotate(t*0.06); ctx.strokeStyle='rgba(200,100,255,0.5)'; ctx.lineWidth=1.5;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,36+Math.sin(t*0.15+i)*6, i*2.09, i*2.09+1.2);ctx.stroke();}
    ctx.restore();
    ctx.restore(); }
  ctx.restore();
}

// ── DRAW OBSTACLES ──────────────────────────
function drawObstacles() {
  obstacles.forEach(ob => {
    if(ob.type==='laser') drawLaser(ob);
    else if(ob.type==='electric') drawElec(ob);
  });
}
function drawLaser(ob) {
  ctx.save();
  // Cyberpunk Laser Emitters (Blue Theme)
  ctx.fillStyle='#1c1f26'; ctx.fillRect(ob.x-4,ob.y-18,ob.w+8,18); ctx.fillRect(ob.x-4,ob.y+ob.beamH,ob.w+8,18);
  ctx.fillStyle='#2b303a'; ctx.fillRect(ob.x-2,ob.y-16,ob.w+4,16); ctx.fillRect(ob.x-2,ob.y+ob.beamH,ob.w+4,16);
  // Glowing emitter slits
  ctx.fillStyle='#00f3ff'; ctx.shadowColor='#00f3ff'; ctx.shadowBlur=12;
  ctx.fillRect(ob.x+4,ob.y-6,ob.w-8,6); ctx.fillRect(ob.x+4,ob.y+ob.beamH,ob.w-8,6);
  ctx.shadowBlur=0;
  
  // Warning phase
  if(ob.warningTimer>0){ 
    const fl=Math.sin(frame*.3)*.5+.5; ctx.fillStyle=`rgba(0,240,255,${fl*.7})`;
    ctx.beginPath(); ctx.arc(ob.x+ob.w/2,ob.y,6,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(ob.x+ob.w/2,ob.y+ob.beamH,6,0,Math.PI*2); ctx.fill(); 
  }
  
  // Active Laser Beam
  if(ob.beamOn){ 
    // Outer ambient glow width
    ctx.globalAlpha=.2; ctx.fillStyle='#00f3ff'; ctx.fillRect(ob.x-10,ob.y,ob.w+20,ob.beamH); 
    ctx.globalAlpha=1;
    
    // Gradient core beam
    const bg=ctx.createLinearGradient(ob.x,0,ob.x+ob.w,0);
    bg.addColorStop(0,'rgba(0,80,255,.1)'); bg.addColorStop(.3,'rgba(0,200,255,.9)'); 
    bg.addColorStop(.5,'rgba(255,255,255,1)');
    bg.addColorStop(.7,'rgba(0,200,255,.9)'); bg.addColorStop(1,'rgba(0,80,255,.1)');
    ctx.fillStyle=bg; ctx.fillRect(ob.x-6,ob.y,ob.w+12,ob.beamH);
    
    // Intense internal solid core
    ctx.fillStyle='#ffffff'; ctx.shadowColor='#00f3ff'; ctx.shadowBlur=8;
    ctx.fillRect(ob.x+ob.w/2-2, ob.y, 4, ob.beamH);
  }
  ctx.restore();
}
function drawElec(ob) {
  ctx.save();
  const cx=ob.x+ob.w/2;
  // Cyberpunk Sci-Fi Base Nodes (Scaled Up)
  const bw = 32, bh = 20;
  ctx.fillStyle='#1c1f26'; ctx.fillRect(cx-bw/2, ob.y1-bh/2, bw, bh);
  ctx.fillRect(cx-bw/2, ob.y2-bh/2, bw, bh);
  ctx.fillStyle='#2b303a'; ctx.fillRect(cx-bw/2+2, ob.y1-bh/2+2, bw-4, bh-4);
  ctx.fillRect(cx-bw/2+2, ob.y2-bh/2+2, bw-4, bh-4);
  // Red glowing nodes
  ctx.fillStyle='#ff0033'; 
  ctx.shadowColor='#ff0033'; ctx.shadowBlur=16;
  ctx.beginPath(); ctx.arc(cx,ob.y1,6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx,ob.y2,6,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;

  if(ob.on){ 
    ctx.strokeStyle='#ff0033'; ctx.lineWidth=3.5; ctx.globalAlpha=.8+.2*Math.sin(frame*.3);
    for(let a=0;a<3;a++){ ctx.beginPath(); ctx.moveTo(cx,ob.y1);
      for(let s=1;s<=8;s++){ const t2=s/8; ctx.lineTo(cx+(Math.random()-.5)*35*Math.sin(frame*.2+a), ob.y1+(ob.y2-ob.y1)*t2); }
      ctx.stroke(); 
    }
    // Bright hot core lightning
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.globalAlpha=.9;
    ctx.beginPath(); ctx.moveTo(cx,ob.y1);
    for(let s=1;s<=5;s++){ const t2=s/5; ctx.lineTo(cx+(Math.random()-.5)*12, ob.y1+(ob.y2-ob.y1)*t2); }
    ctx.stroke();

    // Ambient red light shaft (Wider)
    ctx.globalAlpha=.18; 
    const lg = ctx.createLinearGradient(cx-30, 0, cx+30, 0);
    lg.addColorStop(0, 'rgba(255,0,50,0)'); lg.addColorStop(0.5, '#ff0033'); lg.addColorStop(1, 'rgba(255,0,50,0)');
    ctx.fillStyle=lg; ctx.fillRect(cx-30,ob.y1,60,ob.y2-ob.y1); 
  }
  ctx.restore();
}
function drawMissiles() {
  missiles.forEach(m => { ctx.save(); ctx.translate(m.x, m.y);
    // Trailing glow
    ctx.globalAlpha = 0.15;
    const tg = ctx.createRadialGradient(-m.w*.2, 0, 0, -m.w*.2, 0, m.h*1.5);
    tg.addColorStop(0, 'rgba(255,100,0,0.5)'); tg.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(-m.w*.2, 0, m.h*1.5, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    // Missile body (metallic gradient)
    const bg = ctx.createLinearGradient(0, -m.h/2, 0, m.h/2);
    bg.addColorStop(0, '#888'); bg.addColorStop(0.3, '#aaa'); bg.addColorStop(0.5, '#ccc');
    bg.addColorStop(0.7, '#999'); bg.addColorStop(1, '#666');
    ctx.fillStyle = bg; ctx.beginPath();
    ctx.moveTo(m.w*0.8, 0); ctx.lineTo(m.w*0.1, -m.h/2); ctx.lineTo(-m.w*.3, -m.h/2);
    ctx.lineTo(-m.w*.3, m.h/2); ctx.lineTo(m.w*0.1, m.h/2); ctx.closePath(); ctx.fill();
    // Nose cone (red)
    const ng = ctx.createLinearGradient(m.w*0.7, 0, m.w, 0);
    ng.addColorStop(0, '#cc2200'); ng.addColorStop(0.5, '#ff3311'); ng.addColorStop(1, '#ee2200');
    ctx.fillStyle = ng; ctx.beginPath();
    ctx.moveTo(m.w, 0); ctx.lineTo(m.w*0.7, -m.h*0.35); ctx.lineTo(m.w*0.7, m.h*0.35); ctx.closePath(); ctx.fill();
    // Fins
    ctx.fillStyle = '#cc3322';
    ctx.beginPath(); ctx.moveTo(-m.w*.25, -m.h/2); ctx.lineTo(-m.w*.35, -m.h*0.9);
    ctx.lineTo(-m.w*.15, -m.h/2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-m.w*.25, m.h/2); ctx.lineTo(-m.w*.35, m.h*0.9);
    ctx.lineTo(-m.w*.15, m.h/2); ctx.closePath(); ctx.fill();
    // Body stripe
    ctx.fillStyle = '#dd4422'; ctx.fillRect(-m.w*0.1, -m.h*0.15, m.w*0.5, m.h*0.3);
    // Window
    ctx.fillStyle = '#88ddff'; ctx.beginPath(); ctx.arc(m.w*0.5, 0, m.h*0.15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(m.w*0.48, -m.h*0.05, m.h*0.08, 0, Math.PI*2); ctx.fill();
    // Exhaust flames (multi-layer)
    const eL = 18 + Math.random() * 14;
    // Outer flame (orange)
    ctx.fillStyle = `rgba(255,150,0,${.4+Math.random()*.3})`;
    ctx.beginPath(); ctx.moveTo(-m.w*.3, -m.h*.4); ctx.lineTo(-m.w*.3-eL*1.2, 0);
    ctx.lineTo(-m.w*.3, m.h*.4); ctx.closePath(); ctx.fill();
    // Inner flame (yellow-white)
    ctx.fillStyle = `rgba(255,220,80,${.5+Math.random()*.3})`;
    ctx.beginPath(); ctx.moveTo(-m.w*.3, -m.h*.2); ctx.lineTo(-m.w*.3-eL*0.7, 0);
    ctx.lineTo(-m.w*.3, m.h*.2); ctx.closePath(); ctx.fill();
    // Core (white)
    ctx.fillStyle = `rgba(255,255,220,${.6+Math.random()*.3})`;
    ctx.beginPath(); ctx.moveTo(-m.w*.3, -m.h*.1); ctx.lineTo(-m.w*.3-eL*0.3, 0);
    ctx.lineTo(-m.w*.3, m.h*.1); ctx.closePath(); ctx.fill();
    ctx.restore(); });
  // Warnings
  missileWarnings.forEach(w => { const W=canvas.gameW;
    ctx.save(); ctx.globalAlpha=.5+.5*Math.sin(frame*.25);
    ctx.fillStyle='#ff3344'; ctx.font='bold 36px sans-serif';
    ctx.shadowColor='#ff0000'; ctx.shadowBlur=20;
    ctx.textAlign='right'; ctx.fillText('⚠️ 🚀', W-20, w.y+8);
    ctx.shadowBlur=0; ctx.restore(); });
}

// ── DRAW COINS & PICKUPS ────────────────────
function drawCoin(c) {
  if(c.collected) return; 
  c.bob += 0.05; 
  const cy = c.y + Math.sin(c.bob) * 3;
  
  ctx.save(); ctx.globalAlpha = c.alpha;
  ctx.translate(c.x, cy);

  // 3D edge (drop shadow / thickness) drawn bottom-right
  ctx.fillStyle = '#b36b00';
  ctx.beginPath(); ctx.arc(2, 2, c.r, 0, Math.PI*2); ctx.fill();

  // Outer rim
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI*2); ctx.fill();
  
  // Inner darker circle
  ctx.fillStyle = '#d99a00';
  ctx.beginPath(); ctx.arc(0, 0, c.r*0.7, 0, Math.PI*2); ctx.fill();

  // Vertical slit (Sci-fi coin detail)
  ctx.fillStyle = '#aa6600';
  ctx.fillRect(-c.r*0.15, -c.r*0.4, c.r*0.3, c.r*0.8);
  
  // Bright highlight
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(-c.r*0.4, -c.r*0.4, c.r*0.15, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}
function drawPickup2(p) {
  p.bob+=.07; const py=p.y+Math.sin(p.bob)*5; ctx.save(); ctx.globalAlpha=p.alpha; ctx.translate(p.x,py);
  if (p.type === 'ultimate') {
    // Ultimate pack — golden star with purple/gold energy
    const t = frame;
    const pulseS = 1 + Math.sin(t * 0.12) * 0.1;
    ctx.scale(pulseS, pulseS);
    ctx.save(); ctx.rotate(t * 0.04);
    // Rotating energy ring
    ctx.globalAlpha = p.alpha * 0.25;
    ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*1.2); ctx.stroke();
    ctx.strokeStyle = '#44ccff'; ctx.beginPath(); ctx.arc(0,0,28,Math.PI,Math.PI*2.2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = p.alpha;
    // Background — dual gradient (purple + gold)
    const bg = ctx.createRadialGradient(0,-3,2,0,0,22);
    bg.addColorStop(0,'#fff'); bg.addColorStop(0.2,'#ff88ff'); bg.addColorStop(0.6,'#9933ff'); bg.addColorStop(1,'#4400aa');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
    // Gold border
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke();
    // Star icon
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⭐',0,1);
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
  const gc=p.type==='shield'?['#44ff88','#228844','#66ffaa']:p.type==='speed'?['#00ccff','#0066aa','#66ddff']:['#ffdd00','#aa8800','#ffee66'];
  const pg=ctx.createRadialGradient(0,0,0,0,0,18); pg.addColorStop(0,gc[0]); pg.addColorStop(1,gc[1]);
  ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=gc[2]; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.stroke();
  ctx.font='18px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(p.type==='shield'?'🛡️':p.type==='speed'?'⚡':'🧲',0,0);
  ctx.globalAlpha*=.3; const gw=ctx.createRadialGradient(0,0,0,0,0,28);
  gw.addColorStop(0,gc[0]); gw.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gw;
  ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*2); ctx.fill(); ctx.restore();
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
  particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=.15; p.vx*=.96; p.life-=.04; if(p.life<=0) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.col;
    ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(.1,p.r*p.life),0,Math.PI*2); ctx.fill(); ctx.restore(); });
  particles = particles.filter(p => p.life > 0);
}

// ── COLLISION ────────────────────────────────
function dist(x1,y1,x2,y2) { return Math.sqrt((x1-x2)**2+(y1-y2)**2); }
function checkCollLaser(ob) {
  if(!ob.beamOn) return false;
  const px=player.x+8,py=player.y+8,pw=player.w-16,ph=player.h-16;
  return px<ob.x+ob.w && px+pw>ob.x && py<ob.y+ob.beamH && py+ph>ob.y;
}
function checkCollElec(ob) {
  if(!ob.on) return false;
  const px=player.x+8,py=player.y+8,pw=player.w-16,ph=player.h-16;
  const cx=ob.x+ob.w/2;
  return px<cx+12 && px+pw>cx-12 && py<ob.y2 && py+ph>ob.y1;
}
function checkCollMissile(m) {
  const px=player.x+8,py=player.y+8,pw=player.w-16,ph=player.h-16;
  return px<m.x+m.w && px+pw>m.x-m.w*.3 && py<m.y+m.h/2 && py+ph>m.y-m.h/2;
}

function hitPlayer() {
  if(invincible > 0) return;
  if(shieldActive) { shieldActive=false; activePU=null; puTimer=0; invincible=60;
    sfx.shieldBreak(); spawnP(player.x+player.w*.5,player.y+player.h*.5,'#44ff88',15);
    screenShake = 12; return; }
  hearts--; updateHearts(); invincible=90;
  sfx.hit(); spawnP(player.x+player.w*.5,player.y+player.h*.5,'#FF2200',12);
  screenShake = 18;
  floatingTexts.push({ x:player.x+player.w*.5, y:player.y-10, text:'💔', color:'#ff3344', life:1, vy:-2 });
  if(hearts<=0) gameOver();
}

function gameOver() {
  state='over'; stopMusic(); stopJetpackSound(); sfx.over();
  score = Math.floor(distance) + runCoins * 5;
  const best = getBestScore();
  addScore(score); addCoins(runCoins);
  document.getElementById('goDist').textContent = Math.floor(distance)+' m';
  document.getElementById('goCoins').textContent = runCoins;
  document.getElementById('goScore').textContent = score;
  document.getElementById('goBest').textContent = Math.max(score, best);
  document.getElementById('gameOverScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
}

function goHome() {
  state='start'; stopMusic(); stopJetpackSound();
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  updateTotalCoins(); checkDailyReward();
  loopRunning = false;
}

// ── GAME INIT ────────────────────────────────
function startGame() {
  try {
    const W=canvas.gameW, H=canvas.gameH;
    player.x=W*.12; player.y=H*.4; player.vy=0; player.trail=[]; player.onGround=false;
    obstacles=[]; coins=[]; pickups=[]; heartPacks=[]; particles=[]; missiles=[]; missileWarnings=[];
    enemies=[]; enemyBullets=[];
    score=0; distance=0; runCoins=0; frame=0; hearts=3; invincible=0;
    activePU=null; puTimer=0; shieldActive=false; bgX=0;
    boss=null; bossDefeated=[false,false,false]; bossWarning=0;
    graceFrames=60;
    curBiome='bridge'; window.curBiome='bridge';
    banner={text:'',timer:0}; window.banner=banner;
    speed=BASE_SPEED; updateHearts(); updateHUD(); updatePUBar();
    for(let i=0;i<3;i++) spawnCoinPattern();
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    state='playing';
    try { startMusic('bridge'); } catch(e) { console.warn('[KSR] music error:', e); }
    lastT=performance.now();
    if(!loopRunning){ loopRunning=true; requestAnimationFrame(loop); }
  } catch(err) { console.error('startGame error:', err); }
}

// ── MAIN LOOP ────────────────────────────────
function loop(ts) {
  if(state!=='playing'){ loopRunning=false; return; }
  const rawDt=ts-lastT; lastT=ts;
  const dt=Math.min(rawDt/TARGET_DT, 3);
  frame++;
  const W=canvas.gameW, H=canvas.gameH, gY=H*GROUND_RATIO;
  const speedMult = (activePU==='speed' || activePU==='ultimate') ? 1.6 : 1;
  // Phase-based difficulty
  let speedAccel;
  if (distance < 2000) speedAccel = distance * 0.0008;       // Phase 1: Easy
  else if (distance < 4000) speedAccel = 1.6 + (distance - 2000) * 0.0018; // Phase 2: Medium→Hard
  else speedAccel = 5.2 + (distance - 4000) * 0.002;         // Phase 3: Hard
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
  if(graceFrames>0){ graceFrames-=dt; player.vy=0; player.y=H*.4+Math.sin(frame*.08)*4; }
  else {
    // Physics
    if(isHolding && !startClickGuard) {
      player.vy += THRUST * dt;
      player.onGround = false;
    } else {
      player.vy += GRAVITY * dt;
    }
    player.vy = Math.max(MAX_RISE, Math.min(MAX_FALL, player.vy));
    player.y += player.vy * dt;
  }
  // Bounds
  if(player.y<0){ player.y=0; player.vy=0; }
  if(player.y+player.h>gY){ player.y=gY-player.h; player.vy=0; player.onGround=true; }
  else { player.onGround=false; }

  // ── BOSS SPAWNING ──
  if (!boss && distance >= 2000 && !bossDefeated[0]) spawnBoss(1);
  if (!boss && distance >= 4000 && !bossDefeated[1]) spawnBoss(2);
  if (!boss && distance >= 6000 && !bossDefeated[2]) spawnBoss(3);

  // ── PHASE-BASED SPAWNING (fewer enemies!) ──
  let si, enemyChance, missileChance;
  if (distance < 2000) {
    // PHASE 1: Easy — mostly obstacles, rare enemies
    si = Math.max(100, 160 - distance * 0.015);
    enemyChance = 0.12;
    missileChance = 0.15;
  } else if (distance < 4000) {
    // PHASE 2: Medium — more obstacles and enemies
    si = Math.max(70, 120 - (distance-2000) * 0.015);
    enemyChance = 0.22;
    missileChance = 0.25;
  } else {
    // PHASE 3: Hard — dense obstacles, more enemies
    si = Math.max(50, 80 - (distance-4000) * 0.02);
    enemyChance = 0.28;
    missileChance = 0.30;
  }
  // Don't spawn regular enemies during boss fights
  const bossActive = boss && boss.entered && !boss.retreating;
  if(frame>80 && frame%Math.floor(si)===0 && !bossActive){ const r=Math.random();
    if(r<.35) spawnLaser();
    else if(r<.60) spawnElectric();
    else if(r<.60+missileChance) spawnMissileWarning();
    else if(r<.60+missileChance+enemyChance) spawnEnemy();
  }
  // Phase 2+: occasional extra mech/gunship (rare)
  if(distance > 2500 && frame%Math.floor(si*1.5)===0 && Math.random()<0.08 && !bossActive) spawnEnemy('robot');
  if(distance > 3500 && frame%Math.floor(si*1.5)===0 && Math.random()<0.08 && !bossActive) spawnEnemy('dragon');
  if(frame%180===0) spawnCoinPattern();
  if(frame%350===0) spawnPickup();
  // Heart packs: spawn every ~500 frames, only when player has lost hearts
  if(frame%500===0 && hearts < 3) spawnHeartPack();
  // Ultimate packs: rare, every ~700 frames, only after 1200m
  if(frame%700===0 && distance > 1200 && Math.random() < 0.3) spawnUltimatePack();

  // Power-ups
  if(invincible>0) invincible-=dt;
  if(puTimer>0){ puTimer-=dt; if(puTimer<=0){ activePU=null; shieldActive=false; } }
  updatePUBar();

  // Magnet effect
  if(activePU==='magnet'){ coins.forEach(c => { if(c.collected) return;
    const dx=player.x+player.w/2-c.x, dy=player.y+player.h/2-c.y, d2=Math.sqrt(dx*dx+dy*dy);
    if(d2<160){ c.x+=dx*.08; c.y+=dy*.08; } }); }

  // Obstacles
  obstacles=obstacles.filter(ob=>ob.x+ob.w>-60);
  obstacles.forEach(ob=>{
    ob.x-=spd;
    if(ob.type==='laser'){ if(ob.warningTimer>0){ob.warningTimer-=dt;if(ob.warningTimer<=0)ob.beamOn=true;}
      if(!ob.passed&&ob.x+ob.w<player.x){ob.passed=true; sfx.pass();}
      if(invincible<=0&&!shieldActive&&activePU!=='speed'&&checkCollLaser(ob)) hitPlayer();
      else if((shieldActive||activePU==='speed')&&checkCollLaser(ob)&&invincible<=0) hitPlayer();
    }
    if(ob.type==='electric'){ ob.phase+=.05*dt; ob.on=Math.sin(ob.phase)>-0.3;
      if(!ob.passed&&ob.x+ob.w<player.x){ob.passed=true; sfx.pass();}
      if(invincible<=0&&checkCollElec(ob)) hitPlayer();
    }
  });
  drawObstacles();

  // Missile warnings → missiles
  missileWarnings=missileWarnings.filter(w=>{ w.timer-=dt; if(w.timer<=0){spawnMissile(w.y,w.speed);return false;} return true; });
  // Missiles
  missiles=missiles.filter(m=>m.x+m.w>-60);
  missiles.forEach(m=>{ m.x+=m.vx*dt;
    if(!m.passed&&m.x+m.w<player.x){m.passed=true; sfx.pass();}
    if(invincible<=0&&checkCollMissile(m)) hitPlayer();
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
    b.x += b.vx * dt; b.y += b.vy * dt;
    drawEnemyBullet(b);
    if (invincible <= 0 && checkCollBullet(b)) {
      hitPlayer();
      b.life = 0;
      spawnP(b.x, b.y, '#cc44ff', 8);
    }
  });

  // Coins
  coins=coins.filter(c=>c.x>-30&&c.alpha>0);
  coins.forEach(c=>{ c.x-=spd; if(!c.collected){ drawCoin(c);
    if(dist(player.x+player.w*.5,player.y+player.h*.5,c.x,c.y)<22){
      c.collected=true; runCoins++; sfx.coin(); spawnP(c.x,c.y,'#FFD700',8); c.alpha=0; checkBiome(); }} });

  // Pickups
  pickups=pickups.filter(p=>p.x>-40&&p.alpha>0);
  pickups.forEach(p=>{ p.x-=spd; drawPickup2(p);
    if(dist(player.x+player.w*.5,player.y+player.h*.5,p.x,p.y)<28){
      activePU=p.type;
      if(p.type==='shield'){ shieldActive=true; puTimer=99999; puMaxTime=99999; sfx.shield(); }
      else if(p.type==='speed'){ puTimer=300; puMaxTime=300; sfx.speed(); }
      else if(p.type==='ultimate'){
        // Ultimate: speed + shield for 6 seconds (~360 frames)
        shieldActive=true; puTimer=360; puMaxTime=360;
        sfx.reward();
        floatingTexts.push({x:p.x,y:p.y-20,text:'⭐ ULTIMATE!',color:'#ffd700',life:1.5,vy:-1.5});
        screenShake = 8;
      }
      else { puTimer=480; puMaxTime=480; sfx.magnet(); }
      const pCol = p.type==='ultimate'?'#cc44ff':p.type==='shield'?'#44ff88':p.type==='speed'?'#00ccff':'#ffdd00';
      spawnP(p.x,p.y,pCol,20); p.alpha=0;
    }
  });

  // Heart packs
  heartPacks = heartPacks.filter(hp => hp.x > -40 && hp.alpha > 0);
  heartPacks.forEach(hp => { hp.x -= spd; drawHeartPack(hp);
    if(dist(player.x + player.w * .5, player.y + player.h * .5, hp.x, hp.y + Math.sin(hp.bob) * 6) < 28) {
      if(hearts < 3) { hearts++; updateHearts(); }
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

  if(state==='playing') requestAnimationFrame(loop);
  else loopRunning=false;
}

// ── BOOT ─────────────────────────────────────
window.bgX=0; window.frame=0;
curBiome='bridge'; window.curBiome='bridge';
drawBG();
// Auto-start for testing
if (new URLSearchParams(window.location.search).has('autostart')) {
  setTimeout(() => { initAudio(); startGame(); }, 500);
}
