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
    
    // Dynamic breathing vent
    const ventH = 6 + Math.sin(t * 0.4) * 2;
    ctx.fillStyle = `rgba(255,68,0,${0.6 + Math.sin(t * 0.8) * 0.4})`;
    ctx.shadowBlur = 8; ctx.shadowColor = '#ff4400';
    ctx.fillRect(-player.w * .55 + 1, 14 - ventH/2, 4, ventH); 
    ctx.shadowBlur = 0;
    
    // Animated Nozzle
    ctx.fillStyle = '#222'; 
    const nzY = isHolding ? 18 + Math.random() * 2 : 20;
    ctx.fillRect(-player.w * .55 + 2, nzY, 10, 6);
  } else if (jet.id === 'void') {
    // Void Singularity Core
    ctx.translate(-player.w * .5, 5);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    
    // Pulsing core
    const cp = Math.sin(t * 0.15) * 2;
    ctx.fillStyle = '#aa00ff'; ctx.shadowBlur = 10; ctx.shadowColor = '#aa00ff';
    ctx.beginPath(); ctx.arc(0, 0, 8 + cp, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    
    // Multi-axis Orbit rings
    ctx.strokeStyle = `rgba(170,0,255,${0.6 + Math.sin(t * .2) * 0.4})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 4, t * 0.12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 4, -t * 0.08, 0, Math.PI * 2); ctx.stroke();
  } else {
    // Plasma Pack (Default)
    ctx.fillStyle = '#1c1f26'; ctx.fillRect(-player.w * .55, -8, 12, 26);
    ctx.fillStyle = '#2b303a'; ctx.fillRect(-player.w * .55 + 2, -5, 8, 20);
    
    // Animated plasma coil
    const pc = Math.sin(t * 0.5) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(0, 243, 255, ${0.4 + pc * 0.6})`;
    ctx.shadowBlur = 5; ctx.shadowColor = '#00f3ff';
    ctx.fillRect(-player.w * .55 + 1, 8, 2, 6); // glowing accent
    ctx.shadowBlur = 0;
    
    // Animated Nozzles
    const nzW = isHolding ? 10 : 8;
    ctx.fillStyle = '#111'; ctx.fillRect(-player.w * .55 + 2 - (nzW-8)/2, 18, nzW, 5);
  }
  ctx.restore();

  // ── JETPACK FLAMES & EXHAUST ──
  if (isHolding && state === 'playing' && !player.onGround) {
    ctx.save();
    const fx = -player.w * .44, fy = 20;
    if (jet.id === 'dragon') {
      const fH = 25 + Math.random() * 20;
      const w = 8 + Math.random() * 4;
      
      // Outer fire
      const fg = ctx.createLinearGradient(fx, fy, fx, fy + fH);
      fg.addColorStop(0, '#ffff00'); fg.addColorStop(.4, '#ffaa00'); fg.addColorStop(.8, '#ff0000'); fg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); 
      ctx.moveTo(fx - w/2 + 2, fy); 
      ctx.quadraticCurveTo(fx - w, fy + fH/2, fx + Math.sin(t*0.5)*5, fy + fH); 
      ctx.quadraticCurveTo(fx + w, fy + fH/2, fx + w/2 + 2, fy); 
      ctx.fill();
      
      // Inner bright fire
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(fx - 2, fy); ctx.lineTo(fx + Math.sin(t*0.8)*2, fy + fH*0.4); ctx.lineTo(fx + 4, fy); ctx.fill();
      
      if (frame % 2 === 0) spawnP(px + player.w * .1, py + player.h * .8, '#ffaa00', 1.5 + Math.random());
    } else if (jet.id === 'void') {
      // Void Singularity Exhaust: Downward ripple rings
      ctx.lineWidth = 3;
      for(let i=0; i<3; i++) {
        const ps = ((frame + i * 5) % 15) / 15;
        const alpha = 0.8 - ps;
        ctx.strokeStyle = `rgba(170,0,255,${Math.max(0, alpha)})`; 
        ctx.beginPath(); ctx.ellipse(fx + 3, fy + ps * 35, 8 + ps * 15, 3 + ps * 8, Math.sin(t * 0.1)*ps, 0, Math.PI * 2); ctx.stroke();
      }
      
      // Central dark matter beam
      const vH = 30 + Math.sin(t * 0.3) * 10;
      const vbg = ctx.createLinearGradient(fx, fy, fx, fy + vH);
      vbg.addColorStop(0, 'rgba(0,0,0,0.8)'); vbg.addColorStop(0.5, 'rgba(170,0,255,0.5)'); vbg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vbg;
      ctx.beginPath(); ctx.moveTo(fx - 2, fy); ctx.lineTo(fx - 4, fy + vH); ctx.lineTo(fx + 8, fy + vH); ctx.lineTo(fx + 6, fy); ctx.fill();
      
      if (frame % 3 === 0) spawnP(px + player.w * .1 + Math.sin(t)*5, py + player.h * .8, '#aa00ff', 1.5);
    } else {
      // Plasma Pack (Default)
      const fH1 = 20 + Math.random() * 10;
      const fH2 = 25 + Math.random() * 15;
      
      ctx.globalCompositeOperation = "screen";
      const pg1 = ctx.createLinearGradient(fx, fy, fx, fy + fH1);
      pg1.addColorStop(0, '#ffffff'); pg1.addColorStop(1, 'rgba(0, 243, 255, 0)');
      ctx.fillStyle = pg1;
      ctx.beginPath(); ctx.ellipse(fx - 1, fy + fH1/2, 4, fH1/2, Math.sin(t*0.6)*0.1, 0, Math.PI * 2); ctx.fill();
      
      const pg2 = ctx.createLinearGradient(fx, fy, fx, fy + fH2);
      pg2.addColorStop(0, '#ffffff'); pg2.addColorStop(1, 'rgba(0, 68, 255, 0)');
      ctx.fillStyle = pg2;
      ctx.beginPath(); ctx.ellipse(fx + 5, fy + fH2/2, 4, fH2/2, Math.sin((t+5)*0.5)*0.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      
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
