// ── BACKGROUND RENDERERS (Jetpack Joyride Industrial Lab Style) ──
// Globals used: canvas, ctx, bgX, frame, curBiome

// ── UTILITY ──
function drawRivet(x, y, r) {
  ctx.fillStyle = '#8090a0';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
}

function drawPipe(x, y1, y2, col, w) {
  const pw = w || 12;
  const pg = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
  pg.addColorStop(0, col || '#556677');
  pg.addColorStop(0.3, 'rgba(180,200,220,0.5)');
  pg.addColorStop(0.5, col || '#556677');
  pg.addColorStop(1, 'rgba(40,50,60,0.8)');
  ctx.fillStyle = pg;
  ctx.fillRect(x - pw / 2, y1, pw, y2 - y1);
  // Joints
  ctx.fillStyle = '#667788';
  ctx.fillRect(x - pw / 2 - 2, y1, pw + 4, 6);
  ctx.fillRect(x - pw / 2 - 2, y2 - 6, pw + 4, 6);
}

function drawMetalPanel(x, y, w, h, baseCol, borderCol) {
  // Panel body
  const pg = ctx.createLinearGradient(x, y, x, y + h);
  pg.addColorStop(0, baseCol || '#5a6a78');
  pg.addColorStop(0.05, 'rgba(200,210,220,0.15)');
  pg.addColorStop(0.5, baseCol || '#5a6a78');
  pg.addColorStop(1, 'rgba(30,40,50,0.3)');
  ctx.fillStyle = pg;
  ctx.fillRect(x, y, w, h);
  // Border
  ctx.strokeStyle = borderCol || '#3a4a58';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // Inner bevel highlight
  ctx.strokeStyle = 'rgba(200,210,220,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h - 3); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + 3);
  ctx.stroke();
}

function drawDoor(x, y, w, h, col) {
  // Door frame
  ctx.fillStyle = '#3a4a50';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  // Door body
  const dg = ctx.createLinearGradient(x, y, x + w, y);
  dg.addColorStop(0, col || '#ccaa22');
  dg.addColorStop(0.5, col || '#eedd44');
  dg.addColorStop(1, col || '#aa8811');
  ctx.fillStyle = dg;
  ctx.fillRect(x, y, w, h);
  // Hazard stripes
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, 10); ctx.clip();
  ctx.fillStyle = '#222';
  for (let s = 0; s < w + 20; s += 16) {
    ctx.beginPath();
    ctx.moveTo(x + s, y); ctx.lineTo(x + s + 8, y);
    ctx.lineTo(x + s + 18, y + 10); ctx.lineTo(x + s + 10, y + 10);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Same at bottom
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y + h - 10, w, 10); ctx.clip();
  ctx.fillStyle = '#222';
  for (let s = 0; s < w + 20; s += 16) {
    ctx.beginPath();
    ctx.moveTo(x + s, y + h - 10); ctx.lineTo(x + s + 8, y + h - 10);
    ctx.lineTo(x + s + 18, y + h); ctx.lineTo(x + s + 10, y + h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Handle
  ctx.fillStyle = '#777';
  ctx.fillRect(x + w * 0.7, y + h * 0.4, 6, h * 0.2);
}

function drawWarningLight(x, y, r) {
  const pulse = Math.sin(frame * 0.15) * 0.4 + 0.6;
  ctx.save();
  ctx.globalAlpha = pulse;
  const lg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  lg.addColorStop(0, 'rgba(255,50,0,0.6)');
  lg.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgb(255,${Math.floor(50 + pulse * 100)},0)`;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,200,0.6)';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── SHARED: Wall & Floor ──
function drawLabWall(W, H, gY, wallCol1, wallCol2, accentCol) {
  // Main wall gradient
  const wg = ctx.createLinearGradient(0, 0, 0, gY);
  wg.addColorStop(0, wallCol1 || '#3a4a58');
  wg.addColorStop(0.3, wallCol2 || '#4a5a68');
  wg.addColorStop(0.7, wallCol2 || '#4a5a68');
  wg.addColorStop(1, wallCol1 || '#3a4a58');
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, W, gY);

  // Horizontal panel seams
  const panelH = 90;
  for (let py = 0; py < gY; py += panelH) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,210,220,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py + 1); ctx.lineTo(W, py + 1); ctx.stroke();
  }

  // Vertical panel seams (scrolling)
  const vSp = 200, vOx = (bgX * 0.95) % vSp;
  for (let vx = -vSp; vx < W + vSp; vx += vSp) {
    const sx = vx - vOx;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, gY); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,210,220,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx + 1, 0); ctx.lineTo(sx + 1, gY); ctx.stroke();
  }

  // Accent stripe (thick horizontal line at ~60% height)
  const stripeY = gY * 0.58;
  ctx.fillStyle = accentCol || '#2a3a48';
  ctx.fillRect(0, stripeY, W, 18);
  ctx.fillStyle = 'rgba(200,220,240,0.08)';
  ctx.fillRect(0, stripeY, W, 2);
}

function drawLabFloor(W, H, gY) {
  const sp = bgX * 0.95;
  const deckH = 14; // Thick wooden deck
  const deckTop = gY - 4;
  const deckBot = deckTop + deckH;

  const palettes = {
    bridge: { // Warm Wood
      sL1: '#5a3a1e', sL2: '#6a4a28', sC1: '#4e321a', sC2: '#5e4228', sX: '#5a3820', sh: '#5a3a20',
      dTop: '#9e7e52', dd1: '#b08e5e', dd2: '#a58555', dd3: '#997848', dd4: '#8a6a3e', dBot: '#7a5a30',
      dHi: '#c0a070', dShad: '#5a4020', dSide1: '#7a5a35', dSide2: '#604828',
      pl: 'rgba(60,40,20,0.4)', pGrain: '#4a3018',
      n1: '#5a4a38', n2: 'rgba(200,180,150,0.3)',
      rp1: '#7a5a35', rp2: '#8a6a45', rb1: '#8a6a40'
    },
    village: { // Antique Stone (matches Angkor)
      sL1: '#444', sL2: '#555', sC1: '#333', sC2: '#4a4a4a', sX: '#303030', sh: '#444',
      dTop: '#999', dd1: '#aaa', dd2: '#888', dd3: '#777', dd4: '#666', dBot: '#555',
      dHi: '#bbb', dShad: '#333', dSide1: '#666', dSide2: '#444',
      pl: 'rgba(0,0,0,0.4)', pGrain: '#444',
      n1: '#222', n2: 'rgba(255,255,255,0.2)',
      rp1: '#777', rp2: '#888', rb1: '#666'
    },
    forest: { // God Valley - Pale Snowy Stone
      sL1: '#637081', sL2: '#7f8c9f', sC1: '#4a5563', sC2: '#5b6a7a', sX: '#4a5563', sh: '#5b6a7a',
      dTop: '#d0d6df', dd1: '#bac3ce', dd2: '#9ba5b3', dd3: '#7d8a98', dd4: '#626f7d', dBot: '#4e5a66',
      dHi: '#e6ebf0', dShad: '#38434f', dSide1: '#5b6a7a', dSide2: '#38434f',
      pl: 'rgba(0,0,0,0.3)', pGrain: '#5b6a7a',
      n1: '#2b333d', n2: 'rgba(255,255,255,0.4)',
      rp1: '#7d8a98', rp2: '#9ba5b3', rb1: '#626f7d'
    },
    city: { // Command Center - Blue Tech
      sL1: '#1f3a52', sL2: '#2a4b69', sC1: '#14293c', sC2: '#1f3c54', sX: '#142a3f', sh: '#203d57',
      dTop: '#8fb4d4', dd1: '#a6c6e3', dd2: '#78a2c4', dd3: '#6a97bb', dd4: '#507e9e', dBot: '#456f8f',
      dHi: '#c6daf0', dShad: '#20394f', dSide1: '#3b5c7a', dSide2: '#20394f',
      pl: 'rgba(30,60,90,0.4)', pGrain: '#5984aa',
      n1: '#193045', n2: 'rgba(255,255,255,0.3)',
      rp1: '#5487af', rp2: '#6e9bc0', rb1: '#416c91'
    },
    mountain: { // Reactor Core - Bright Green/Dark Steel
      sL1: '#212f27', sL2: '#2d4035', sC1: '#17211b', sC2: '#212d26', sX: '#19241e', sh: '#23332a',
      dTop: '#379a51', dd1: '#43b863', dd2: '#2d8442', dd3: '#267339', dd4: '#195227', dBot: '#154520',
      dHi: '#5bed7f', dShad: '#122619', dSide1: '#22402b', dSide2: '#122619',
      pl: 'rgba(0,0,0,0.5)', pGrain: '#1b5e30',
      n1: '#000', n2: 'rgba(100,255,100,0.3)',
      rp1: '#2d8442', rp2: '#379a51', rb1: '#195227'
    },
    ocean: { // Launch Hangar - Red Warning / Rusty
      sL1: '#3f1a1a', sL2: '#522222', sC1: '#2e1212', sC2: '#3d1818', sX: '#2e1212', sh: '#421a1a',
      dTop: '#ba3c3c', dd1: '#d44e4e', dd2: '#a33030', dd3: '#8c2626', dd4: '#6b1919', dBot: '#571313',
      dHi: '#f26868', dShad: '#2e0f0f', dSide1: '#4d1e1e', dSide2: '#2e0f0f',
      pl: 'rgba(0,0,0,0.5)', pGrain: '#5e1b1b',
      n1: '#2e0f0f', n2: 'rgba(255,100,100,0.2)',
      rp1: '#8c2626', rp2: '#a33030', rb1: '#6b1919'
    }
  };
  const pal = palettes[curBiome] || palettes.bridge;

  // ── BRIDGE SECTIONS (separated by gaps) ──
  const secW = 350, gapW = 30, totalW = secW + gapW;
  const secOx = sp % totalW;

  for (let sx = -totalW; sx < W + totalW; sx += totalW) {
    const bx = sx - secOx;

    // ── TRESTLE SUPPORTS UNDERNEATH each section ──
    ctx.save();
    ctx.strokeStyle = pal.sL1; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(bx + 30, deckBot); ctx.lineTo(bx + 60, H); ctx.stroke();
    ctx.strokeStyle = pal.sL2; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(bx + 30, deckBot); ctx.lineTo(bx + 60, H); ctx.stroke();

    ctx.strokeStyle = pal.sL1; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(bx + secW - 30, deckBot); ctx.lineTo(bx + secW - 60, H); ctx.stroke();
    ctx.strokeStyle = pal.sL2; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(bx + secW - 30, deckBot); ctx.lineTo(bx + secW - 60, H); ctx.stroke();

    ctx.strokeStyle = pal.sC1; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(bx + secW * 0.5, deckBot); ctx.lineTo(bx + secW * 0.5, H); ctx.stroke();
    ctx.strokeStyle = pal.sC2; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(bx + secW * 0.5, deckBot); ctx.lineTo(bx + secW * 0.5, H); ctx.stroke();

    ctx.strokeStyle = pal.sX; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx + 50, deckBot + 4); ctx.lineTo(bx + secW - 50, H - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + secW - 50, deckBot + 4); ctx.lineTo(bx + 50, H - 5); ctx.stroke();

    const midY = deckBot + (H - deckBot) * 0.45;
    ctx.fillStyle = pal.sh; ctx.fillRect(bx + 20, midY, secW - 40, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(bx + 20, midY, secW - 40, 1);
    ctx.restore();

    // ── DECK SURFACE ──
    const deckG = ctx.createLinearGradient(0, deckTop, 0, deckBot);
    deckG.addColorStop(0, pal.dTop); deckG.addColorStop(0.1, pal.dd1);
    deckG.addColorStop(0.3, pal.dd2); deckG.addColorStop(0.6, pal.dd3);
    deckG.addColorStop(0.85, pal.dd4); deckG.addColorStop(1, pal.dBot);
    ctx.fillStyle = deckG; ctx.fillRect(bx, deckTop, secW, deckH);

    ctx.fillStyle = pal.dHi; ctx.fillRect(bx, deckTop, secW, 2);
    ctx.fillStyle = pal.dShad; ctx.fillRect(bx, deckBot - 2, secW, 3);
    ctx.fillStyle = pal.dSide1; ctx.fillRect(bx, deckBot - 1, secW, 3);
    ctx.fillStyle = pal.dSide2; ctx.fillRect(bx, deckBot + 2, secW, 1);

    // ── PLANK/PANEL SEAMS ──
    const plankW = 35;
    ctx.strokeStyle = pal.pl; ctx.lineWidth = 1;
    for (let pl = bx + plankW; pl < bx + secW; pl += plankW) {
      ctx.beginPath(); ctx.moveTo(pl, deckTop + 2); ctx.lineTo(pl, deckBot - 2); ctx.stroke();
    }

    ctx.save(); ctx.globalAlpha = 0.2;
    ctx.strokeStyle = pal.pGrain; ctx.lineWidth = 0.5;
    for (let gy = deckTop + 4; gy < deckBot - 3; gy += 3) {
      ctx.beginPath(); ctx.moveTo(bx + 2, gy); ctx.lineTo(bx + secW - 2, gy); ctx.stroke();
    }
    ctx.restore();

    // ── NAILS/BOLTS ──
    ctx.fillStyle = pal.n1;
    for (let pl = bx + plankW * 0.5; pl < bx + secW; pl += plankW) {
      ctx.beginPath(); ctx.arc(pl, deckTop + 4, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(pl, deckBot - 4, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = pal.n2;
    for (let pl = bx + plankW * 0.5; pl < bx + secW; pl += plankW) {
      ctx.beginPath(); ctx.arc(pl - 0.5, deckTop + 3.5, 0.8, 0, Math.PI * 2); ctx.fill();
    }

    // ── RAILING POSTS & BARS ──
    ctx.fillStyle = pal.rp1;
    ctx.fillRect(bx + 5, deckTop - 18, 5, 20);
    ctx.fillStyle = pal.rp2;
    ctx.fillRect(bx + 4, deckTop - 20, 7, 3);

    ctx.fillStyle = pal.rp1;
    ctx.fillRect(bx + secW - 10, deckTop - 18, 5, 20);
    ctx.fillStyle = pal.rp2;
    ctx.fillRect(bx + secW - 11, deckTop - 20, 7, 3);

    ctx.fillStyle = pal.rp1;
    ctx.fillRect(bx + secW * 0.5 - 2, deckTop - 15, 5, 17);
    ctx.fillStyle = pal.rp2;
    ctx.fillRect(bx + secW * 0.5 - 3, deckTop - 17, 7, 3);

    ctx.fillStyle = pal.rb1;
    ctx.fillRect(bx + 5, deckTop - 16, secW - 10, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(bx + 5, deckTop - 16, secW - 10, 1);
  }
}

const angkorImg = new Image();
angkorImg.src = 'img/angkor.png';

// ── BIOME 1: ANGKOR WAT TEMPLE ──
function drawBG_village() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const sp = bgX * 0.4; // Slower parallax for image

  if (angkorImg.complete && angkorImg.naturalWidth > 0) {
    // Determine scale to fill height up to ground level
    const scale = gY / angkorImg.naturalHeight;
    const drawW = angkorImg.naturalWidth * scale;
    const drawH = gY;

    // Draw tiled mirrored instances horizontally for organic seamless stitching
    const bgOx = sp % drawW;
    for (let i = -drawW - bgOx; i < W + drawW; i += drawW) {
      const tileIdx = Math.floor((i + sp + 10) / drawW);
      const isFlipped = Math.abs(tileIdx % 2) === 1;

      if (isFlipped) {
        ctx.save();
        ctx.translate(i + drawW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(angkorImg, 0, 0, drawW, drawH);
        ctx.restore();
      } else {
        ctx.drawImage(angkorImg, i, 0, drawW, drawH);
      }
    }
  } else {
    // fallback color while loading
    ctx.fillStyle = '#dfa658';
    ctx.fillRect(0, 0, W, gY);
  }

  // Still draw the ground floor so player has a platform
  drawLabFloor(W, H, gY);
}

const ruinsImg = new Image();
ruinsImg.src = 'img/ruins.jpg';

// ── BIOME 2: GOD VALLEY ──
function drawBG_forest() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const t = frame;
  const sp = bgX * 0.4; // Slower parallax for image

  if (ruinsImg && ruinsImg.complete && ruinsImg.naturalWidth > 0) {
    // Determine scale to fill height up to ground level
    const scale = gY / ruinsImg.naturalHeight;
    const drawW = ruinsImg.naturalWidth * scale;
    const drawH = gY;

    // Parallax scrolling offset
    const bgOx = sp % drawW;

    // Tiles horizontally without mirroring to avoid uncany artifacts
    for (let i = -drawW - bgOx; i < W + drawW; i += drawW) {
      const tileIdx = Math.floor((i + sp) / drawW);
      ctx.drawImage(ruinsImg, i, 0, drawW, drawH);

      // ANIMATION 1: God Rays / Light shafts passing through the archways
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 0.02 + tileIdx);

      const archRatio = 0.58; // Arch is approx at 58% horizontally on the original
      const archX = i + drawW * archRatio;
      const rayDir = -1;

      const rayG = ctx.createLinearGradient(archX, 0, archX + 150 * rayDir, gY);
      rayG.addColorStop(0, 'rgba(255,255,255,0.7)');
      rayG.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = rayG;
      ctx.beginPath();
      ctx.moveTo(archX - 60 * rayDir, 40);
      ctx.lineTo(archX + (350 + Math.sin(t * 0.015) * 60) * rayDir, gY);
      ctx.lineTo(archX + (100 - Math.cos(t * 0.01) * 40) * rayDir, gY);
      ctx.lineTo(archX + 150 * rayDir, 40);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // fallback color while loading
    ctx.fillStyle = '#657ea5';
    ctx.fillRect(0, 0, W, gY);
  }

  ctx.save();
  // ANIMATION 2: Drifting Ground Fog / Mist
  const fogSp = 700;
  const fogOx = (bgX * 0.7 + t * 0.5) % fogSp;
  for (let i = -fogSp; i < W + fogSp; i += fogSp) {
    const fx = i - fogOx;
    const fogG = ctx.createRadialGradient(fx + 350, gY - 20, 20, fx + 350, gY - 20, 250);
    fogG.addColorStop(0, 'rgba(215, 225, 240, 0.25)');
    fogG.addColorStop(1, 'rgba(215, 225, 240, 0)');
    ctx.fillStyle = fogG;
    ctx.fillRect(fx, gY - 200, 700, 200);
  }

  // ANIMATION 3: Soft falling snow / magic dust motes
  ctx.fillStyle = '#ffffff';
  for (let p = 0; p < 45; p++) {
    // Pseudo-random deterministic movement
    const pX = ((p * 293 + t * (0.8 + p * 0.02) - bgX * 1.1) % W + W) % W;
    const pY = ((p * 173 + t * (0.4 + p * 0.01) + Math.sin(t * 0.02 + p) * 30) % gY + gY) % gY;
    const pSize = 1.5 + (p % 3);
    const pAlpha = 0.2 + 0.5 * Math.abs(Math.sin((t + p * 20) * 0.03));

    ctx.globalAlpha = pAlpha;
    ctx.beginPath(); ctx.arc(pX, pY, pSize, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Draw the ground floor based on the biome payload
  drawLabFloor(W, H, gY);
}

// ── BIOME 3: COMMAND CENTER (Control Room) ──
function drawBG_city() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  drawLabWall(W, H, gY, '#0e0e25', '#181838', '#060618');
  const t = frame, sp = bgX * 0.95;

  // Large holographic displays
  const dSp = 300, dOx = (sp * 0.7) % dSp;
  for (let i = -dSp; i < W + dSp; i += dSp) {
    const sx = i - dOx, mw = 110, mh = 70, my = gY * 0.08 + (Math.abs(i * 3) % 40);
    // Monitor bezel
    ctx.fillStyle = '#1a1a35'; ctx.fillRect(sx - 6, my - 6, mw + 12, mh + 16);
    ctx.fillStyle = '#222245'; ctx.fillRect(sx - 3, my - 3, mw + 6, mh + 6);
    // Screen
    const sg = ctx.createLinearGradient(sx, my, sx, my + mh);
    sg.addColorStop(0, '#000a1a'); sg.addColorStop(1, '#001122');
    ctx.fillStyle = sg; ctx.fillRect(sx, my, mw, mh);
    // Scanline effect
    ctx.save(); ctx.beginPath(); ctx.rect(sx, my, mw, mh); ctx.clip();
    ctx.globalAlpha = 0.03;
    for (let sl = 0; sl < mh; sl += 2) {
      ctx.fillStyle = '#66aaff'; ctx.fillRect(sx, my + sl, mw, 1);
    }
    // Data content
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#00ff88'; ctx.font = '9px monospace';
    for (let dl = 0; dl < 5; dl++) {
      const val = Math.floor(t * 0.3 + dl * 7 + i) % 9999;
      ctx.fillText(`SYS.${dl}:0x${val.toString(16).padStart(4, '0')}`, sx + 5, my + 12 + dl * 11);
    }
    // Waveform
    ctx.strokeStyle = 'rgba(0,200,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let wx = 0; wx < mw - 4; wx += 2) {
      const wy = my + mh * 0.8 + Math.sin((wx + t * 0.8) * 0.15 + i * 0.01) * 8;
      wx === 0 ? ctx.moveTo(sx + 2 + wx, wy) : ctx.lineTo(sx + 2 + wx, wy);
    }
    ctx.stroke();
    ctx.restore();
    // Status bar under monitor
    ctx.fillStyle = '#0a0a20'; ctx.fillRect(sx, my + mh, mw, 8);
    // Activity LEDs
    for (let l = 0; l < 5; l++) {
      const on = Math.sin(t * 0.1 + l * 1.5 + i) > 0;
      ctx.fillStyle = on ? '#00ff66' : '#003311';
      ctx.beginPath(); ctx.arc(sx + 10 + l * 12, my + mh + 4, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Equipment racks (lower wall)
  const rSp = 340, rOx = (sp * 0.85) % rSp;
  for (let i = -rSp; i < W + rSp; i += rSp) {
    const sx = i - rOx, rw = 100, ry = gY * 0.55, rh = gY * 0.45 - 5;
    // Rack frame
    ctx.fillStyle = '#141430'; ctx.fillRect(sx, ry, rw, rh);
    ctx.strokeStyle = '#2a2a50'; ctx.lineWidth = 2; ctx.strokeRect(sx, ry, rw, rh);
    // Server units (blinking)
    for (let u = 0; u < 5; u++) {
      const uy = ry + 8 + u * (rh / 5 - 2);
      ctx.fillStyle = '#1a1a3a'; ctx.fillRect(sx + 6, uy, rw - 12, rh / 5 - 8);
      ctx.strokeStyle = '#2a2a55'; ctx.lineWidth = 1; ctx.strokeRect(sx + 6, uy, rw - 12, rh / 5 - 8);
      // Blinking LED strip
      for (let l = 0; l < 4; l++) {
        const on = Math.sin(t * 0.15 + l * 2.3 + u + i) > 0.2;
        ctx.fillStyle = on ? (l % 2 === 0 ? '#00ff44' : '#44aaff') : '#0a0a15';
        ctx.beginPath(); ctx.arc(sx + 14 + l * 10, uy + (rh / 5 - 8) / 2, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Blue ambient glow
  ctx.save(); ctx.globalAlpha = 0.06;
  const blg = ctx.createRadialGradient(W * 0.5, gY * 0.4, 0, W * 0.5, gY * 0.4, W * 0.45);
  blg.addColorStop(0, '#2244ff'); blg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = blg; ctx.fillRect(0, 0, W, gY);
  ctx.restore();

  drawLabFloor(W, H, gY, '#0a0a18', '#121228', '#223355');
}

// ── BIOME 4: REACTOR CORE ──
function drawBG_mountain() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  drawLabWall(W, H, gY, '#2a1515', '#3a2020', '#1a0a0a');
  const t = frame, sp = bgX * 0.95;

  // Reactor containment vessels
  const rSp = 380, rOx = (sp * 0.5) % rSp;
  for (let i = -rSp; i < W + rSp; i += rSp) {
    const sx = i - rOx, tw = 70, th = gY * 0.52, ty = gY * 0.15;
    // Containment shell
    const tg = ctx.createLinearGradient(sx, 0, sx + tw, 0);
    tg.addColorStop(0, '#4a5560'); tg.addColorStop(0.2, '#6a7580'); tg.addColorStop(0.4, '#8a9aa5');
    tg.addColorStop(0.6, '#6a7580'); tg.addColorStop(1, '#4a5560');
    ctx.fillStyle = tg; ctx.fillRect(sx, ty, tw, th);
    // Caps
    ctx.fillStyle = '#5a6570'; ctx.fillRect(sx - 6, ty - 10, tw + 12, 14);
    ctx.fillRect(sx - 6, ty + th - 4, tw + 12, 14);
    // Coolant (animated green glow)
    const glow = 0.15 + Math.sin(t * 0.04 + i) * 0.05;
    const gc = ctx.createRadialGradient(sx + tw / 2, ty + th / 2, 0, sx + tw / 2, ty + th / 2, tw * 0.7);
    gc.addColorStop(0, `rgba(0,255,80,${glow + 0.1})`); gc.addColorStop(1, `rgba(0,80,30,${glow * 0.3})`);
    ctx.fillStyle = gc; ctx.fillRect(sx + 4, ty + 4, tw - 8, th - 8);
    // Bubbles
    for (let b = 0; b < 4; b++) {
      const bx = sx + 12 + b * 14;
      const by = ty + th - 15 - Math.abs(Math.sin(t * 0.025 + b * 1.8 + i)) * (th - 30);
      ctx.save(); ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#55ff99';
      ctx.beginPath(); ctx.arc(bx, by, 2 + (b % 2), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Gauge
    ctx.fillStyle = '#333'; ctx.fillRect(sx + tw + 8, ty + 20, 14, 50);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(sx + tw + 8, ty + 20, 14, 50);
    const gaugeH = 30 + Math.sin(t * 0.02 + i) * 15;
    ctx.fillStyle = gaugeH > 35 ? '#ff4422' : '#44ff44';
    ctx.fillRect(sx + tw + 10, ty + 68 - gaugeH, 10, gaugeH);
    // Radiation symbol
    ctx.save(); ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('☢', sx + tw / 2, ty + th + 22);
    ctx.restore();
  }

  // Caution tape
  ctx.save();
  const tapeY = gY * 0.84;
  ctx.beginPath(); ctx.rect(0, tapeY, W, 14); ctx.clip();
  for (let ts = -20 - sp % 24; ts < W + 24; ts += 24) {
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(ts, tapeY, 12, 14);
    ctx.fillStyle = '#222'; ctx.fillRect(ts + 12, tapeY, 12, 14);
  }
  ctx.restore();

  // Red hazard lighting
  ctx.save(); ctx.globalAlpha = 0.04 + Math.sin(t * 0.02) * 0.02;
  const rg = ctx.createRadialGradient(W * 0.5, gY * 0.3, 0, W * 0.5, gY * 0.3, W * 0.5);
  rg.addColorStop(0, '#ff2200'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, gY);
  ctx.restore();

  drawLabFloor(W, H, gY, '#1a0a0a', '#251515', '#663333');
}

// ── BIOME 5: LAUNCH HANGAR ──
function drawBG_ocean() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  drawLabWall(W, H, gY, '#1e2e40', '#283a50', '#0e1e30');
  const t = frame, sp = bgX * 0.95;

  // Massive hangar blast doors
  const hdSp = 520, hdOx = (sp * 0.4) % hdSp;
  for (let i = -hdSp; i < W + hdSp; i += hdSp) {
    const sx = i - hdOx, dw = 220, dh = gY * 0.72, dy = gY * 0.08;
    // Door track
    ctx.fillStyle = '#3a4a5a'; ctx.fillRect(sx - 12, dy - 4, dw + 24, 8);
    // Door panels
    const dpg = ctx.createLinearGradient(0, dy, 0, dy + dh);
    dpg.addColorStop(0, '#3a4a58'); dpg.addColorStop(0.5, '#4a5a68'); dpg.addColorStop(1, '#2a3a48');
    ctx.fillStyle = dpg;
    ctx.fillRect(sx, dy + 4, dw / 2 - 4, dh);
    ctx.fillRect(sx + dw / 2 + 4, dy + 4, dw / 2 - 4, dh);
    // Panel reinforcement lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    for (let dl = 0; dl < 5; dl++) {
      const lny = dy + 15 + dl * (dh / 5);
      ctx.beginPath(); ctx.moveTo(sx + 6, lny); ctx.lineTo(sx + dw / 2 - 10, lny); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + dw / 2 + 10, lny); ctx.lineTo(sx + dw - 6, lny); ctx.stroke();
    }
    // Diagonal braces
    ctx.strokeStyle = 'rgba(100,120,140,0.12)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + 10, dy + 10); ctx.lineTo(sx + dw / 2 - 10, dy + dh - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + dw / 2 + 10, dy + 10); ctx.lineTo(sx + dw - 10, dy + dh - 10); ctx.stroke();
    // Center gap glow
    ctx.save(); ctx.globalAlpha = 0.12 + Math.sin(t * 0.03 + i) * 0.04;
    const cgg = ctx.createLinearGradient(sx + dw / 2 - 20, 0, sx + dw / 2 + 20, 0);
    cgg.addColorStop(0, 'rgba(80,180,255,0)'); cgg.addColorStop(0.5, 'rgba(80,180,255,0.8)');
    cgg.addColorStop(1, 'rgba(80,180,255,0)');
    ctx.fillStyle = cgg; ctx.fillRect(sx + dw / 2 - 20, dy + 4, 40, dh);
    ctx.restore();
    // Door warning stripes (bottom)
    ctx.save();
    ctx.beginPath(); ctx.rect(sx, dy + dh - 12, dw, 12); ctx.clip();
    for (let s = 0; s < dw + 20; s += 16) {
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(sx + s, dy + dh - 12, 8, 12);
      ctx.fillStyle = '#222'; ctx.fillRect(sx + s + 8, dy + dh - 12, 8, 12);
    }
    ctx.restore();
  }

  // Overhead crane system
  ctx.fillStyle = '#4a5a6a'; ctx.fillRect(0, 8, W, 8);
  ctx.fillStyle = 'rgba(180,200,220,0.15)'; ctx.fillRect(0, 8, W, 2);
  // Crane trolley (moving)
  const crX = ((sp * 0.3) % (W + 200)) - 100;
  ctx.fillStyle = '#5a6a7a'; ctx.fillRect(crX - 25, 2, 50, 16);
  ctx.fillStyle = '#6a7a8a'; ctx.fillRect(crX - 18, 18, 5, 35);
  ctx.fillRect(crX + 13, 18, 5, 35);
  // Hook
  ctx.strokeStyle = '#8a9aaa'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(crX, 60, 10, 0, Math.PI); ctx.stroke();
  // Crane status light
  ctx.fillStyle = `rgba(255,200,0,${0.5 + Math.sin(t * 0.1) * 0.3})`;
  ctx.beginPath(); ctx.arc(crX, 6, 3, 0, Math.PI * 2); ctx.fill();

  // High-intensity ceiling lights
  for (let lx = 0; lx < W; lx += 240) {
    const llx = lx - (sp * 0.4) % 240;
    ctx.save(); ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#88bbff';
    ctx.beginPath();
    ctx.moveTo(llx - 50, 0); ctx.lineTo(llx + 50, 0);
    ctx.lineTo(llx + 25, gY * 0.5); ctx.lineTo(llx - 25, gY * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // Light fixture
    ctx.fillStyle = '#7a8a9a'; ctx.fillRect(llx - 30, 0, 60, 6);
    ctx.fillStyle = `rgba(180,220,255,${0.4 + Math.sin(t * 0.04 + lx) * 0.1})`;
    ctx.fillRect(llx - 20, 4, 40, 3);
  }

  drawLabFloor(W, H, gY, '#0e1e30', '#182838', '#335577');
}

// ── BIOME 6: SCI-FI BRIDGE (elevated walkway) ──
function drawBG_bridge() {
  const W = canvas.gameW, H = canvas.gameH, gY = H * GROUND_RATIO;
  const t = frame, sp = bgX * 0.95;

  // Sky gradient (dusk / industrial atmosphere)
  const skyG = ctx.createLinearGradient(0, 0, 0, gY);
  skyG.addColorStop(0, '#0a0e1a'); skyG.addColorStop(0.25, '#141830');
  skyG.addColorStop(0.5, '#1e2545'); skyG.addColorStop(0.75, '#2a3355');
  skyG.addColorStop(1, '#354060');
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);

  // Stars in the sky
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137 + 50) % W + W - (sp * 0.03) % W) % W;
    const sy = ((i * 67 + 20) % (gY * 0.35)) + 5;
    ctx.globalAlpha = 0.2 + (i % 4) * 0.12 + Math.sin(t * 0.015 + i) * 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(sx, sy, 0.6 + (i % 3) * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Distant city silhouette (far background, slow parallax)
  const citySp = sp * 0.08;
  ctx.fillStyle = '#1a2035';
  for (let i = 0; i < 30; i++) {
    const cx = ((i * 120 + 30) % (W + 400)) - 200 - (citySp % (W + 400));
    const bh = 40 + (i * 37 % 80) + (i % 3) * 30;
    const bw = 20 + (i * 23 % 35);
    ctx.fillRect(cx, gY * 0.55 - bh, bw, bh + gY * 0.45);
  }
  // City windows (tiny glowing dots)
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const cx = ((i * 73 + 15) % (W + 400)) - 200 - (citySp % (W + 400));
    const cy = gY * 0.35 + (i * 31 % (gY * 0.5));
    ctx.globalAlpha = 0.15 + Math.sin(t * 0.02 + i * 2) * 0.1;
    ctx.fillStyle = i % 3 === 0 ? '#ffcc44' : i % 5 === 0 ? '#44ccff' : '#ff8844';
    ctx.fillRect(cx, cy, 3, 2);
  }
  ctx.restore();

  // ── USE SHARED WOODEN BRIDGE FLOOR ──
  drawLabFloor(W, H, gY);

  // ── SUSPENSION CABLES (diagonal support wires from tall pylons) ──
  const pylonSp = 600, pylonOx = (sp * 0.7) % pylonSp;
  for (let i = -pylonSp; i < W + pylonSp; i += pylonSp) {
    const px = i - pylonOx;
    // Tall pylon/tower
    const pylG = ctx.createLinearGradient(px - 8, 0, px + 8, 0);
    pylG.addColorStop(0, '#3a4555'); pylG.addColorStop(0.5, '#5a6575');
    pylG.addColorStop(1, '#3a4555');
    ctx.fillStyle = pylG; ctx.fillRect(px - 8, 0, 16, gY);
    // Pylon cross-beams
    ctx.fillStyle = '#4a5565';
    ctx.fillRect(px - 14, gY * 0.15, 28, 5);
    ctx.fillRect(px - 14, gY * 0.4, 28, 5);
    ctx.fillRect(px - 14, gY * 0.65, 28, 5);
    // Red beacon on top
    ctx.fillStyle = `rgba(255,30,30,${0.4 + Math.sin(t * 0.06 + i) * 0.4})`;
    ctx.beginPath(); ctx.arc(px, 8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,50,50,${0.15 + Math.sin(t * 0.06 + i) * 0.15})`;
    ctx.beginPath(); ctx.arc(px, 8, 12, 0, Math.PI * 2); ctx.fill();
    // Suspension cables going to the deck
    ctx.strokeStyle = 'rgba(130,145,160,0.4)'; ctx.lineWidth = 1.5;
    for (let c = -3; c <= 3; c++) {
      if (c === 0) continue;
      ctx.beginPath();
      ctx.moveTo(px, gY * 0.08);
      ctx.lineTo(px + c * 80, gY - 8);
      ctx.stroke();
    }
  }

  // ── ATMOSPHERIC FOG near the bridge ──
  ctx.save();
  ctx.globalAlpha = 0.04 + Math.sin(t * 0.01) * 0.02;
  const fogG = ctx.createLinearGradient(0, gY - 60, 0, gY + 20);
  fogG.addColorStop(0, 'rgba(100,120,150,0)'); fogG.addColorStop(0.5, 'rgba(100,120,150,1)');
  fogG.addColorStop(1, 'rgba(80,100,130,0)');
  ctx.fillStyle = fogG; ctx.fillRect(0, gY - 60, W, 80);
  ctx.restore();

  // Warning lights on deck edges
  const warnSp = 200, warnOx = (sp * 0.95) % warnSp;
  for (let i = -warnSp; i < W + warnSp; i += warnSp) {
    const wx = i - warnOx;
    const pulse = 0.3 + Math.sin(t * 0.08 + i * 0.01) * 0.25;
    ctx.save(); ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffaa22';
    ctx.beginPath(); ctx.arc(wx, gY - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = pulse * 0.3;
    ctx.fillStyle = '#ffaa22';
    ctx.beginPath(); ctx.arc(wx, gY - 3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ── DISPATCHER ──
function drawBG() {
  switch (curBiome) {
    case 'village': drawBG_village(); break;
    case 'forest': drawBG_forest(); break;
    case 'city': drawBG_city(); break;
    case 'mountain': drawBG_mountain(); break;
    case 'ocean': drawBG_ocean(); break;
    case 'bridge': drawBG_bridge(); break;
  }
}

function drawBanner() {
  if (!banner.timer) return;
  banner.timer--;
  const fade = Math.min(1, banner.timer / 25) * Math.min(1, (220 - banner.timer) / 20 + .2);
  if (fade <= 0) return;
  const W = canvas.gameW, H = canvas.gameH; // Strictly use logical dimensions
  ctx.save(); ctx.globalAlpha = fade * .92;
  const bg = ctx.createLinearGradient(0, H * .38, 0, H * .62);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(.2, 'rgba(0,0,0,.82)');
  bg.addColorStop(.8, 'rgba(0,0,0,.82)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, H * .38, W, H * .24);
  ctx.globalAlpha = fade;
  // Font size capped at 48px for 650px total logical height
  const fontSize = Math.min(48, Math.round(H * .08));
  ctx.font = `900 ${fontSize}px "Moul", cursive`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Advanced neon-gold text glow
  ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#FFD700';
  ctx.fillText(banner.text, W / 2, H * .5);
  // High intensity pass
  ctx.shadowBlur = 22;
  ctx.fillText(banner.text, W / 2, H * .5);
  ctx.shadowBlur = 0;
  // Outline
  ctx.strokeStyle = '#8B4000'; ctx.lineWidth = 1;
  ctx.strokeText(banner.text, W / 2, H * .5);
  ctx.restore();
}
