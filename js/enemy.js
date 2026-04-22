// ── ENEMIES (multi-type shooting creatures) ──
function spawnEnemy(forceType) {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  let type = forceType;
  if (!type) {
    const rand = Math.random();
    if (gameMode !== 'pro') {
      // Beginner: spawn walker and scorpion much more often
      type = rand < 0.15 ? 'standard' : rand < 0.25 ? 'spinning_robot' : rand < 0.35 ? 'chopper' : rand < 0.65 ? 'walker' : 'scorpion';
    } else {
      type = rand < 0.20 ? 'standard' : rand < 0.40 ? 'spinning_robot' : rand < 0.60 ? 'chopper' : rand < 0.80 ? 'walker' : 'scorpion';
    }
  }
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
  } else if (type === 'walker') {
    // Ground-based tank/walker
    // Scaled up for better visibility and threat
    const h = 48; // 1.5x of 32
    const w = 60; // 1.5x of 40
    const ey = gY - h; // sits right on the ground
    enemies.push({
      type: 'walker', x: W + 40, y: ey, baseY: ey, w: w, h: h,
      hoverAmp: 0, hoverSpeed: 0, hoverPhase: 0, rot: 0, // no hover
      shootTimer: shootInterval * 1.2 + Math.random() * 40, shootInterval: shootInterval * 1.2,
      hp: 30, maxHp: 30, flash: 0, shotCount: 0, fleeing: false // slightly higher HP to match size
    });
  } else if (type === 'scorpion') {
    // Ground-based robotic scorpion
    // Scaled up large for beginner threat
    const h = 55;
    const w = 75;
    const ey = gY - h; // sits right on the ground
    enemies.push({
      type: 'scorpion', x: W + 40, y: ey, baseY: ey, w: w, h: h,
      hoverAmp: 0, hoverSpeed: 0, hoverPhase: 0, rot: 0, // no hover
      shootTimer: shootInterval * 1.5 + Math.random() * 50, shootInterval: shootInterval * 1.5,
      hp: 35, maxHp: 35, flash: 0, shotCount: 0, fleeing: false
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
  } else if (bulletType === 'walker_shell') {
    // Walker: shoots a faster heavy shell slightly upwards towards player
    enemyBullets.push({ x: ex, y: ey, vx: -bulletSpeed * 1.6, vy: -bulletSpeed * 0.2, r: 8, life: 1, btype: 'walker_plasma' });
  } else if (bulletType === 'scorpion_venom') {
    // Scorpion: shoots heavy venom blast upwards/left from its tail
    enemyBullets.push({ x: ex, y: ey - 10, vx: -bulletSpeed * 1.4, vy: -bulletSpeed * 0.4, r: 9, life: 1, btype: 'scorpion_venom' });
  } else {
    const spreadY = (Math.random() - 0.5) * 3.5;
    enemyBullets.push({ x: ex, y: ey, vx: -bulletSpeed, vy: spreadY, r: 7, life: 1, btype: 'demon' });
  }
  sfx.laser();
}

// ── DRAW ENEMIES ─────────────────────────────
function drawEnemyByType(e) {
  if (e.type === 'spinning_robot') drawSpinningRobot(e);
  else if (e.type === 'chopper') drawChopper(e);
  else if (e.type === 'walker') drawWalker(e);
  else if (e.type === 'scorpion') drawScorpion(e);
  else drawStandard(e);
}

// ── GROUND WALKER ──
function drawWalker(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame;
  
  // Scale the drawn graphic to match the collision hitbox
  const scale = e.w / 40; 
  ctx.scale(scale, scale);
  const w = 40, h = 32; // Base drawing proportions

  // Calculations for animations
  const bobbing = Math.abs(Math.sin(t * 0.2)) * 1.5; // Chassis vertical bob
  const treadOffset = (t * 1.5) % 6;                 // Treads moving loop

  // Treads (static on ground)
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.roundRect(2, h - 8, w - 4, 8, 3); ctx.fill();
  
  // Animated tread gears inside clipping mask
  ctx.save(); 
  ctx.beginPath(); ctx.roundRect(2, h - 8, w - 4, 8, 3); ctx.clip();
  ctx.fillStyle = '#444';
  for(let i = 4 - treadOffset; i < w - 4 + 6; i += 6) {
    ctx.beginPath(); ctx.arc(i + 2, h - 4, 2, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Apply bobbing to the rest of the body
  ctx.save();
  ctx.translate(0, -bobbing);

  // Chassis
  ctx.fillStyle = '#2b313b';
  ctx.beginPath(); ctx.moveTo(4, h - 8); ctx.lineTo(w - 4, h - 8);
  ctx.lineTo(w - 6, h - 20); ctx.lineTo(6, h - 20); ctx.closePath(); ctx.fill();
  
  // Turret Base
  ctx.fillStyle = '#dd4400';
  ctx.beginPath(); ctx.arc(w / 2, h - 20, 10, Math.PI, 0); ctx.fill();

  // Cannon (recoils backwards when firing via e.flash)
  const recoil = e.flash > 0 ? 3 : 0;
  ctx.fillStyle = '#8899aa';
  ctx.fillRect(-6 + recoil, h - 26, 16, 5); // pointing left
  
  // Cyber Eye
  ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 8; ctx.fillStyle = '#00ffff';
  ctx.beginPath(); ctx.arc(w / 2 - 4 + recoil * 0.5, h - 24, 2.5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;

  ctx.restore(); // end bobbing
  ctx.restore(); // end walker transform
}

// ── SCORPION MECH ──
function drawScorpion(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 2) * 0.5;
  const t = frame;
  
  // Scale the drawn graphic to match the collision hitbox
  const scaleX = e.w / 75;
  const scaleY = e.h / 55;
  ctx.scale(scaleX, scaleY);
  const w = 75, h = 55; // Base drawing proportions

  // Calculations for animations
  const legCycle = t * 0.2; // Speed of walking legs
  const bobbing = Math.abs(Math.sin(legCycle * 2)) * 2; // Chassis vertical bob
  const tailWhip = Math.sin(t * 0.1) * 0.2; // Tail swaying
  const recoil = e.flash > 0 ? 5 : 0;
  
  // Draw Legs (Scorpion has multiple spindly legs)
  ctx.strokeStyle = '#4a5a68';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  for(let i=0; i<4; i++) {
    // phase offset for alternating leg movements
    const phase = i * Math.PI / 2;
    // Leg root
    const lx = 20 + i * 10;
    const ly = h - 15 - bobbing;
    
    // Knee joint moving
    const kx = lx - 5 + Math.sin(legCycle + phase) * 8;
    const ky = ly - 10 + Math.cos(legCycle + phase) * 5;
    
    // Foot touches ground
    const fx = kx - 10 + Math.sin(legCycle + phase) * 12; // Scuffs backwards
    const fy = h;

    // Background leg (darker)
    ctx.beginPath();
    ctx.strokeStyle = '#2b313b';
    ctx.moveTo(lx, ly); ctx.lineTo(kx + 5, ky - 2); ctx.lineTo(fx + 5, fy); ctx.stroke();

    // Foreground leg
    ctx.beginPath();
    ctx.strokeStyle = '#6a7a88';
    ctx.moveTo(lx, ly); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  }

  // Apply bobbing to the rest of the body
  ctx.save();
  ctx.translate(0, -bobbing);

  // Main Carapace
  ctx.fillStyle = '#222730';
  ctx.beginPath();
  ctx.ellipse(w/2, h - 20, 25, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Armor Plates
  ctx.fillStyle = '#3a4454';
  ctx.beginPath(); ctx.ellipse(w/2 - 5, h - 22, 12, 6, 0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w/2 + 5, h - 22, 12, 6, -0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w/2 + 15, h - 20, 10, 5, -0.4, 0, Math.PI*2); ctx.fill();

  // Head/Pincers
  ctx.fillStyle = '#8899aa';
  ctx.beginPath();
  ctx.moveTo(15, h - 20); ctx.lineTo(5, h - 15); ctx.lineTo(10, h - 25);
  ctx.closePath(); ctx.fill();

  // Eye
  ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff00ff';
  ctx.beginPath(); ctx.arc(18, h - 22, 3, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;

  // Tail (Constructing segment by segment)
  ctx.save();
  ctx.translate(w/2 + 20, h - 20); // Tail root
  
  // Base segment
  ctx.rotate(-0.5 + tailWhip);
  ctx.fillStyle = '#4a5a68'; ctx.beginPath(); ctx.roundRect(-8, -25, 10, 25, 3); ctx.fill();
  ctx.translate(-3, -20);
  
  // Mid segment
  ctx.rotate(-0.8 + tailWhip * 1.2);
  ctx.fillStyle = '#3a4454'; ctx.beginPath(); ctx.roundRect(-6, -20, 8, 20, 2); ctx.fill();
  ctx.translate(-2, -18);
  
  // Stinger segment
  ctx.rotate(-1.0 + tailWhip * 0.5);
  ctx.translate(recoil, 0); // Recoil shifts stinger back
  ctx.fillStyle = '#8899aa'; ctx.beginPath(); ctx.roundRect(-5, -15, 6, 15, 2); ctx.fill();
  
  // Venom Tip
  ctx.translate(-2, -15);
  ctx.fillStyle = '#00ff55'; ctx.shadowColor = '#00ff55'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore(); // end tail
  ctx.restore(); // end bobbing
  ctx.restore(); // end scorpion transform
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
  } else if (b.btype === 'walker_plasma') {
    // Ground Walker High-Velocity Plasma Slug
    ctx.rotate(-angle);
    ctx.shadowColor = '#00ff55'; ctx.shadowBlur = 12 + Math.sin(t * 0.5) * 6;
    
    // Electric trail pulses
    ctx.strokeStyle = '#00ff55'; ctx.lineWidth = 1.5;
    for(let i=0; i<3; i++) {
        const offset = (t * 0.5 + i) % 3;
        ctx.beginPath(); ctx.ellipse(b.r * (offset - 2.5), 0, b.r * 0.3, b.r * 1.2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    
    // Core slug
    const g = ctx.createLinearGradient(b.r * 1.5, 0, -b.r * 1.5, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ccffdd'); g.addColorStop(1, '#00ff55');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.6, b.r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (b.btype === 'scorpion_venom') {
    // Splashing acid venom ball
    ctx.rotate(-angle);
    ctx.shadowColor = '#aaff00'; ctx.shadowBlur = 10;
    
    // Dripping trailing bubbles
    ctx.fillStyle = 'rgba(150, 255, 0, 0.7)';
    for(let i=1; i<=3; i++) {
        const offset = Math.sin(t * 0.3 + i) * 3;
        const trailDist = i * b.r * 0.8;
        ctx.beginPath(); 
        ctx.arc(-trailDist, offset, b.r * (1 - i * 0.2), 0, Math.PI * 2); 
        ctx.fill();
    }
    
    // Core
    ctx.fillStyle = '#ccff00';
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
    
    ctx.shadowBlur = 0;
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
  } else if (b.btype === 'dreadnought_laser') {
    // Redesigned: Inferno Tracking Plasma Javelin
    ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 20 + Math.sin(t * 0.4) * 10;
    
    // Distorted jagged energy trail
    const len = b.r * 4.0;
    ctx.fillStyle = 'rgba(255, 50, 0, 0.8)';
    ctx.beginPath();
    ctx.moveTo(len*0.4, 0); // Tip
    ctx.lineTo(-len*0.8, -b.r * 0.6); // Flared trailing tail top
    ctx.lineTo(-len*0.5, 0); // Tail core center
    ctx.lineTo(-len*0.8, b.r * 0.6); // Flared trailing tail bottom
    ctx.closePath(); ctx.fill();
    
    // Piercing blinding white-hot javelin core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-len*0.1, 0, len*0.4, b.r*0.3, 0, 0, Math.PI*2); ctx.fill();
    
    // Crackling volatile energy arcs
    ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(len*0.4, 0);
    for(let i=1; i<=3; i++) {
        const ax = len*0.4 - len * 0.4 * i;
        const ay = (Math.random() - 0.5) * b.r * 1.5;
        ctx.lineTo(ax, ay);
    }
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  } else if (b.btype === 'void_web') {
    // Void-woven spider orb
    ctx.rotate(-angle);
    ctx.shadowColor = '#cc00ff'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#330066';
    ctx.beginPath(); ctx.arc(0, 0, b.r*1.2, 0, Math.PI*2); ctx.fill();
    
    // Spinning internal void energy
    ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2;
    ctx.save(); ctx.rotate(t * 0.2);
    ctx.beginPath(); ctx.moveTo(-b.r, -b.r); ctx.lineTo(b.r, b.r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.r, -b.r); ctx.lineTo(-b.r, b.r); ctx.stroke();
    ctx.restore();
    
    // White core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, b.r*0.4, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (b.btype === 'celestial_blade') {
    // Gold/White holy sharp blade
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
    const len = b.r * 2.5;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(-len*0.8, -b.r*0.6); ctx.lineTo(-len, 0); ctx.lineTo(-len*0.8, b.r*0.6); ctx.closePath(); ctx.fill();
    
    // central light line
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(len*0.8, 0); ctx.lineTo(-len*0.8, -1); ctx.lineTo(-len*0.8, 1); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (b.btype === 'black_hole') {
    // Gravity spheres warping everything
    ctx.rotate(-angle);
    ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = 20;
    
    // Core
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(0, 0, b.r*0.8, 0, Math.PI*2); ctx.fill();
    
    // Accretion disk
    ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 2;
    ctx.save(); ctx.rotate(-t * 0.1);
    ctx.beginPath(); ctx.ellipse(0, 0, b.r*1.4, b.r*0.4, 0, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function checkCollBullet(b) {
  const px = player.x + 8, py = player.y + 8, pw = player.w - 16, ph = player.h - 16;
  return b.x + b.r > px && b.x - b.r < px + pw && b.y + b.r > py && b.y - b.r < py + ph;
}