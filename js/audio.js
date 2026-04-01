// ── AUDIO ENGINE ─────────────────────────────
let AC = null, masterGain = null, musicInt = null, musicIdx = 0, muted = false;
let jetOsc = null, jetGain = null; // continuous jetpack sound

const MUSIC = {
  village:  { notes:[330,294,330,392,440,392,330,262,294,330,392,330], tempo:400, type:'triangle', vol:0.07 },
  forest:   { notes:[523,659,784,880,784,659,523,587,698,880,698,587], tempo:270, type:'sine', vol:0.055 },
  city:     { notes:[220,0,277,0,330,220,220,0,247,0,330,247], tempo:180, type:'square', vol:0.03 },
  mountain: { notes:[196,220,247,294,247,220,196,0,175,196,220,247], tempo:580, type:'sine', vol:0.08 },
  ocean:    { notes:[349,392,440,392,349,330,349,440,494,440,349,330], tempo:340, type:'sine', vol:0.065 }
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
  } catch (e) {}
}

const sfx = {
  flap:    () => { tone(520,.07,'triangle',.08); tone(720,.05,'sine',.04,.04); },
  coin:    () => { [880,1108,1320].forEach((f,i) => tone(f,.08,'triangle',.09,i*.075)); },
  hit:     () => { tone(100,.28,'sawtooth',.16); tone(80,.2,'square',.1,.06); },
  shield:  () => { [440,660,880].forEach((f,i) => tone(f,.12,'triangle',.08,i*.08)); },
  speed:   () => { [330,440,554,660,880].forEach((f,i) => tone(f,.1,'triangle',.07,i*.06)); },
  magnet:  () => { [440,554,660].forEach((f,i) => tone(f,.15,'sine',.06,i*.1)); },
  shieldBreak: () => { tone(200,.3,'sawtooth',.12); tone(150,.25,'square',.08,.08); },
  pass:    () => { tone(660,.07,'sine',.04); },
  over:    () => { [440,370,330,262].forEach((f,i) => tone(f,.38,'triangle',.1,i*.38)); },
  biome:   () => { [523,659,784,1047].forEach((f,i) => tone(f,.14,'triangle',.07,i*.11)); },
  laser:   () => { tone(140,.15,'sawtooth',.06); },
  missile: () => { tone(80,.4,'sawtooth',.08); tone(120,.3,'square',.05,.1); },
  electric:() => { tone(1200,.08,'square',.04); tone(1800,.06,'square',.03,.04); },
  reward:  () => { [523,659,784,1047,1320].forEach((f,i) => tone(f,.18,'triangle',.08,i*.12)); },
};

function startJetpackSound() {
  if (!AC || muted || jetOsc) return;
  try {
    jetOsc = AC.createOscillator(); jetGain = AC.createGain();
    jetOsc.connect(jetGain); jetGain.connect(masterGain);
    jetOsc.type = 'sawtooth'; jetOsc.frequency.value = 65;
    jetGain.gain.setValueAtTime(0.001, AC.currentTime);
    jetGain.gain.linearRampToValueAtTime(0.04, AC.currentTime + 0.08);
    jetOsc.start();
  } catch (e) {}
}

function stopJetpackSound() {
  if (!jetOsc) return;
  try {
    jetGain.gain.linearRampToValueAtTime(0.001, AC.currentTime + 0.06);
    jetOsc.stop(AC.currentTime + 0.1);
  } catch (e) {}
  jetOsc = null; jetGain = null;
}

function startMusic(biome) {
  stopMusic();
  if (!AC || muted) return;
  const m = MUSIC[biome]; if (!m) return;
  musicIdx = 0;
  musicInt = setInterval(() => {
    if (!AC || muted) return;
    const n = m.notes[musicIdx % m.notes.length];
    if (n) tone(n, m.tempo / 1000 * .65, m.type, m.vol);
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
