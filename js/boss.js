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
  } else if (bossType === 5) {
    // Annihilator at 19000m
    boss = {
      type: 'annihilator', x: W + 150, y: gY * 0.4, targetX: W * 0.6, w: 120, h: 120,
      hp: gameMode === 'pro' ? 320 : 160, maxHp: gameMode === 'pro' ? 320 : 160, phase: 0, shootTimer: 50, shootInterval: gameMode === 'pro' ? 50 : 90, bossIdx: 4,
      entered: false, defeated: false, retreating: false, t: 0, orbitalAngle: 0
    };
  } else if (bossType === 6) {
    // Dreadnought (15,000m)
    boss = {
      type: 'dreadnought', x: W + 200, y: gY * 0.4, targetX: W * 0.65, w: 140, h: 80,
      hp: gameMode === 'pro' ? 400 : 200, maxHp: gameMode === 'pro' ? 400 : 200, phase: 0, shootTimer: 60, shootInterval: gameMode === 'pro' ? 60 : 100, bossIdx: 5,
      entered: false, defeated: false, retreating: false, t: 0
    };
  } else if (bossType === 7) {
    // Voidweaver (25,000m)
    boss = {
      type: 'voidweaver', x: W + 150, y: gY * 0.3, targetX: W * 0.7, w: 130, h: 100,
      hp: gameMode === 'pro' ? 500 : 250, maxHp: gameMode === 'pro' ? 500 : 250, phase: 0, shootTimer: 55, shootInterval: gameMode === 'pro' ? 55 : 95, bossIdx: 6,
      entered: false, defeated: false, retreating: false, t: 0, spinPhase: 0
    };
  } else if (bossType === 8) {
    // Celestial Seraph (35,000m)
    boss = {
      type: 'celestial', x: W + 120, y: gY * 0.35, targetX: W * 0.6, w: 150, h: 150,
      hp: gameMode === 'pro' ? 600 : 300, maxHp: gameMode === 'pro' ? 600 : 300, phase: 0, shootTimer: 45, shootInterval: gameMode === 'pro' ? 45 : 85, bossIdx: 7,
      entered: false, defeated: false, retreating: false, t: 0, wingGlow: 0
    };
    player.missileAmmo += 5; // Care package!
  } else if (bossType === 9) {
    // The Singularity God Engine (50,000m)
    boss = {
      type: 'singularity', x: W + 200, y: gY * 0.4, targetX: W * 0.55, w: 180, h: 180,
      hp: gameMode === 'pro' ? 1000 : 500, maxHp: gameMode === 'pro' ? 1000 : 500, phase: 0, shootTimer: 40, shootInterval: gameMode === 'pro' ? 40 : 70, bossIdx: 8,
      entered: false, defeated: false, retreating: false, t: 0, ringRotation: 0
    };
    player.missileAmmo += 15; // +10 originally, user requested +5 more! (15 total)
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
  // Retreating logic removed — Bosses now explode instantly.
  // Boss no longer drains HP over time — player must physically shoot them to win!
  // boss.hp -= dt * (boss.type === 'annihilator' ? 1.8 : boss.type === 'overlord' ? 1.5 : boss.type === 'warden' ? 1.2 : 1.0);
  // Dynamic vertical movement: Sentinel sweeps aggressively but stays visible
  const gY = canvas.gameH * GROUND_RATIO; // Required for vertical movement calculations
  if (boss.type === 'sentinel' && !boss.retreating) {
    boss.y = (gY * 0.35 + Math.sin(boss.t * 0.015) * gY * 0.3); // Keeps Sentinel within screen bounds
  } else if (boss.type === 'annihilator' && !boss.retreating) {
    boss.y = (gY * 0.45 + Math.sin(boss.t * 0.02) * gY * 0.4); // Huge sweeping vertical hover
    boss.x = boss.targetX + Math.cos(boss.t * 0.01) * 60; // Sweeping horizontal
  } else if (boss.type === 'dreadnought' && !boss.retreating) {
    boss.y = (gY * 0.65 + Math.sin(boss.t * 0.03) * gY * 0.1); // Tank base
  } else if (boss.type === 'voidweaver' && !boss.retreating) {
    boss.y = (gY * 0.3 + Math.sin(boss.t * 0.02) * gY * 0.3); // High sweeping
    boss.x = boss.targetX + Math.sin(boss.t * 0.015) * 80;
  } else if (boss.type === 'celestial' && !boss.retreating) {
    boss.y = (gY * 0.4 + Math.sin(boss.t * 0.04) * 40); // Fast tight bobbing
  } else if (boss.type === 'singularity' && !boss.retreating) {
    boss.y = (gY * 0.4 + Math.sin(boss.t * 0.015) * gY * 0.35); // Majestic sweeping
    boss.x = boss.targetX + Math.sin(boss.t * 0.008) * 100;
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
    } else if (boss.type === 'dreadnought') {
      const bs = gameMode === 'pro' ? 8.0 : 5.5; // Significantly boosted speed
      const dx = player.x - (boss.x - 50);
      const dy = player.y - boss.y;
      const targetAngle = Math.atan2(dy, dx);
      
      // Massive tracking volley: 5 plasma javelins targeting player's precise altitude
      [-0.15, -0.08, 0, 0.08, 0.15].forEach(offset => {
        const angle = targetAngle + offset;
        enemyBullets.push({ x: boss.x - 50, y: boss.y, vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs, r: 16, life: 1, btype: 'dreadnought_laser' });
      });
      sfx.laser();
    } else if (boss.type === 'voidweaver') {
      const bs = gameMode === 'pro' ? 4.5 : 3.0;
      [-0.4, 0, 0.4].forEach(offset => {
        const angle = Math.PI + offset + Math.sin(boss.t * 0.05) * 0.5;
        enemyBullets.push({ x: boss.x - 50, y: boss.y, vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs, r: 16, life: 1, btype: 'void_web' });
      });
      sfx.missileLaunch();
    } else if (boss.type === 'celestial') {
      const bs = gameMode === 'pro' ? 5.0 : 3.5;
      [-0.6, -0.3, 0, 0.3, 0.6].forEach(offset => {
        const angle = Math.PI + offset;
        enemyBullets.push({ x: boss.x - 30, y: boss.y - 20, vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs, r: 10, life: 1, btype: 'celestial_blade' });
      });
      sfx.laser();
    } else if (boss.type === 'singularity') {
      const bs = gameMode === 'pro' ? 6.0 : 4.5;
      for (let i=0; i<8; i++) {
        const angle = Math.PI + (i * 0.2) + Math.cos(boss.t * 0.02) * 1.5;
        enemyBullets.push({ x: boss.x - 60, y: boss.y, vx: Math.cos(angle) * bs, vy: Math.sin(angle) * bs, r: 20, life: 1, btype: 'black_hole' });
      }
      sfx.missileLaunch();
    }
  }
  // Check defeated
  if (boss.hp <= 0) {
    boss.defeated = true;
    const idx = boss.bossIdx !== undefined ? boss.bossIdx : 0;
    bossDefeated[idx] = true;
    sfx.hit(); 
    
    // Massive Explosion
    for (let i = 0; i < 100; i++) {
       spawnP(boss.x + (Math.random()-0.5)*boss.w, boss.y + (Math.random()-0.5)*boss.h, ['#ffaa00', '#ff0000', '#aaaaaa', '#ffffff', '#00f3ff'][i % 5], 4 + Math.random()*5);
    }
    
    const isSingularity = boss.type === 'singularity';
    if (isSingularity) {
      if (typeof window.triggerVictory === 'function') window.triggerVictory();
    } else {
      startMusic(curBiome); // Revert to regular biome music
      banner = { text: '🏆 BOSS DEFEATED! 🏆', timer: 200 }; window.banner = banner;
      runCoins += 25; 
    }
    
    sfx.coin();
    for (let i = 0; i < 40; i++) spawnP(boss.x, boss.y, ['#FFD700', '#ff6600', '#00ffaa', '#ff44cc'][i % 4], 2);
    
    boss = null;
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
  } else if (b.type === 'dreadnought') {
    // DREADNOUGHT TANK (15,000m)
    const scale = 3.0;
    ctx.scale(scale, scale);
    ctx.translate(0, Math.sin(t * 0.1) * 2); // heavy bobbing
    
    // Treads
    ctx.fillStyle = '#111116';
    ctx.fillRect(-22, 10, 44, 8);
    for(let i=-20; i<20; i+=6) {
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.arc(i, 14, 2, 0, Math.PI*2); ctx.fill();
    }
    
    // Heavy Chassis
    const bg = ctx.createLinearGradient(0, -10, 0, 10);
    bg.addColorStop(0, '#552222'); bg.addColorStop(1, '#220000');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-25, 12); ctx.lineTo(-20, -12); ctx.lineTo(20, -12); ctx.lineTo(25, 12); ctx.fill();
    ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 1; ctx.stroke();
    
    // Main Plasma Cannons
    ctx.fillStyle = '#441111';
    ctx.fillRect(-35, -8, 20, 6);
    ctx.fillRect(-35, 4, 20, 6);
    
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#ff2200';
    ctx.beginPath(); ctx.arc(-35, -5, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-35, 7, 3, 0, Math.PI*2); ctx.fill();
    
    // Core Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-10, 0, 4, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

  } else if (b.type === 'voidweaver') {
    // VOID WEAVER (25,000m)
    const scale = 3.0;
    ctx.scale(scale, scale);
    b.spinPhase += 0.05;
    ctx.translate(0, Math.sin(t * 0.1) * 3);
    
    ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 25;
    
    // Rotating geometric spider legs
    ctx.strokeStyle = '#aa00ff'; ctx.lineWidth = 4;
    for(let i=0; i<8; i++){
      const angle = b.spinPhase + i * Math.PI / 4;
      ctx.beginPath(); 
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle)*15, Math.sin(angle)*15);
      ctx.lineTo(Math.cos(angle-0.5)*30, Math.sin(angle-0.5)*30);
      ctx.stroke();
    }
    
    // Dark matter Core
    ctx.fillStyle = '#1a0033';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 5 + Math.sin(t*0.2)*2, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

  } else if (b.type === 'celestial') {
    // CELESTIAL SERAPH (35,000m)
    const scale = 3.5;
    ctx.scale(scale, scale);
    b.wingGlow = Math.abs(Math.sin(t * 0.05));
    ctx.translate(0, Math.sin(t * 0.1) * 2);

    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 20 + b.wingGlow * 15;
    
    // Hardlight Wings
    ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + b.wingGlow * 0.4})`;
    // Top wing
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(15, -40, 40, -10); ctx.quadraticCurveTo(20, -5, 0, 0); ctx.fill();
    // Bottom wing
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(15, 40, 40, 10); ctx.quadraticCurveTo(20, 5, 0, 0); ctx.fill();
    
    // Core Entity
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
    
    // Halo
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-5, -15, 12, 4, -0.2, 0, Math.PI*2); ctx.stroke();
    
    ctx.shadowBlur = 0;

  } else if (b.type === 'singularity') {
    // THE SINGULARITY (FINAL BOSS 50,000m)
    const scale = 4.0;
    ctx.scale(scale, scale);
    b.ringRotation += 0.02;
    ctx.translate(0, Math.sin(t * 0.05) * 4);
    
    // Accretion disk rings
    ctx.lineWidth = 3;
    for(let i=1; i<=4; i++){
      ctx.shadowColor = i%2===0 ? '#ff00ff' : '#00f3ff';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = i%2===0 ? '#ff00ff' : '#00f3ff';
      ctx.save();
      ctx.rotate(b.ringRotation * (i%2===0 ? 1 : -1.5) * i);
      ctx.beginPath(); ctx.ellipse(0, 0, 20 + i*10, 6 + i*2, 0, 0, Math.PI*2); ctx.stroke();
      
      // Floating runes/nodes on the rings
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(20 + i*10, 0, 2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    
    // Black hole core (eats light)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(0, 0, 15 + Math.sin(t*0.2)*2, 0, Math.PI*2); ctx.fill();
    
    // Event horizon rim
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 15 + Math.sin(t*0.2)*2, 0, Math.PI*2); ctx.stroke();
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
  let bossName = '';
  if (boss.type === 'sentinel') bossName = '🎯 SENTINEL TURRET';
  else if (boss.type === 'warden') bossName = '🤖 WARDEN MECH';
  else if (boss.type === 'overlord') bossName = '🚁 OVERLORD GUNSHIP';
  else if (boss.type === 'annihilator') bossName = '👁️ THE ANNIHILATOR';
  else if (boss.type === 'dreadnought') bossName = '🚂 DREADNOUGHT TANK';
  else if (boss.type === 'voidweaver') bossName = '🕸️ VOID WEAVER';
  else if (boss.type === 'celestial') bossName = '✨ CELESTIAL SERAPH';
  else if (boss.type === 'singularity') bossName = '🌌 THE SINGULARITY';
  
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  ctx.shadowColor = barColor; ctx.shadowBlur = 10;
  ctx.fillText(bossName, W / 2, by - 8);
  ctx.shadowBlur = 0;
}