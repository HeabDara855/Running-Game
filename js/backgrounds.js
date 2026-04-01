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

function drawLabFloor(W, H, gY, floorCol1, floorCol2, lineCol) {
  // Floor base
  const fg = ctx.createLinearGradient(0, gY, 0, H);
  fg.addColorStop(0, floorCol1 || '#2a3038');
  fg.addColorStop(0.15, floorCol2 || '#333a42');
  fg.addColorStop(1, '#1a2028');
  ctx.fillStyle = fg;
  ctx.fillRect(0, gY, W, H - gY);

  // ── ROAD / WALKWAY ──
  const roadY = gY + 2;
  const roadH = H - gY - 2;

  // Road surface (smooth dark asphalt)
  const rg = ctx.createLinearGradient(0, roadY, 0, roadY + roadH);
  rg.addColorStop(0, '#3a3a42');
  rg.addColorStop(0.3, '#2e2e36');
  rg.addColorStop(1, '#222228');
  ctx.fillStyle = rg;
  ctx.fillRect(0, roadY, W, roadH);

  // Road edge lines (yellow safety stripes)
  ctx.fillStyle = '#ccaa22';
  ctx.fillRect(0, roadY, W, 3);
  ctx.fillStyle = 'rgba(255,200,0,0.15)';
  ctx.fillRect(0, roadY, W, 1);

  // Center lane dashes (scrolling)
  const dashLen = 30, gapLen = 20, dOx = (bgX * 0.95) % (dashLen + gapLen);
  const centerY = roadY + roadH * 0.45;
  ctx.save();
  ctx.strokeStyle = 'rgba(200,200,50,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([dashLen, gapLen]);
  ctx.lineDashOffset = -dOx;
  ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(W, centerY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Bridge sections (metal plates every ~400px)
  const bSp = 400, bOx = (bgX * 0.95) % bSp;
  for (let bx = -bSp; bx < W + bSp; bx += bSp) {
    const sx = bx - bOx;
    // Bridge plate
    ctx.fillStyle = 'rgba(80,90,100,0.25)';
    ctx.fillRect(sx, roadY + 4, 120, roadH - 6);
    // Plate rivets
    ctx.fillStyle = 'rgba(150,160,170,0.3)';
    for (let r = 0; r < 3; r++) {
      ctx.beginPath(); ctx.arc(sx + 10 + r * 50, roadY + roadH * 0.3, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 10 + r * 50, roadY + roadH * 0.7, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Cross-hatch pattern
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = lineCol || '#667788';
    ctx.lineWidth = 1;
    for (let cx = 0; cx < 120; cx += 12) {
      ctx.beginPath(); ctx.moveTo(sx + cx, roadY + 4); ctx.lineTo(sx + cx + 20, roadY + roadH - 2); ctx.stroke();
    }
    ctx.restore();
  }

  // Guard rail (top)
  ctx.fillStyle = 'rgba(200,210,220,0.12)';
  ctx.fillRect(0, roadY - 1, W, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, roadY + 3, W, 1);

  // Rail posts (scrolling)
  const rpSp = 80, rpOx = (bgX * 0.95) % rpSp;
  ctx.fillStyle = 'rgba(150,160,170,0.15)';
  for (let rp = -rpSp; rp < W + rpSp; rp += rpSp) {
    ctx.fillRect(rp - rpOx, roadY - 2, 3, 6);
  }
}

// ── BIOME 1: LAB (Village replacement) ──
function drawBG_village() {
  const W = canvas.width, H = canvas.height, gY = H * 0.87;
  drawLabWall(W, H, gY, '#3d4d5d', '#4d5d6d', '#2d3d4d');

  // Rivets along seams
  const rSp = 200, rOx = (bgX * 0.95) % rSp;
  for (let rx = -rSp; rx < W + rSp; rx += rSp) {
    const sx = rx - rOx;
    for (let ry = 30; ry < gY; ry += 90) {
      drawRivet(sx - 8, ry, 3);
      drawRivet(sx + 8, ry, 3);
    }
  }

  // Background pipes
  const pSp = 320, pOx = (bgX * 0.3) % pSp;
  for (let px = -pSp; px < W + pSp; px += pSp) {
    drawPipe(px - pOx, 0, gY * 0.45, '#667a55', 10);
    drawPipe(px - pOx + 100, gY * 0.3, gY, '#5a6a7a', 8);
  }

  // Yellow doors (scrolling)
  const dSp = 480, dOx = (bgX * 0.95) % dSp;
  for (let dx = -dSp; dx < W + dSp; dx += dSp) {
    drawDoor(dx - dOx + 60, gY - 130, 70, 125, '#ccaa22');
  }

  // Ceiling lights
  for (let lx = 0; lx < W; lx += 160) {
    const llx = lx - (bgX * 0.95) % 160;
    ctx.fillStyle = 'rgba(200,220,240,0.08)';
    ctx.beginPath();
    ctx.moveTo(llx - 30, 0); ctx.lineTo(llx + 30, 0);
    ctx.lineTo(llx + 15, gY * 0.5); ctx.lineTo(llx - 15, gY * 0.5);
    ctx.closePath(); ctx.fill();
    // Light fixture
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(llx - 20, 0, 40, 6);
    ctx.fillStyle = 'rgba(200,230,255,0.5)';
    ctx.fillRect(llx - 12, 4, 24, 3);
  }

  // Warning lights
  const wlSp = 400, wlOx = (bgX * 0.95) % wlSp;
  for (let wl = -wlSp; wl < W + wlSp; wl += wlSp) {
    drawWarningLight(wl - wlOx + 180, 25, 5);
  }

  drawLabFloor(W, H, gY, '#2d3540', '#353d48', '#556677');
}

// ── BIOME 2: WAREHOUSE (Forest replacement) ──
function drawBG_forest() {
  const W = canvas.width, H = canvas.height, gY = H * 0.87;
  drawLabWall(W, H, gY, '#2a3828', '#3a4838', '#1a2818');

  // Crates & boxes (parallax)
  const cSp = 220, cOx = (bgX * 0.6) % cSp;
  for (let cx = -cSp; cx < W + cSp; cx += cSp) {
    const sx = cx - cOx;
    const cw = 50 + (Math.abs(cx * 7) % 30), ch = 40 + (Math.abs(cx * 3) % 25);
    const cy = gY - ch;
    // Crate
    const cg = ctx.createLinearGradient(sx, cy, sx + cw, cy + ch);
    cg.addColorStop(0, '#6a5a3a'); cg.addColorStop(0.5, '#7a6a4a'); cg.addColorStop(1, '#5a4a2a');
    ctx.fillStyle = cg;
    ctx.fillRect(sx, cy, cw, ch);
    ctx.strokeStyle = '#4a3a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, cy, cw, ch);
    // Cross planks
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx + cw, cy + ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + cw, cy); ctx.lineTo(sx, cy + ch); ctx.stroke();
  }

  // Green pipes with steam
  const gpSp = 280, gpOx = (bgX * 0.4) % gpSp;
  for (let gp = -gpSp; gp < W + gpSp; gp += gpSp) {
    drawPipe(gp - gpOx, 0, gY, '#3a6a3a', 14);
    // Steam
    if (frame % 60 < 30) {
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(frame * 0.1);
      ctx.fillStyle = '#aaddaa';
      for (let s = 0; s < 3; s++) {
        const sy = gY * 0.3 + Math.sin(frame * 0.05 + s) * 15;
        ctx.beginPath(); ctx.arc(gp - gpOx + 10 + s * 6, sy, 4 + s * 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // Vents
  const vSp = 350, vOx2 = (bgX * 0.5) % vSp;
  for (let vx = -vSp; vx < W + vSp; vx += vSp) {
    const sx = vx - vOx2;
    ctx.fillStyle = '#2a3828';
    ctx.fillRect(sx, gY * 0.15, 60, 40);
    ctx.strokeStyle = '#4a5848';
    for (let sl = 0; sl < 6; sl++) {
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx + 5, gY * 0.15 + 5 + sl * 6);
      ctx.lineTo(sx + 55, gY * 0.15 + 5 + sl * 6); ctx.stroke();
    }
  }

  drawLabFloor(W, H, gY, '#1a2818', '#222e20', '#447744');
}

// ── BIOME 3: CONTROL ROOM (City replacement) ──
function drawBG_city() {
  const W = canvas.width, H = canvas.height, gY = H * 0.87;
  drawLabWall(W, H, gY, '#1a1a30', '#252545', '#0a0a20');

  // Monitor screens
  const mSp = 240, mOx = (bgX * 0.7) % mSp;
  for (let mx = -mSp; mx < W + mSp; mx += mSp) {
    const sx = mx - mOx;
    const mw = 80, mh = 50, my = gY * 0.2 + (Math.abs(mx * 3) % 60);
    // Monitor frame
    ctx.fillStyle = '#222240';
    ctx.fillRect(sx - 4, my - 4, mw + 8, mh + 8);
    // Screen
    const sg = ctx.createLinearGradient(sx, my, sx, my + mh);
    sg.addColorStop(0, '#001a33'); sg.addColorStop(1, '#002244');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, my, mw, mh);
    // Screen content (scrolling data)
    ctx.save();
    ctx.beginPath(); ctx.rect(sx, my, mw, mh); ctx.clip();
    ctx.fillStyle = 'rgba(0,255,100,0.6)';
    ctx.font = '8px monospace';
    for (let dl = 0; dl < 5; dl++) {
      const t = Math.floor(frame * 0.5 + dl * 7 + mx) % 999;
      ctx.fillText(`0x${t.toString(16).padStart(4, '0')}`, sx + 4, my + 10 + dl * 9);
    }
    // Waveform
    ctx.strokeStyle = 'rgba(0,200,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let wx = 0; wx < mw; wx += 2) {
      const wy = my + mh * 0.7 + Math.sin((wx + frame) * 0.2 + mx) * 6;
      wx === 0 ? ctx.moveTo(sx + wx, wy) : ctx.lineTo(sx + wx, wy);
    }
    ctx.stroke();
    ctx.restore();
    // Power LED
    ctx.fillStyle = `rgba(0,255,0,${0.5 + 0.5 * Math.sin(frame * 0.1 + mx)})`;
    ctx.beginPath(); ctx.arc(sx + mw - 6, my + mh + 2, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Control panels on lower wall
  const cpSp = 300, cpOx = (bgX * 0.9) % cpSp;
  for (let cp = -cpSp; cp < W + cpSp; cp += cpSp) {
    const sx = cp - cpOx;
    drawMetalPanel(sx, gY * 0.6, 120, gY * 0.4, '#2a2a45', '#1a1a35');
    // Buttons
    const bCols = ['#ff3333', '#33ff33', '#3366ff', '#ffaa00'];
    for (let b = 0; b < 4; b++) {
      const bx = sx + 15 + b * 25, by = gY * 0.7;
      ctx.fillStyle = bCols[b];
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(bx - 1, by - 1, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Sliders
    for (let s = 0; s < 3; s++) {
      const slx = sx + 10 + s * 38, sly = gY * 0.78;
      ctx.fillStyle = '#111';
      ctx.fillRect(slx, sly, 4, 30);
      ctx.fillStyle = '#888';
      const sh = 8 + Math.sin(frame * 0.03 + s) * 10;
      ctx.fillRect(slx - 3, sly + sh, 10, 6);
    }
  }

  // Blue accent lighting
  ctx.save();
  ctx.globalAlpha = 0.04;
  const blg = ctx.createRadialGradient(W * 0.5, gY * 0.5, 0, W * 0.5, gY * 0.5, W * 0.4);
  blg.addColorStop(0, '#4466ff'); blg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = blg;
  ctx.fillRect(0, 0, W, gY);
  ctx.restore();

  drawLabFloor(W, H, gY, '#0f0f20', '#181830', '#334466');
}

// ── BIOME 4: REACTOR (Mountain replacement) ──
function drawBG_mountain() {
  const W = canvas.width, H = canvas.height, gY = H * 0.87;
  drawLabWall(W, H, gY, '#3a2020', '#4a2828', '#2a1515');

  // Large reactor tanks
  const tSp = 400, tOx = (bgX * 0.5) % tSp;
  for (let tx = -tSp; tx < W + tSp; tx += tSp) {
    const sx = tx - tOx;
    const tw = 80, th = gY * 0.5;
    // Tank body
    const tg = ctx.createLinearGradient(sx, gY * 0.2, sx + tw, gY * 0.2);
    tg.addColorStop(0, '#556677'); tg.addColorStop(0.3, '#8899aa'); tg.addColorStop(0.5, '#aabbcc');
    tg.addColorStop(0.7, '#8899aa'); tg.addColorStop(1, '#556677');
    ctx.fillStyle = tg;
    ctx.fillRect(sx, gY * 0.2, tw, th);
    // Tank top/bottom caps
    ctx.fillStyle = '#667788';
    ctx.fillRect(sx - 5, gY * 0.2 - 8, tw + 10, 12);
    ctx.fillRect(sx - 5, gY * 0.2 + th - 4, tw + 10, 12);
    // Glowing content
    const gc = ctx.createRadialGradient(sx + tw / 2, gY * 0.2 + th / 2, 0, sx + tw / 2, gY * 0.2 + th / 2, tw * 0.6);
    gc.addColorStop(0, 'rgba(0,255,100,0.2)');
    gc.addColorStop(1, 'rgba(0,100,50,0.05)');
    ctx.fillStyle = gc;
    ctx.fillRect(sx + 5, gY * 0.2 + 5, tw - 10, th - 10);
    // Bubbles
    for (let b = 0; b < 3; b++) {
      const bx = sx + 15 + b * 20, by = gY * 0.2 + th * 0.3 + Math.sin(frame * 0.04 + b * 2) * th * 0.2;
      ctx.save(); ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#44ff88';
      ctx.beginPath(); ctx.arc(bx, by, 3 + b, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Warning sign
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠', sx + tw / 2, gY * 0.2 + th + 20);
  }

  // Red warning lights
  const rlSp = 250, rlOx = (bgX * 0.8) % rlSp;
  for (let rl = -rlSp; rl < W + rlSp; rl += rlSp) {
    drawWarningLight(rl - rlOx, 20, 6);
  }

  // Caution tape stripe
  ctx.save();
  const tapeY = gY * 0.85;
  ctx.beginPath(); ctx.rect(0, tapeY, W, 12); ctx.clip();
  for (let ts = -20 - (bgX * 0.95) % 24; ts < W + 24; ts += 24) {
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(ts, tapeY, 12, 12);
    ctx.fillStyle = '#222';
    ctx.fillRect(ts + 12, tapeY, 12, 12);
  }
  ctx.restore();

  drawLabFloor(W, H, gY, '#2a1515', '#321a1a', '#884444');
}

// ── BIOME 5: HANGAR (Ocean replacement) ──
function drawBG_ocean() {
  const W = canvas.width, H = canvas.height, gY = H * 0.87;
  drawLabWall(W, H, gY, '#2a3545', '#354560', '#1a2535');

  // Large hangar doors (background)
  const hdSp = 500, hdOx = (bgX * 0.4) % hdSp;
  for (let hd = -hdSp; hd < W + hdSp; hd += hdSp) {
    const sx = hd - hdOx;
    const dw = 200, dh = gY * 0.7;
    // Door track
    ctx.fillStyle = '#3a4a5a';
    ctx.fillRect(sx - 10, gY * 0.1, dw + 20, 8);
    // Door panels
    ctx.fillStyle = '#4a5a6a';
    ctx.fillRect(sx, gY * 0.1 + 8, dw / 2 - 3, dh);
    ctx.fillRect(sx + dw / 2 + 3, gY * 0.1 + 8, dw / 2 - 3, dh);
    // Door detail lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let dl = 0; dl < 4; dl++) {
      const dy = gY * 0.1 + 20 + dl * (dh / 4);
      ctx.beginPath(); ctx.moveTo(sx + 5, dy); ctx.lineTo(sx + dw / 2 - 8, dy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + dw / 2 + 8, dy); ctx.lineTo(sx + dw - 5, dy); ctx.stroke();
    }
    // Center gap glow
    ctx.save();
    ctx.globalAlpha = 0.15;
    const gg = ctx.createLinearGradient(sx + dw / 2 - 15, 0, sx + dw / 2 + 15, 0);
    gg.addColorStop(0, 'rgba(100,200,255,0)');
    gg.addColorStop(0.5, 'rgba(100,200,255,0.8)');
    gg.addColorStop(1, 'rgba(100,200,255,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(sx + dw / 2 - 15, gY * 0.1 + 8, 30, dh);
    ctx.restore();
  }

  // Overhead crane rail
  ctx.fillStyle = '#556677';
  ctx.fillRect(0, 12, W, 6);
  ctx.fillStyle = 'rgba(200,210,220,0.15)';
  ctx.fillRect(0, 12, W, 2);
  // Crane trolley
  const craneX = ((bgX * 0.3) % (W + 200)) - 100;
  ctx.fillStyle = '#667788';
  ctx.fillRect(craneX - 20, 4, 40, 14);
  ctx.fillStyle = '#778899';
  ctx.fillRect(craneX - 15, 18, 4, 30);
  ctx.fillRect(craneX + 11, 18, 4, 30);
  // Hook
  ctx.strokeStyle = '#aabbcc';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(craneX, 55, 8, 0, Math.PI); ctx.stroke();

  // Ceiling lights (brighter, hangar style)
  for (let lx = 0; lx < W; lx += 200) {
    const llx = lx - (bgX * 0.4) % 200;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#88bbff';
    ctx.beginPath();
    ctx.moveTo(llx - 40, 0); ctx.lineTo(llx + 40, 0);
    ctx.lineTo(llx + 20, gY * 0.6); ctx.lineTo(llx - 20, gY * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#99aacc';
    ctx.fillRect(llx - 25, 0, 50, 5);
  }

  drawLabFloor(W, H, gY, '#1a2535', '#222d3d', '#446688');
}

// ── DISPATCHER ──
function drawBG() {
  switch (curBiome) {
    case 'village': drawBG_village(); break;
    case 'forest': drawBG_forest(); break;
    case 'city': drawBG_city(); break;
    case 'mountain': drawBG_mountain(); break;
    case 'ocean': drawBG_ocean(); break;
  }
}

function drawBanner() {
  if (!banner.timer) return;
  banner.timer--;
  const fade = Math.min(1, banner.timer / 25) * Math.min(1, (220 - banner.timer) / 20 + .2);
  if (fade <= 0) return;
  const W = canvas.gameW || canvas.width, H = canvas.gameH || canvas.height;
  ctx.save(); ctx.globalAlpha = fade * .88;
  const bg = ctx.createLinearGradient(0, H * .42, 0, H * .58);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(.25, 'rgba(0,0,0,.75)');
  bg.addColorStop(.75, 'rgba(0,0,0,.75)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, H * .42, W, H * .16);
  ctx.globalAlpha = fade; ctx.fillStyle = '#FFD700';
  ctx.font = `bold ${Math.max(18, Math.round(W * .04))}px "Moul",cursive`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(banner.text, W / 2, H * .5); ctx.restore();
}
