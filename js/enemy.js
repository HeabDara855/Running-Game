// ── ENEMIES (multi-type shooting creatures) ──
function spawnEnemy(forceType) {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const type = forceType || (Math.random() < 0.33 ? 'standard' : Math.random() < 0.66 ? 'spinning_robot' : 'chopper');
  const shootInterval = gameMode === 'pro' ? Math.max(90, 160 - distance * 0.006) : Math.max(240, 360 - distance * 0.001);
  if (type === 'spinning_robot') {
    // Hovers erratically in mid-air
    const ey = gY * 0.45 + Math.random() * (gY * 0.3);
    enemies.push({
      type: 'spinning_robot', x: W + 40, y: ey, baseY: ey, w: 32, h: 32,
      hoverAmp: 30 + Math.random() * 15, hoverSpeed: 0.08 + Math.random() * 0.04,
      hoverPhase: Math.random() * 6.28, rot: 0,
      shootTimer: shootInterval + Math.random() * 60, shootInterval: shootInterval,
      hp: 10, maxHp: 10, flash: 0, shotCount: 0, fleeing: false
    });
  } else if (type === 'chopper') {
    // Flies high near the ceiling
    const ey = 30 + Math.random() * 40;
    enemies.push({
      type: 'chopper', x: W + 60, y: ey, baseY: ey, w: 45, h: 32,
      hoverAmp: 10 + Math.random() * 5, hoverSpeed: 0.015 + Math.random() * 0.01,
      hoverPhase: Math.random() * 6.28, rot: 0,
      shootTimer: shootInterval * 1.3 + Math.random() * 40, shootInterval: shootInterval * 1.3,
      hp: 15, maxHp: 15, flash: 0, shotCount: 0, fleeing: false
    });
  } else {
    // The Standard: Hovers stably at mid-height
    const ey = gY * 0.5 + (Math.random() - 0.5) * 40;
    enemies.push({
      type: 'standard', x: W + 30, y: ey, baseY: ey, w: 26, h: 26,
      hoverAmp: 4 + Math.random() * 2, hoverSpeed: 0.01 + Math.random() * 0.01,
      hoverPhase: Math.random() * 6.28, rot: 0,
      shootTimer: shootInterval + Math.random() * 50, shootInterval,
      hp: 8, maxHp: 8, flash: 0, shotCount: 0, fleeing: false
    });
  }
}
function spawnEnemyBullet(ex, ey, bulletType) {
  const bulletSpeed = gameMode === 'pro' ? 2.8 + distance * 0.0003 : 1.0 + distance * 0.00005;
  if (bulletType === 'laser_beam') {
    // Standard: shoots straight left (very predictable)
    enemyBullets.push({ x: ex, y: ey, vx: -bulletSpeed * 1.5, vy: 0, r: 10, life: 1, btype: 'laser_beam' });
  } else if (bulletType === 'fireball') {
    // Chopper: shoots downward-left at a fixed angle
    const angle = Math.PI * 0.75 + (Math.random() - 0.5) * 0.1;
    enemyBullets.push({ x: ex, y: ey, vx: Math.cos(angle) * bulletSpeed, vy: Math.sin(angle) * bulletSpeed * 0.8, r: 9, life: 1, btype: 'fireball' });
  } else {
    // Spinning Robot: shoots left with an unpredictable spread
    const spreadY = (Math.random() - 0.5) * 3.5;
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