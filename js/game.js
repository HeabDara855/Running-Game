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
let isHolding = false, startClickGuard = false;
let curBiome = 'village'; window.curBiome = curBiome;
let banner = { text: '', timer: 0 }; window.banner = banner;

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
  { id:'village', label:'🏛️ Lab Sector', minDist:0 },
  { id:'forest', label:'🌿 Warehouse', minDist:1000 },
  { id:'city', label:'🏙️ Control Room', minDist:2000 },
  { id:'mountain', label:'⛰️ Reactor', minDist:3000 },
  { id:'ocean', label:'🌊 Hangar', minDist:4000 }
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
let obstacles = [], coins = [], pickups = [], particles = [], missiles = [], missileWarnings = [];
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
  missiles.push({ x:W+50, y, vx:-spd, w:36, h:14, passed:false });
}
function spawnCoinPattern() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const p = Math.floor(Math.random() * 3), bx = W + 60, by = 70 + Math.random() * (gY - 140);
  if (p === 0) { for (let i = 0; i < 6; i++) coins.push({ x:bx+i*38, y:by, collected:false, bob:Math.random()*6.28, r:10, alpha:1 }); }
  else if (p === 1) { for (let i = 0; i < 7; i++) coins.push({ x:bx+i*36, y:by-Math.sin(i/6*Math.PI)*55, collected:false, bob:Math.random()*6.28, r:10, alpha:1 }); }
  else { const dir = Math.random() < .5 ? -1 : 1; for (let i = 0; i < 5; i++) coins.push({ x:bx+i*40, y:by+i*22*dir, collected:false, bob:Math.random()*6.28, r:10, alpha:1 }); }
}
function spawnPickup() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const types = ['shield','speed','magnet'];
  pickups.push({ type:types[Math.floor(Math.random()*3)], x:W+30, y:80+Math.random()*(gY-160), bob:0, alpha:1 });
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
    enemyBullets.push({ x: ex, y: ey, vx: -bulletSpeed * 1.5, vy: 0, r: 4, life: 1, btype: 'laser_beam' });
  } else if (bulletType === 'fireball') {
    // Dragon: shoots downward-left at a fixed angle
    const angle = Math.PI * 0.75 + (Math.random() - 0.5) * 0.3;
    enemyBullets.push({ x: ex, y: ey, vx: Math.cos(angle) * bulletSpeed, vy: Math.sin(angle) * bulletSpeed * 0.6, r: 7, life: 1, btype: 'fireball' });
  } else {
    // Demon: shoots left with a slight random vertical spread (NOT aimed at player)
    const spreadY = (Math.random() - 0.5) * 1.5;
    enemyBullets.push({ x: ex, y: ey, vx: -bulletSpeed, vy: spreadY, r: 4, life: 1, btype: 'demon' });
  }
  sfx.laser();
}

// ── DRAW ENEMIES ─────────────────────────────
function drawEnemyByType(e) {
  if (e.type === 'robot') drawRobot(e);
  else if (e.type === 'dragon') drawDragon(e);
  else drawDemon(e);
}
function drawDemon(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash*2)*0.5;
  const wf = Math.sin(frame*0.3)*6;
  // Wings - red
  ctx.fillStyle='#cc2222';
  ctx.beginPath(); ctx.moveTo(-14,-2); ctx.quadraticCurveTo(-22,-12+wf,-10,-6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14,-2); ctx.quadraticCurveTo(22,-12+wf,10,-6); ctx.closePath(); ctx.fill();
  // Body - red gradient
  const bg=ctx.createRadialGradient(-2,-2,2,0,0,14);
  bg.addColorStop(0,'#ff4444'); bg.addColorStop(0.6,'#cc1122'); bg.addColorStop(1,'#661111');
  ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle='#ffff00';
  ctx.beginPath(); ctx.arc(-5,-3,3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(5,-3,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.arc(-5,-4,1.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(5,-4,1.3,0,Math.PI*2); ctx.fill();
  // Angry brows
  ctx.strokeStyle='#661111'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-8,-8); ctx.lineTo(-3,-6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,-8); ctx.lineTo(3,-6); ctx.stroke();
  // Red glow
  ctx.globalAlpha=0.15+0.1*Math.sin(frame*0.1);
  const gw=ctx.createRadialGradient(0,0,0,0,0,22);
  gw.addColorStop(0,'#ff2222'); gw.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawRobot(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash*2)*0.5;
  // Legs (walking)
  e.walkFrame = (e.walkFrame||0) + 0.15;
  const legL = Math.sin(e.walkFrame)*6, legR = Math.sin(e.walkFrame+Math.PI)*6;
  ctx.strokeStyle='#556677'; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-8,16); ctx.lineTo(-8+legL,28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,16); ctx.lineTo(8+legR,28); ctx.stroke();
  // Feet
  ctx.fillStyle='#445566';
  ctx.fillRect(-12+legL,26,8,4); ctx.fillRect(4+legR,26,8,4);
  // Body - red-tinted metal
  const rbg=ctx.createLinearGradient(-14,-18,14,18);
  rbg.addColorStop(0,'#885555'); rbg.addColorStop(0.5,'#aa6666'); rbg.addColorStop(1,'#774444');
  ctx.fillStyle=rbg;
  ctx.beginPath();
  ctx.moveTo(-14,-10); ctx.lineTo(-12,-20); ctx.lineTo(12,-20); ctx.lineTo(14,-10);
  ctx.lineTo(16,14); ctx.lineTo(-16,14); ctx.closePath(); ctx.fill();
  // Panel lines
  ctx.strokeStyle='#44556688'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-10,-5); ctx.lineTo(10,-5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10,5); ctx.lineTo(10,5); ctx.stroke();
  // Chest light
  const cl = Math.sin(frame*0.15)*0.4+0.6;
  ctx.fillStyle=`rgba(255,50,50,${cl})`; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=`rgba(255,100,100,${cl*0.5})`; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
  // Head
  ctx.fillStyle='#778899';
  ctx.fillRect(-10,-28,20,10);
  ctx.fillStyle='#889aab';
  ctx.fillRect(-8,-26,16,6);
  // Antenna
  ctx.strokeStyle='#99aabb'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,-28); ctx.lineTo(0,-34); ctx.stroke();
  ctx.fillStyle=`rgba(255,0,0,${0.5+Math.sin(frame*0.2)*0.5})`;
  ctx.beginPath(); ctx.arc(0,-35,3,0,Math.PI*2); ctx.fill();
  // Eyes (LED)
  ctx.fillStyle='#ff3300'; ctx.shadowColor='#ff3300'; ctx.shadowBlur=6;
  ctx.fillRect(-7,-25,5,3);
  ctx.fillRect(2,-25,5,3);
  ctx.shadowBlur=0;
  // Arms
  ctx.strokeStyle='#667788'; ctx.lineWidth=3;
  const armAng = Math.sin(frame*0.08)*0.3;
  ctx.save(); ctx.translate(-16,0); ctx.rotate(-0.4+armAng);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8,14); ctx.stroke();
  ctx.fillStyle='#556677'; ctx.fillRect(-10,12,6,6); ctx.restore();
  ctx.save(); ctx.translate(16,0); ctx.rotate(0.4-armAng);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(8,14); ctx.stroke();
  // Gun arm
  ctx.fillStyle='#445566'; ctx.fillRect(4,10,12,5);
  ctx.fillStyle='#ff3300'; ctx.fillRect(14,11,4,3);
  ctx.restore();
  // Glow
  ctx.globalAlpha=0.1;
  const rg=ctx.createRadialGradient(0,0,0,0,0,30);
  rg.addColorStop(0,'rgba(255,50,50,0.3)'); rg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawDragon(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash*2)*0.5;
  e.wingFrame = (e.wingFrame||0) + 0.08;
  const wf = Math.sin(e.wingFrame)*12;
  // Wings
  ctx.fillStyle='#884422';
  ctx.beginPath(); ctx.moveTo(-10,-4); ctx.quadraticCurveTo(-35,-20+wf,-20,-4);
  ctx.quadraticCurveTo(-30,-10+wf*0.5,-10,0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10,-4); ctx.quadraticCurveTo(35,-20+wf,20,-4);
  ctx.quadraticCurveTo(30,-10+wf*0.5,10,0); ctx.closePath(); ctx.fill();
  // Wing membrane
  ctx.fillStyle='rgba(200,100,50,0.3)';
  ctx.beginPath(); ctx.moveTo(-10,-2); ctx.quadraticCurveTo(-28,-15+wf,-18,-2);
  ctx.quadraticCurveTo(-25,-8+wf*0.5,-10,2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10,-2); ctx.quadraticCurveTo(28,-15+wf,18,-2);
  ctx.quadraticCurveTo(25,-8+wf*0.5,10,2); ctx.closePath(); ctx.fill();
  // Body
  const dbg=ctx.createRadialGradient(-4,-2,3,0,0,18);
  dbg.addColorStop(0,'#dd3322'); dbg.addColorStop(0.5,'#bb2211'); dbg.addColorStop(1,'#771100');
  ctx.fillStyle=dbg;
  ctx.beginPath(); ctx.ellipse(0,0,20,14,0,0,Math.PI*2); ctx.fill();
  // Belly scales
  ctx.fillStyle='#cc8844';
  ctx.beginPath(); ctx.ellipse(0,4,10,7,0,0,Math.PI); ctx.fill();
  // Neck & head
  ctx.fillStyle='#aa4422';
  ctx.beginPath(); ctx.moveTo(-18,-6); ctx.quadraticCurveTo(-26,-10,-28,-6);
  ctx.lineTo(-30,-4); ctx.quadraticCurveTo(-26,0,-18,0); ctx.closePath(); ctx.fill();
  // Head
  ctx.fillStyle='#bb5533';
  ctx.beginPath(); ctx.ellipse(-30,-4,8,6,0.1,0,Math.PI*2); ctx.fill();
  // Horns
  ctx.fillStyle='#663311';
  ctx.beginPath(); ctx.moveTo(-32,-9); ctx.lineTo(-36,-16); ctx.lineTo(-30,-8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-28,-9); ctx.lineTo(-30,-15); ctx.lineTo(-26,-8); ctx.closePath(); ctx.fill();
  // Eye
  ctx.fillStyle='#ffcc00';
  ctx.beginPath(); ctx.arc(-33,-4,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#331100';
  ctx.beginPath(); ctx.arc(-33,-4,1.5,0,Math.PI*2); ctx.fill();
  // Nostril smoke
  if (frame%8 < 4) {
    ctx.globalAlpha=0.3; ctx.fillStyle='#ff6600';
    ctx.beginPath(); ctx.arc(-38,-2+Math.random()*2,2+Math.random()*2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
  // Tail
  ctx.strokeStyle='#993322'; ctx.lineWidth=4; ctx.lineCap='round';
  const tailWave=Math.sin(frame*0.05)*8;
  ctx.beginPath(); ctx.moveTo(18,0);
  ctx.quadraticCurveTo(28,tailWave,36,-2+tailWave*0.5);
  ctx.stroke();
  // Tail tip
  ctx.fillStyle='#cc4411';
  ctx.beginPath(); ctx.moveTo(36,-2+tailWave*0.5); ctx.lineTo(42,-6+tailWave*0.5);
  ctx.lineTo(40,2+tailWave*0.5); ctx.closePath(); ctx.fill();
  // Fire glow
  ctx.globalAlpha=0.12+0.08*Math.sin(frame*0.15);
  const fg=ctx.createRadialGradient(0,0,0,0,0,32);
  fg.addColorStop(0,'rgba(255,100,0,0.4)'); fg.addColorStop(1,'rgba(255,50,0,0)');
  ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(0,0,32,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ── DRAW ENEMY BULLETS ───────────────────────
function drawEnemyBullet(b) {
  ctx.save(); ctx.globalAlpha = b.life;
  if (b.btype === 'laser_beam') {
    // Robot red laser
    const lg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*2);
    lg.addColorStop(0,'rgba(255,80,80,0.8)'); lg.addColorStop(1,'rgba(255,0,0,0)');
    ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(b.x,b.y,b.r*2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff4444'; ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r*1.8,b.r*0.6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffcccc'; ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r*0.8,b.r*0.3,0,0,Math.PI*2); ctx.fill();
  } else if (b.btype === 'fireball') {
    // Dragon fireball
    const fg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*2.5);
    fg.addColorStop(0,'rgba(255,200,50,0.8)'); fg.addColorStop(0.4,'rgba(255,100,0,0.6)'); fg.addColorStop(1,'rgba(200,50,0,0)');
    ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(b.x,b.y,b.r*2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffcc33'; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff8e0'; ctx.beginPath(); ctx.arc(b.x-1,b.y-1,b.r*0.4,0,Math.PI*2); ctx.fill();
  } else {
    // Demon purple bolt
    const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*2.5);
    g.addColorStop(0,'rgba(200,50,255,0.6)'); g.addColorStop(1,'rgba(100,0,200,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,b.r*2.5,0,Math.PI*2); ctx.fill();
    const c=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
    c.addColorStop(0,'#fff'); c.addColorStop(0.4,'#ee66ff'); c.addColorStop(1,'#9922cc');
    ctx.fillStyle=c; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
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
    puIconEl.textContent = activePU==='shield'?'🛡️':activePU==='speed'?'⚡':'🧲';
  } else puBarEl.classList.add('hidden');
}

// ── DRAW PLAYER ──────────────────────────────
function drawPlayer() {
  const px = player.x, py = player.y, t = frame;
  player.scarf += 0.18;
  player.trail.push({ x:px, y:py, life:1 });
  if (player.trail.length > 12) player.trail.shift();
  // Trail
  player.trail.forEach(tr => { tr.life -= 0.09; if (tr.life <= 0) return;
    ctx.save(); ctx.globalAlpha = tr.life * 0.15; ctx.fillStyle = shieldActive ? '#44ff88' : '#ffaa44';
    ctx.beginPath(); ctx.ellipse(tr.x+player.w*.5, tr.y+player.h*.5, player.w*.2*tr.life, player.h*.15*tr.life, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  });
  ctx.save(); ctx.translate(px+player.w*.5, py+player.h*.5);
  const tilt = Math.max(-0.2, Math.min(0.2, player.vy * 0.02)); ctx.rotate(tilt);
  if (invincible > 0 && Math.floor(invincible/4)%2===0) { ctx.restore(); return; }
  // Shield bubble
  if (shieldActive) { ctx.save(); ctx.globalAlpha=.2+.1*Math.sin(t*.1); ctx.strokeStyle='#44ff88'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=.06; ctx.fillStyle='#44ff88'; ctx.fill(); ctx.restore(); }

  // ── JETPACK (on back) ──
  ctx.save();
  ctx.fillStyle='#444'; ctx.fillRect(-player.w*.5,-4,10,22);
  ctx.fillStyle='#555'; ctx.fillRect(-player.w*.5+1,0,8,16);
  // Jetpack detail
  ctx.fillStyle='#00bbff'; ctx.fillRect(-player.w*.5+3,4,4,3);
  ctx.restore();

  // ── JETPACK FLAMES ──
  if (isHolding && state==='playing' && !player.onGround) {
    ctx.save();
    const fH = 16 + Math.random() * 12, fx = -player.w*.44, fy = 20;
    const fg = ctx.createLinearGradient(fx, fy, fx, fy + fH);
    fg.addColorStop(0, '#fff'); fg.addColorStop(.15, '#88ddff'); fg.addColorStop(.4, '#ff8800'); fg.addColorStop(.7, '#ff4400'); fg.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(fx - 5, fy); ctx.quadraticCurveTo(fx + Math.random()*4 - 2, fy + fH*.6, fx, fy + fH);
    ctx.quadraticCurveTo(fx + Math.random()*4, fy + fH*.6, fx + 7, fy); ctx.closePath(); ctx.fill();
    ctx.restore();
    if(frame%2===0) spawnP(px + player.w*.1, py + player.h*.8, '#ffaa00', 1);
  }

  // ── LEGS (blue-grey pants + boots) ──
  if(player.onGround) {
    player.runFrame += .22;
    const lL = Math.sin(player.runFrame) * 10, lR = Math.sin(player.runFrame + Math.PI) * 10;
    // Left leg
    ctx.save(); ctx.strokeStyle='#3a5060'; ctx.lineWidth=6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(-6 + lL, 24); ctx.stroke(); ctx.restore();
    // Left boot
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(-10 + lL, 22, 10, 5);
    // Right leg
    ctx.save(); ctx.strokeStyle='#3a5060'; ctx.lineWidth=6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(6, 12); ctx.lineTo(6 + lR, 24); ctx.stroke(); ctx.restore();
    // Right boot
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(-2 + lR, 22, 10, 5);
  } else {
    const d2 = Math.sin(frame * .08) * 4;
    // Legs in air
    ctx.save(); ctx.strokeStyle='#3a5060'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(-8 + d2, 23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(8 - d2, 23); ctx.stroke(); ctx.restore();
    // Boots
    ctx.fillStyle='#2a2a2a';
    ctx.fillRect(-12 + d2, 21, 9, 4);
    ctx.fillRect(4 - d2, 21, 9, 4);
  }

  // ── TORSO (white tank top) ──
  ctx.save();
  const tg = ctx.createLinearGradient(-10, -12, 10, 12);
  tg.addColorStop(0, '#f0f0f0'); tg.addColorStop(0.5, '#e0e0e0'); tg.addColorStop(1, '#cccccc');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-12, -8); ctx.lineTo(-10, -14); ctx.lineTo(10, -14); ctx.lineTo(12, -8);
  ctx.lineTo(13, 13); ctx.lineTo(-13, 13); ctx.closePath(); ctx.fill();
  // Tank top straps
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(-7, -18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -14); ctx.lineTo(7, -18); ctx.stroke();
  // Belt
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-13, 10, 26, 4);
  ctx.fillStyle = '#ccaa22'; ctx.fillRect(-3, 10, 6, 4); // Belt buckle
  ctx.restore();

  // ── ARMS (skin tone + red bandana ties) ──
  const armSwing = player.onGround ? Math.sin(player.runFrame * 0.5) * 0.2 : Math.sin(frame * 0.05) * 0.1;
  // Back arm (left)
  ctx.save(); ctx.translate(-13, -6); ctx.rotate(-0.3 + armSwing);
  // Shoulder
  ctx.fillStyle = '#d4956a';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  // Upper arm
  ctx.fillStyle = '#cc8855'; ctx.fillRect(-3, 0, 7, 14);
  // Forearm
  ctx.fillStyle = '#d4956a'; ctx.fillRect(-2, 12, 6, 10);
  // Red bandana tie
  ctx.fillStyle = '#cc2222'; ctx.fillRect(-3, -1, 8, 3);
  ctx.restore();

  // Front arm (right) — holding gun
  ctx.save(); ctx.translate(13, -6); ctx.rotate(0.1 - armSwing * 0.5);
  ctx.fillStyle = '#d4956a';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc8855'; ctx.fillRect(-3, 0, 7, 12);
  ctx.fillStyle = '#d4956a'; ctx.fillRect(-2, 10, 6, 8);
  // Red bandana tie
  ctx.fillStyle = '#cc2222'; ctx.fillRect(-3, -1, 8, 3);
  ctx.restore();

  // ── GUN (big sci-fi blaster) ──
  ctx.save(); ctx.translate(12, 4);
  // Gun body
  const gg = ctx.createLinearGradient(0, -4, 0, 6);
  gg.addColorStop(0, '#556677'); gg.addColorStop(0.5, '#445566'); gg.addColorStop(1, '#334455');
  ctx.fillStyle = gg;
  ctx.fillRect(0, -4, 28, 10);
  // Gun barrel
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(26, -3, 12, 8);
  ctx.fillStyle = '#2a3a4a';
  ctx.fillRect(36, -2, 6, 6);
  // Gun details
  ctx.fillStyle = '#00bbff'; ctx.fillRect(8, -2, 6, 2); // Cyan accent
  ctx.fillStyle = '#775599'; ctx.fillRect(16, -2, 4, 2); // Purple accent
  // Grip
  ctx.fillStyle = '#334'; ctx.fillRect(4, 6, 6, 6);
  // Muzzle flash when holding (firing)
  if (isHolding && state === 'playing') {
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.random() * 0.4;
    const mfg = ctx.createRadialGradient(43, 1, 0, 43, 1, 14);
    mfg.addColorStop(0, '#ffffff'); mfg.addColorStop(0.3, '#88eeff'); mfg.addColorStop(0.6, '#0088cc'); mfg.addColorStop(1, 'rgba(0,100,200,0)');
    ctx.fillStyle = mfg;
    ctx.beginPath(); ctx.arc(43, 1, 14 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
    // Inner flash
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(43, 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // ── HEAD ──
  ctx.save();
  // Neck
  ctx.fillStyle = '#cc8855';
  ctx.fillRect(-4, -18, 8, 6);

  // Head shape
  const hg = ctx.createRadialGradient(-1, -24, 3, 0, -22, 12);
  hg.addColorStop(0, '#ddaa77'); hg.addColorStop(0.7, '#cc8855'); hg.addColorStop(1, '#aa6633');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, -24, 12, 0, Math.PI * 2); ctx.fill();
  // Chin/jaw (make it more square/tough)
  ctx.fillStyle = '#cc8855';
  ctx.beginPath();
  ctx.moveTo(-10, -20); ctx.lineTo(-8, -14); ctx.lineTo(8, -14); ctx.lineTo(10, -20);
  ctx.closePath(); ctx.fill();

  // ── HAIR (brown, swept back) ──
  ctx.fillStyle = '#5a3a1a';
  ctx.beginPath();
  ctx.moveTo(-12, -26); ctx.quadraticCurveTo(-8, -38, 2, -37);
  ctx.quadraticCurveTo(10, -36, 14, -30);
  ctx.quadraticCurveTo(14, -24, 12, -22);
  ctx.lineTo(12, -26); ctx.quadraticCurveTo(6, -30, 0, -30);
  ctx.quadraticCurveTo(-6, -30, -10, -26);
  ctx.closePath(); ctx.fill();
  // Hair highlights
  ctx.fillStyle = 'rgba(120,80,40,0.5)';
  ctx.beginPath();
  ctx.moveTo(-6, -34); ctx.quadraticCurveTo(0, -36, 6, -34);
  ctx.quadraticCurveTo(4, -32, -4, -32);
  ctx.closePath(); ctx.fill();

  // ── RED HEADBAND ──
  ctx.fillStyle = '#cc2222';
  ctx.fillRect(-13, -28, 26, 4);
  // Headband tail (flowing behind)
  ctx.save();
  const hbWave = Math.sin(player.scarf) * 4;
  ctx.strokeStyle = '#cc2222'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-13, -26);
  ctx.quadraticCurveTo(-20, -26 + hbWave, -26, -24 + hbWave * 1.2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-13, -27);
  ctx.quadraticCurveTo(-18, -28 + hbWave * 0.5, -24, -27 + hbWave);
  ctx.stroke();
  ctx.restore();

  // ── EYES (angry/determined) ──
  // White
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-5, -24, 4, 3.5, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, -24, 4, 3.5, 0.1, 0, Math.PI * 2); ctx.fill();
  // Pupils
  ctx.fillStyle = '#1a1a2e';
  const ed = Math.sin(frame * .04) * 1;
  ctx.beginPath(); ctx.arc(-4.5 + ed, -24, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5.5 + ed, -24, 2, 0, Math.PI * 2); ctx.fill();
  // Angry eyebrows
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -29); ctx.lineTo(-2, -27.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9, -29); ctx.lineTo(2, -27.5); ctx.stroke();

  // ── MOUTH (tough grimace) ──
  ctx.strokeStyle = '#884433'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(4, -18); ctx.stroke();

  ctx.restore();

  // Speed aura
  if(activePU==='speed'){ ctx.save(); ctx.globalAlpha=.25+.12*Math.sin(t*.25);
    const sg=ctx.createRadialGradient(0,0,0,0,0,40); sg.addColorStop(0,'rgba(0,200,255,.4)'); sg.addColorStop(1,'rgba(0,100,255,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI*2); ctx.fill(); ctx.restore(); }
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
  // Posts
  ctx.fillStyle='#884444'; ctx.fillRect(ob.x,ob.y-16,ob.w,16); ctx.fillRect(ob.x,ob.y+ob.beamH,ob.w,16);
  ctx.fillStyle='#ffcc00'; ctx.fillRect(ob.x+3,ob.y-4,ob.w-6,4); ctx.fillRect(ob.x+3,ob.y+ob.beamH,ob.w-6,4);
  // Warning
  if(ob.warningTimer>0){ const fl=Math.sin(frame*.3)*.5+.5; ctx.fillStyle=`rgba(255,0,0,${fl*.6})`;
    ctx.beginPath(); ctx.arc(ob.x+ob.w/2,ob.y,5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(ob.x+ob.w/2,ob.y+ob.beamH,5,0,Math.PI*2); ctx.fill(); }
  // Beam
  if(ob.beamOn){ const bg=ctx.createLinearGradient(ob.x,0,ob.x+ob.w,0);
    bg.addColorStop(0,'rgba(255,50,50,.2)'); bg.addColorStop(.4,'rgba(255,50,50,.9)'); bg.addColorStop(.5,'rgba(255,200,200,1)');
    bg.addColorStop(.6,'rgba(255,50,50,.9)'); bg.addColorStop(1,'rgba(255,50,50,.2)');
    ctx.fillStyle=bg; ctx.fillRect(ob.x-2,ob.y,ob.w+4,ob.beamH);
    ctx.globalAlpha=.25; ctx.fillStyle='#ff0000'; ctx.fillRect(ob.x-6,ob.y-3,ob.w+12,ob.beamH+6); }
  ctx.restore();
}
function drawElec(ob) {
  ctx.save();
  const cx=ob.x+ob.w/2;
  ctx.fillStyle='#4466aa'; ctx.beginPath(); ctx.arc(cx,ob.y1,9,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx,ob.y2,9,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#6688cc'; ctx.beginPath(); ctx.arc(cx,ob.y1,5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx,ob.y2,5,0,Math.PI*2); ctx.fill();
  if(ob.on){ ctx.strokeStyle='#88ddff'; ctx.lineWidth=2.5; ctx.globalAlpha=.7+.3*Math.sin(frame*.3);
    for(let a=0;a<3;a++){ ctx.beginPath(); ctx.moveTo(cx,ob.y1);
      for(let s=1;s<=8;s++){ const t2=s/8; ctx.lineTo(cx+(Math.random()-.5)*18*Math.sin(frame*.2+a), ob.y1+(ob.y2-ob.y1)*t2); }
      ctx.stroke(); }
    ctx.globalAlpha=.12; ctx.fillStyle='#00ccff'; ctx.fillRect(cx-12,ob.y1,24,ob.y2-ob.y1); }
  ctx.restore();
}
function drawMissiles() {
  missiles.forEach(m => { ctx.save(); ctx.translate(m.x,m.y);
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.moveTo(m.w,0); ctx.lineTo(0,-m.h/2); ctx.lineTo(-m.w*.3,-m.h/2);
    ctx.lineTo(-m.w*.3,m.h/2); ctx.lineTo(0,m.h/2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cc2200'; ctx.beginPath(); ctx.moveTo(m.w,0); ctx.lineTo(m.w*.6,-m.h*.3); ctx.lineTo(m.w*.6,m.h*.3); ctx.closePath(); ctx.fill();
    // Exhaust
    ctx.fillStyle=`rgba(255,150,0,${.5+Math.random()*.3})`; const eL=10+Math.random()*8;
    ctx.beginPath(); ctx.moveTo(-m.w*.3,-m.h*.3); ctx.lineTo(-m.w*.3-eL,0); ctx.lineTo(-m.w*.3,m.h*.3); ctx.closePath(); ctx.fill();
    ctx.restore(); });
  // Warnings
  missileWarnings.forEach(w => { const W=canvas.gameW;
    ctx.save(); ctx.globalAlpha=.5+.5*Math.sin(frame*.25); ctx.fillStyle='#ff3344'; ctx.font='bold 18px sans-serif';
    ctx.textAlign='right'; ctx.fillText('⚠️🚀', W-10, w.y+6); ctx.restore(); });
}

// ── DRAW COINS & PICKUPS ────────────────────
function drawCoin(c) {
  if(c.collected) return; c.bob+=.08; const cy=c.y+Math.sin(c.bob)*4;
  ctx.save(); ctx.globalAlpha=c.alpha;
  const cg=ctx.createRadialGradient(c.x-3,cy-3,1,c.x,cy,c.r);
  cg.addColorStop(0,'#FFFFC0'); cg.addColorStop(.5,'#FFD700'); cg.addColorStop(1,'#CC8800');
  ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(c.x,cy,c.r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#AA6600'; ctx.font=`bold ${c.r*1.2}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('$',c.x,cy);
  ctx.globalAlpha*=.5; ctx.fillStyle='rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(c.x-3,cy-3,c.r*.35,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawPickup2(p) {
  p.bob+=.07; const py=p.y+Math.sin(p.bob)*5; ctx.save(); ctx.globalAlpha=p.alpha; ctx.translate(p.x,py);
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
    sfx.shieldBreak(); spawnP(player.x+player.w*.5,player.y+player.h*.5,'#44ff88',15); return; }
  hearts--; updateHearts(); invincible=90;
  sfx.hit(); spawnP(player.x+player.w*.5,player.y+player.h*.5,'#FF2200',12);
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
    obstacles=[]; coins=[]; pickups=[]; particles=[]; missiles=[]; missileWarnings=[];
    enemies=[]; enemyBullets=[];
    score=0; distance=0; runCoins=0; frame=0; hearts=3; invincible=0;
    activePU=null; puTimer=0; shieldActive=false; bgX=0;
    graceFrames=60;
    curBiome='village'; window.curBiome='village';
    banner={text:'',timer:0}; window.banner=banner;
    speed=BASE_SPEED; updateHearts(); updateHUD(); updatePUBar();
    for(let i=0;i<3;i++) spawnCoinPattern();
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    state='playing';
    try { startMusic('village'); } catch(e) { console.warn('[KSR] music error:', e); }
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
  const speedMult = activePU==='speed' ? 1.6 : 1;
  speed = (BASE_SPEED + distance * 0.0015) * speedMult;
  const spd = speed * dt;
  bgX += spd;
  distance += spd * 0.1;
  window.bgX = bgX; window.frame = frame;

  drawBG(); drawBanner();

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

  // Spawning (balanced)
  const si = Math.max(55, 120 - distance * 0.025);
  if(frame>80 && frame%Math.floor(si)===0){ const r=Math.random();
    if(r<.3) spawnLaser();
    else if(r<.55) spawnElectric();
    else if(r<.75) spawnMissileWarning();
    else spawnEnemy();
  }
  // Extra obstacles at high distances (less robots)
  if(distance > 500 && frame%Math.floor(si*0.8)===0 && Math.random()<0.12) spawnEnemy('robot');
  if(distance > 500 && frame%Math.floor(si*0.7)===0 && Math.random()<0.25) spawnMissileWarning();
  if(distance > 800 && frame%Math.floor(si*0.9)===0 && Math.random()<0.12) spawnEnemy('dragon');
  if(distance > 1200 && frame%Math.floor(si*0.7)===0 && Math.random()<0.2) spawnEnemy();
  if(frame%40===0) spawnCoinPattern();
  if(frame%350===0) spawnPickup();

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
      else { puTimer=480; puMaxTime=480; sfx.magnet(); }
      spawnP(p.x,p.y,p.type==='shield'?'#44ff88':p.type==='speed'?'#00ccff':'#ffdd00',16); p.alpha=0;
    }
  });

  updateP(); drawPlayer(); updateHUD(); checkBiome();

  if(state==='playing') requestAnimationFrame(loop);
  else loopRunning=false;
}

// ── BOOT ─────────────────────────────────────
window.bgX=0; window.frame=0;
curBiome='village'; window.curBiome='village';
drawBG();
// Auto-start for testing
if (new URLSearchParams(window.location.search).has('autostart')) {
  setTimeout(() => { initAudio(); startGame(); }, 500);
}
