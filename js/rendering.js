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
