// ── AUDIO ENGINE ─────────────────────────────
let AC = null, masterGain = null, musicInt = null, musicIdx = 0, muted = false;
let jetOsc = null, jetGain = null; // continuous jetpack sound

const MUSIC = {
  bridge: { // Cyber Jungle (Hard Bass & Fast Percussion)
    tempo: 140,
    bass: [82, 82, 123, 0, 82, 82, 110, 0, 82, 82, 146, 0, 110, 110, 123, 0], // Aggressive driving bass
    chord: [[164, 246, 329], 0, 0, 0, [220, 329, 440], 0, 0, 0, [293, 440, 587], 0, 0, 0, [329, 493, 659], 0, 0, 0],
    melody: [659, 0, 659, 987, 0, 880, 0, 784, 1318, 0, 0, 1318, 1174, 1318, 1046, 0], // High futuristic leads
    drum: [3, 3, 1, 3, 2, 3, 1, 1, 3, 3, 1, 3, 2, 1, 3, 1] // Dense 16th-note hat pattern
  },
  village: { // Neon Ruins
    tempo: 140,
    bass: [110, 0, 110, 164, 110, 0, 146, 0, 110, 0, 110, 164, 110, 110, 123, 123],
    chord: [[220, 261, 329], 0, 0, 0, [261, 329, 392], 0, 0, 0, [220, 261, 329], 0, 0, 0, [246, 311, 370], 0, 0, 0],
    melody: [880, 1046, 1174, 1318, 0, 880, 0, 659, 1760, 0, 0, 1760, 1568, 1318, 1174, 0],
    drum: [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 2, 3, 2]
  },
  forest: { // Digital Forest
    tempo: 140,
    bass: [146, 146, 0, 220, 146, 146, 0, 196, 146, 146, 0, 220, 146, 146, 293, 0],
    chord: [[293, 349, 440], 0, 0, 0, [392, 493, 587], 0, 0, 0, [349, 440, 523], 0, 0, 0, [293, 349, 440], 0, 0, 0],
    melody: [587, 0, 0, 587, 880, 0, 0, 880, 1174, 0, 0, 1174, 1318, 0, 1046, 0],
    drum: [1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 2, 3, 3, 1, 2, 1]
  },
  city: { // Techno City
    tempo: 140,
    bass: [110, 0, 0, 110, 110, 0, 0, 110, 130, 0, 0, 130, 146, 0, 164, 0],
    chord: [[220, 261, 329], 0, 0, 0, [261, 311, 392], 0, 0, 0, [293, 349, 440], 0, 0, 0, [329, 392, 493], 0, 0, 0],
    melody: [0, 880, 0, 880, 987, 1046, 1174, 1318, 0, 1046, 0, 1174, 1318, 1568, 1760, 0],
    drum: [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3]
  },
  mountain: { // Volcanic Pulse
    tempo: 140,
    bass: [82, 0, 0, 82, 0, 0, 82, 0, 73, 0, 0, 73, 0, 0, 73, 0],
    chord: [[164, 246, 329], 0, 0, 0, [146, 220, 293], 0, 0, 0, [130, 196, 261], 0, 0, 0, [123, 185, 246], 0, 0, 0],
    melody: [659, 1318, 659, 1318, 659, 1318, 659, 1318, 587, 1174, 587, 1174, 523, 1046, 493, 987],
    drum: [1, 3, 1, 3, 1, 3, 1, 3, 2, 3, 2, 3, 2, 3, 2, 3]
  },
  ocean: { // Final Flight (Fastest)
    tempo: 140,
    bass: [110, 110, 110, 110, 130, 130, 130, 130, 146, 146, 146, 146, 164, 164, 164, 164],
    chord: [[220, 261, 329], 0, 0, 0, [261, 329, 392], 0, 0, 0, [293, 349, 440], 0, 0, 0, [329, 392, 493], 0, 0, 0],
    melody: [880, 987, 1046, 1174, 1318, 0, 1318, 0, 1568, 1760, 1975, 2093, 2349, 0, 0, 0],
    drum: [1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 2, 2, 2, 3]
  }
};

function initAudio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = muted ? 0 : 0.85;
    masterGain.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
}

// Simple synthesizer for generic SFX and melodic tones
function tone(freq, dur, type = 'sine', vol = 0.1, delay = 0) {
  if (!AC || muted || !freq) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = type; o.frequency.value = freq;
    const t = AC.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.02, dur - 0.01));
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { }
}

// Procedural Drum Synthesizer (1 = Kick, 2 = Snare/Clap, 3 = Hi-Hat)
function playDrum(type, vol = 0.1) {
  if (!AC || muted) return;
  try {
    const t = AC.currentTime;
    if (type === 1) { // Kick
      const o = AC.createOscillator(), g = AC.createGain();
      o.connect(g); g.connect(masterGain);
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
      g.gain.setValueAtTime(vol * 1.5, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    } else { // Noise-based hits (Snare & Hat)
      const bufSize = AC.sampleRate * (type === 2 ? 0.15 : 0.05);
      const buf = AC.createBuffer(1, bufSize, AC.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = AC.createBufferSource(); noise.buffer = buf;
      const filter = AC.createBiquadFilter();
      filter.type = type === 2 ? 'bandpass' : 'highpass';
      filter.frequency.value = type === 2 ? 1500 : 7000;
      const g = AC.createGain();
      noise.connect(filter); filter.connect(g); g.connect(masterGain);
      g.gain.setValueAtTime(vol * (type === 2 ? 0.8 : 0.3), t);
      g.gain.exponentialRampToValueAtTime(0.01, t + (type === 2 ? 0.15 : 0.05));
      noise.start(t);
    }
  } catch (e) { }
}

const sfx = {
  flap: () => { tone(520, .07, 'triangle', .08); tone(720, .05, 'sine', .04, .04); },
  coin: () => { [880, 1108, 1320].forEach((f, i) => tone(f, .08, 'triangle', .09, i * .075)); },
  hit: () => { tone(100, .28, 'sawtooth', .16); tone(80, .2, 'square', .1, .06); playDrum(1, 0.4); playDrum(2, 0.3); },
  shield: () => { [440, 660, 880].forEach((f, i) => tone(f, .12, 'triangle', .08, i * .08)); },
  speed: () => { [330, 440, 554, 660, 880].forEach((f, i) => tone(f, .1, 'triangle', .07, i * .06)); },
  magnet: () => { [440, 554, 660].forEach((f, i) => tone(f, .15, 'sine', .06, i * .1)); },
  shieldBreak: () => { tone(200, .3, 'sawtooth', .12); tone(150, .25, 'square', .08, .08); playDrum(2, 0.4); },
  pass: () => { tone(660, .07, 'sine', .04); },
  over: () => { [440, 370, 330, 262].forEach((f, i) => tone(f, .38, 'triangle', .1, i * .38)); },
  biome: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .14, 'triangle', .07, i * .11)); playDrum(3, 0.5); },
  laser: () => { tone(140, .15, 'sawtooth', .06); },
  laserCharge: () => {
    // High-pitched sweeping 'charging up' sound during targeting phase
    if (!AC || muted) return;
    try {
      const t = AC.currentTime;
      const o = AC.createOscillator(), g = AC.createGain();
      o.connect(g); g.connect(masterGain);
      o.type = 'triangle';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 1.2);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.2);
      g.gain.linearRampToValueAtTime(0.12, t + 1.0);
      g.gain.linearRampToValueAtTime(0.001, t + 1.2);
      o.start(t); o.stop(t + 1.3);
    } catch (e) { }
  },
  laserBeamBlast: () => {
    // Aggressive intense electric blast!
    if (!AC || muted) return;
    try {
      const t = AC.currentTime;
      const o = AC.createOscillator(), g = AC.createGain();
      o.connect(g); g.connect(masterGain);
      o.type = 'square';
      o.frequency.setValueAtTime(400, t);
      o.frequency.exponentialRampToValueAtTime(100, t + 0.6);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.05); // Snap!
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.start(t); o.stop(t + 0.8);

      // Sizzling electric noise explosion (crack/zap)
      const bufSize = AC.sampleRate * 0.8;
      const buf = AC.createBuffer(1, bufSize, AC.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = AC.createBufferSource(); noise.buffer = buf;
      const filter = AC.createBiquadFilter(); filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(300, t + 0.5);

      const ng = AC.createGain();
      noise.connect(filter); filter.connect(ng); ng.connect(masterGain);
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.linearRampToValueAtTime(0.5, t + 0.02); // VERY loud crack
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      noise.start(t); noise.stop(t + 0.8);
    } catch (e) { }
  },
  laserVertical: () => {
    // Sharp high energy crack for Vertical Beams
    if (!AC || muted) return;
    tone(600, 0.1, 'square', 0.08);
    tone(300, 0.25, 'sawtooth', 0.08, 0.05);
  },
  alarm: () => {
    // 4-pulse rapid, high-pitched lock-on alert
    [0, 0.15, 0.3, 0.45].forEach(d => tone(900, 0.08, 'square', 0.09, d));
  },
  missileLaunch: () => {
    // Initial blast (Volume reduced drastically)
    playDrum(1, 0.3); playDrum(2, 0.2);

    // Continuous Flying Missile Noise / Doppler Effect "NYOOOOM"
    if (!AC || muted) return;
    try {
      const t = AC.currentTime;
      // 1. Engine Rumble (Sawtooth dropping in pitch as it passes)
      const o = AC.createOscillator(), g = AC.createGain();
      o.connect(g); g.connect(masterGain);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 1.5);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.4); // Volume reduced from 0.2
      g.gain.linearRampToValueAtTime(0.001, t + 1.6); // Flying away
      o.start(t); o.stop(t + 1.7);

      // 2. Thruster wind/fire (Filtered white noise)
      const bufSize = AC.sampleRate * 2.0;
      const buf = AC.createBuffer(1, bufSize, AC.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = AC.createBufferSource(); noise.buffer = buf;
      const filter = AC.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, t); // Bright when close
      filter.frequency.exponentialRampToValueAtTime(200, t + 1.5); // Muffled away

      const ng = AC.createGain();
      noise.connect(filter); filter.connect(ng); ng.connect(masterGain);
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.linearRampToValueAtTime(0.08, t + 0.3); // Volume reduced from 0.3
      ng.gain.linearRampToValueAtTime(0.001, t + 1.6);
      noise.start(t); noise.stop(t + 1.8);
    } catch (e) { }
  },
  electric: () => { tone(1200, .08, 'square', .04); tone(1800, .06, 'square', .03, .04); },
  reward: () => { [523, 659, 784, 1047, 1320].forEach((f, i) => tone(f, .18, 'triangle', .08, i * .12)); },
  heart: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, .16, 'sine', .1, i * .09)); tone(1108, .2, 'triangle', .06, .4); },
};

let jetSrc = null;

function startJetpackSound() {
  if (!AC || muted || jetSrc) return;
  try {
    // Generate a noise buffer for realistically rushing air/fire thrust
    const bufSize = AC.sampleRate;
    const buf = AC.createBuffer(1, bufSize, AC.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1; // White noise

    jetSrc = AC.createBufferSource();
    jetSrc.buffer = buf;
    jetSrc.loop = true;

    // Use a lowpass filter to make it a deep, rumbling 'whoosh' rather than harsh static
    const filter = AC.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    jetGain = AC.createGain();
    jetSrc.connect(filter); filter.connect(jetGain); jetGain.connect(masterGain);

    jetGain.gain.setValueAtTime(0.001, AC.currentTime);
    jetGain.gain.linearRampToValueAtTime(0.25, AC.currentTime + 0.1);

    jetSrc.start();
  } catch (e) { }
}

function stopJetpackSound() {
  if (!jetSrc) return;
  try {
    jetGain.gain.linearRampToValueAtTime(0.001, AC.currentTime + 0.1);
    jetSrc.stop(AC.currentTime + 0.15);
  } catch (e) { }
  jetSrc = null; jetGain = null;
}

// Highly upgraded 4-track WebAudio sequence runner
function startMusic(biome) {
  stopMusic();
  if (!AC || muted) return;

  // The user requested to ONLY use the Angkor Wat ('village') audio track for the entire game
  const m = MUSIC['village']; if (!m) return;

  musicIdx = 0;

  musicInt = setInterval(() => {
    if (!AC || muted) return;
    const dur = m.tempo / 1000;

    // Bass Track (Square wave)
    const b = m.bass ? m.bass[musicIdx % m.bass.length] : 0;
    if (b) tone(b, dur * 0.8, 'square', 0.04);

    // Chords Track (Slow Sine waves)
    const c = m.chord ? m.chord[musicIdx % m.chord.length] : 0;
    if (c) c.forEach(n => tone(n, dur * 1.8, 'sine', 0.03));

    // Melody Track (Classic Triangle wave)
    const ml = m.melody ? m.melody[musicIdx % m.melody.length] : 0;
    if (ml) tone(ml, dur * 0.6, 'triangle', 0.045);

    // Drums Track (Procedural Kick/Snare/Hat)
    const d = m.drum ? m.drum[musicIdx % m.drum.length] : 0;
    if (d) playDrum(d, 0.08);

    musicIdx++;
  }, m.tempo);
}

function stopMusic() { clearInterval(musicInt); musicInt = null; }

function toggleMute(state) {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.85;
  if (!muted && AC && state === 'playing') startMusic(window.curBiome);
  else if (muted) { stopMusic(); stopJetpackSound(); }
  return muted;
}
