// ── UI MANAGER: Skins, Daily Rewards, Leaderboard ──

const PLAYER_SKINS = [
  { id: 'cyber', name: 'Cyber Ninja', body: '#1c1f26', glow: '#00f3ff', accent: '#2b303a', saber: '#ff00ff', cost: 0 },
  { id: 'apsara', name: 'Solar Apsara', body: '#eeeeee', glow: '#ffd700', accent: '#ccaa00', saber: '#ffaa00', cost: 1000 },
  { id: 'demon', name: 'Neon Demon', body: '#150505', glow: '#ff0044', accent: '#221111', saber: '#ff0033', cost: 5000 }
];

const JETPACK_SKINS = [
  { id: 'plasma', name: 'Plasma Pack', body: '#2b303a', glow: '#00f3ff', exhaust: 'cyan', cost: 0 },
  { id: 'dragon', name: 'Dragon Engine', body: '#cc8800', glow: '#ff4400', exhaust: 'fire', cost: 1500 },
  { id: 'void', name: 'Void Core', body: '#111122', glow: '#aa00ff', exhaust: 'void', cost: 7500 }
];

const PET_SKINS = [
  { id: 'none', name: 'None', body: 'transparent', glow: 'transparent', cost: 0, model: 'none' },
  { id: 'cat', name: 'Space Cat', body: '#ffffff', glow: '#ff00ff', cost: 2000, model: 'cat' },
  { id: 'ufo', name: 'U.F.O.', body: '#222233', glow: '#00f3ff', cost: 3500, model: 'ufo' },
  { id: 'dragon', name: 'Mini Dragon', body: '#ffaa00', glow: '#ff4400', cost: 5500, model: 'dragon' }
];

let currentTab = 'chars';

const DAILY_REWARDS = [50, 100, 150, 200, 300, 400, 500];
const KD = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
function toK(n) { return String(n); }

// ── LocalStorage helpers ──
function getData() {
  try {
    const d = JSON.parse(localStorage.getItem('ksr_data2')); // new key to flush old data
    return d || defaultData();
  } catch { return defaultData(); }
}
function saveData(d) { localStorage.setItem('ksr_data2', JSON.stringify(d)); }
function defaultData() {
  return {
    totalCoins: 0,
    selectedSkin: 'cyber', unlockedSkins: ['cyber'],
    selectedJet: 'plasma', unlockedJets: ['plasma'],
    leaderboard: [], dailyDay: 0, dailyClaimed: null
  };
}

// ── Skins ──
function getSkinColors() {
  const d = getData();
  const char = PLAYER_SKINS.find(s => s.id === d.selectedSkin) || PLAYER_SKINS[0];
  const jet = JETPACK_SKINS.find(s => s.id === d.selectedJet) || JETPACK_SKINS[0];
  const pet = PET_SKINS.find(s => s.id === (d.selectedPet || 'none')) || PET_SKINS[0];
  return { char, jet, pet };
}

function renderSkins() {
  const d = getData();
  const list = document.getElementById('skinsList');
  list.innerHTML = '';

  const dataList = currentTab === 'chars' ? PLAYER_SKINS : (currentTab === 'jets' ? JETPACK_SKINS : PET_SKINS);
  const unlockedList = currentTab === 'chars' ? d.unlockedSkins : (currentTab === 'jets' ? d.unlockedJets : (d.unlockedPets || ['none']));
  const selectedId = currentTab === 'chars' ? d.selectedSkin : (currentTab === 'jets' ? d.selectedJet : (d.selectedPet || 'none'));

  dataList.forEach(item => {
    const unlocked = unlockedList.includes(item.id);
    const active = selectedId === item.id;
    const div = document.createElement('div');
    div.className = 'skinItem' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');

    let modelHTML = '';
    if (currentTab === 'chars') {
      let saberColor = item.saber || item.glow;
      modelHTML = `<div class="css-ninja" style="transform: scale(0.22); transform-origin: top left; position: absolute; left: 8px; top: 2px; --bg-body: ${item.body}; --accent-glow: ${item.glow}; --accent-saber: ${saberColor};">
          <div class="cn-jetpack"></div><div class="cn-flame"></div><div class="cn-ring"></div><div class="cn-body"></div><div class="cn-core"></div><div class="cn-head"></div><div class="cn-strap"></div><div class="cn-visor"></div><div class="cn-arm"></div><div class="cn-saber"></div><div class="cn-leg1"></div><div class="cn-leg2"></div><div class="cn-boot1"></div><div class="cn-boot2"></div>
      </div>`;
    } else if (currentTab === 'jets') {
      modelHTML = `<div class="css-pack" style="transform: scale(0.6); position: absolute; left: 4px; top: 10px; --bg-body: ${item.body}; --accent-glow: ${item.glow};">
          <div class="cp-body"></div><div class="cp-core"></div><div class="cp-flame"></div>
      </div>`;
    } else {
      // Pet models
      if (!document.getElementById('petUiStyles')) {
        const style = document.createElement('style');
        style.id = 'petUiStyles';
        style.innerHTML = `
          @keyframes pFloat { 0%,100% {transform: translateY(0px);} 50% {transform: translateY(-5px);} }
          @keyframes pTail { 0%,100% {transform: rotate(-10deg);} 50% {transform: rotate(20deg);} }
          @keyframes pWing { 0%,100% {transform: rotateX(0deg);} 50% {transform: rotateX(60deg);} }
          @keyframes pPulse { 0%,100% {opacity:0.4; transform:scale(0.8);} 50% {opacity:1; transform:scale(1.2);} }
        `;
        document.head.appendChild(style);
      }

      if (item.id === 'cat') {
        modelHTML = `
           <div style="position:relative; width:40px; height:30px; margin: 10px auto; animation: pFloat 2s ease-in-out infinite;">
             <!-- Tail -->
             <div style="position:absolute; width: 5px; height: 14px; background: ${item.body}; border-radius: 2px; top: 8px; left: 0px; transform-origin: bottom center; animation: pTail 1s ease-in-out infinite;">
               <div style="position:absolute; width: 8px; height: 5px; background: ${item.body}; border-radius: 2px; top: 0px; right: 0px;"></div>
             </div>
             <!-- Body -->
             <div style="position:absolute; width: 22px; height: 14px; border-radius: 4px; background: ${item.body}; top: 16px; left: 4px;"></div>
             <!-- Legs -->
             <div style="position:absolute; width: 4px; height: 4px; border-radius: 2px; background: #888; top: 28px; left: 6px;"></div>
             <div style="position:absolute; width: 4px; height: 4px; border-radius: 2px; background: #888; top: 28px; left: 12px;"></div>
             <div style="position:absolute; width: 4px; height: 4px; border-radius: 2px; background: #888; top: 28px; left: 18px;"></div>
             <!-- Head -->
             <div style="position:absolute; width: 16px; height: 14px; border-radius: 4px; background: ${item.body}; top: 4px; left: 14px;"></div>
             <!-- Ears -->
             <!-- Back Ear -->
             <div style="position:absolute; width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-bottom: 6px solid ${item.body}; top: -2px; left: 15px;"></div>
             <!-- Front Ear -->
             <div style="position:absolute; width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-bottom: 6px solid ${item.body}; top: -2px; left: 24px;"></div>
             <!-- Pink Inner Ears -->
             <div style="position:absolute; width: 0; height: 0; border-left: 1.5px solid transparent; border-right: 1.5px solid transparent; border-bottom: 4px solid #ff8db8; top: 0px; left: 16.5px;"></div>
             <div style="position:absolute; width: 0; height: 0; border-left: 1.5px solid transparent; border-right: 1.5px solid transparent; border-bottom: 4px solid #ff8db8; top: 0px; left: 25.5px;"></div>
             <!-- Collar -->
             <div style="position:absolute; width: 16px; height: 3px; border-radius: 1px; background: ${item.accent || '#ff2222'}; top: 16px; left: 14px;"></div>
             <!-- Bell -->
             <div style="position:absolute; width: 4px; height: 4px; border-radius: 50%; background: #fdd659; top: 18px; left: 20px;"></div>
             <!-- Eyes -->
             <div style="position:absolute; width: 4px; height: 4px; border-radius: 1px; background: ${item.glow}; top: 8px; left: 17px;"></div>
             <div style="position:absolute; width: 4px; height: 4px; border-radius: 1px; background: ${item.glow}; top: 8px; left: 25px;"></div>
             <!-- Nose -->
             <div style="position:absolute; width: 2px; height: 2px; border-radius: 50%; background: #ff8db8; top: 12px; left: 22px;"></div>
             <!-- Whiskers Left -->
             <div style="position:absolute; width: 4px; height: 1.5px; background: #999; top: 10px; left: 11px;"></div>
             <div style="position:absolute; width: 4px; height: 1.5px; background: #999; top: 13px; left: 11px;"></div>
             <!-- Whiskers Right -->
             <div style="position:absolute; width: 4px; height: 1.5px; background: #999; top: 10px; left: 31px;"></div>
             <div style="position:absolute; width: 4px; height: 1.5px; background: #999; top: 13px; left: 31px;"></div>
           </div>`;
      } else if (item.id === 'ufo') {
        modelHTML = `
           <div style="position:relative; width:40px; height:25px; margin: 12px auto; animation: pFloat 2.5s ease-in-out infinite;">
             <!-- Dome -->
             <div style="position:absolute; width: 20px; height: 14px; border-radius: 20px 20px 0 0; background: linear-gradient(to bottom, rgba(255,255,255,0.7), ${item.glow}44); top: 0; left: 10px; border: 1px solid rgba(255,255,255,0.3);"></div>
             <!-- Alien -->
             <div style="position:absolute; width: 6px; height: 6px; border-radius: 50%; background: #33ff33; top: 5px; left: 17px; box-shadow: 0 0 5px #33ff33;"></div>
             <!-- Saucer -->
             <div style="position:absolute; width: 40px; height: 10px; border-radius: 50%; background: linear-gradient(180deg, ${item.body}, #333); top: 10px; left: 0px; box-shadow: inset 0 2px 2px rgba(255,255,255,0.2), 0 3px 5px rgba(0,0,0,0.5);"></div>
             <!-- Lights -->
             <div style="position:absolute; width: 3px; height: 3px; border-radius: 50%; background: ${item.glow}; top: 13px; left: 6px; box-shadow: 0 0 3px ${item.glow}; animation: pPulse 1s infinite alternate;"></div>
             <div style="position:absolute; width: 3px; height: 3px; border-radius: 50%; background: ${item.glow}; top: 15px; left: 18.5px; box-shadow: 0 0 3px ${item.glow}; animation: pPulse 1s infinite alternate 0.3s;"></div>
             <div style="position:absolute; width: 3px; height: 3px; border-radius: 50%; background: ${item.glow}; top: 13px; right: 6px; box-shadow: 0 0 3px ${item.glow}; animation: pPulse 1s infinite alternate 0.6s;"></div>
             <!-- Thruster -->
             <div style="position:absolute; width: 10px; height: 8px; border-radius: 50%; background: ${item.glow}; top: 18px; left: 15px; filter: blur(3px); animation: pPulse 0.5s infinite alternate;"></div>
           </div>`;
      } else if (item.id === 'dragon') {
        modelHTML = `
           <div style="position:relative; width:45px; height:35px; margin: 7px auto; animation: pFloat 1.8s ease-in-out infinite; transform: scale(0.75);">
             <!-- Tail Base -->
             <div style="position:absolute; width: 14px; height: 16px; border-radius: 50%; border: 3px solid ${item.body}; border-top-color: transparent; border-right-color: transparent; top: 12px; left: -8px; transform: rotate(-30deg);"></div>
             <!-- Tail Spade -->
             <div style="position:absolute; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid ${item.accent || '#fdd659'}; top: 10px; left: -14px; transform: rotate(-60deg);"></div>
             <!-- Back Wing -->
             <div style="position:absolute; width: 14px; height: 18px; background: ${item.glow}; top: -2px; left: 12px; clip-path: polygon(0 100%, 30% 0, 100% 30%, 70% 60%, 100% 80%, 60% 100%); transform-origin: left bottom; animation: pWing 0.3s infinite alternate; opacity: 0.6; filter: drop-shadow(0 0 2px ${item.glow});"></div>
             <!-- Back Leg -->
             <div style="position:absolute; width: 6px; height: 8px; border-radius: 4px; background: ${item.body}; top: 22px; left: 8px; transform: rotate(-20deg);"></div>
             <!-- Body -->
             <div style="position:absolute; width: 22px; height: 18px; border-radius: 50%; background: ${item.body}; top: 10px; left: 6px;"></div>
             <!-- Yellow Belly -->
             <div style="position:absolute; width: 10px; height: 14px; border-radius: 50%; background: ${item.accent || '#fdd659'}; top: 12px; left: 16px;"></div>
             <!-- Front Leg -->
             <div style="position:absolute; width: 7px; height: 9px; border-radius: 4px; background: ${item.body}; top: 24px; left: 16px;"></div>
             <!-- Little Arm -->
             <div style="position:absolute; width: 6px; height: 4px; border-radius: 3px; background: ${item.body}; top: 16px; left: 24px; transform: rotate(20deg);"></div>
             <!-- Neck -->
             <div style="position:absolute; width: 10px; height: 14px; border-radius: 5px; background: ${item.body}; top: 2px; left: 14px; transform: rotate(15deg);"></div>
             <!-- Cute Head -->
             <div style="position:absolute; width: 22px; height: 20px; border-radius: 10px; background: ${item.body}; top: -6px; left: 16px;"></div>
             <!-- Snout -->
             <div style="position:absolute; width: 14px; height: 12px; border-radius: 6px; background: ${item.body}; top: 0px; left: 30px;"></div>
             <!-- Nostril -->
             <div style="position:absolute; width: 2px; height: 2px; border-radius: 50%; background: #222; top: 4px; left: 40px;"></div>
             <!-- Eye -->
             <div style="position:absolute; width: 4px; height: 6px; border-radius: 50%; background: #111; top: -2px; left: 32px;"></div>
             <!-- White Glint -->
             <div style="position:absolute; width: 1.5px; height: 1.5px; border-radius: 50%; background: #fff; top: -1px; left: 33px;"></div>
             <!-- Blush -->
             <div style="position:absolute; width: 6px; height: 4px; border-radius: 50%; background: #ff8db8; top: 6px; left: 26px; opacity: 0.8;"></div>
             <!-- Back Horn -->
             <div style="position:absolute; width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-bottom: 8px solid #fff; top: -12px; left: 18px; transform: rotate(-20deg);"></div>
             <!-- Front Horn -->
             <div style="position:absolute; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 12px solid #fff; top: -15px; left: 22px; transform: rotate(10deg);"></div>
             <!-- Front Wing -->
             <div style="position:absolute; width: 18px; height: 22px; background: ${item.glow}; top: -6px; left: 8px; clip-path: polygon(0 100%, 30% 0, 100% 30%, 60% 60%, 100% 85%, 50% 100%); transform-origin: left bottom; animation: pWing 0.3s infinite alternate reverse; opacity: 0.95; filter: drop-shadow(0 0 2px ${item.glow});"></div>
           </div>`;
      } else if (item.id === 'none') {
        modelHTML = `
           <div style="position:relative; width:40px; height:40px; margin: 0 auto; display:flex; align-items:center; justify-content:center; font-size: 24px;">
             🚫
           </div>`;
      }
    }

    div.innerHTML = `
      <div class="skinModel" style="border-color:${item.accent}; background: rgba(0,0,0,0.4); box-shadow: inset 0 0 20px ${item.glow}44;">
        ${modelHTML}
      </div>
      <div class="skinInfo">
        <div class="skinName" style="color:${item.glow}">${item.name}</div>
        <div class="skinCost">${unlocked ? (active ? '✅ Equipped' : '🔓 Unlocked') : '🔒 💰 ' + item.cost}</div>
      </div>`;

    div.addEventListener('click', () => {
      if (!unlocked) {
        if (d.totalCoins >= item.cost) {
          d.totalCoins -= item.cost;
          if (currentTab === 'chars') d.unlockedSkins.push(item.id);
          else if (currentTab === 'jets') d.unlockedJets.push(item.id);
          else {
            if (!d.unlockedPets) d.unlockedPets = ['none'];
            d.unlockedPets.push(item.id);
          }

          if (currentTab === 'chars') d.selectedSkin = item.id;
          else if (currentTab === 'jets') d.selectedJet = item.id;
          else d.selectedPet = item.id;

          saveData(d);
          renderSkins();
          updateTotalCoins();
          sfx.reward();
        }
      } else {
        if (currentTab === 'chars') d.selectedSkin = item.id;
        else if (currentTab === 'jets') d.selectedJet = item.id;
        else d.selectedPet = item.id;
        saveData(d);
        renderSkins();
      }
    });
    list.appendChild(div);
  });
}

// ── Leaderboard ──
function addScore(score) {
  const d = getData();
  d.leaderboard.push(score);
  d.leaderboard.sort((a, b) => b - a);
  d.leaderboard = d.leaderboard.slice(0, 10);
  saveData(d);
}

function renderLeaderboard() {
  const d = getData();
  const list = document.getElementById('leaderList');
  if (d.leaderboard.length === 0) {
    list.innerHTML = '<div class="lbEmpty">No scores yet<br>Play a game to get started!</div>';
    return;
  }
  list.innerHTML = d.leaderboard.map((s, i) =>
    `<div class="lbRow"><span>#${i + 1}</span><span>${toK(s)}</span></div>`
  ).join('');
}

// ── Daily Rewards ──
function checkDailyReward() {
  const d = getData();
  const today = new Date().toDateString();
  if (d.dailyClaimed === today) {
    document.getElementById('dailyNotif').classList.add('hidden');
    return false;
  }
  document.getElementById('dailyNotif').classList.remove('hidden');
  return true;
}

function showDailyReward() {
  const d = getData();
  const today = new Date().toDateString();
  if (d.dailyClaimed === today) return;
  const day = (d.dailyDay % 7);
  const reward = DAILY_REWARDS[day];
  const content = document.getElementById('dailyContent');
  content.innerHTML = `<div class="dailyDay">Day ${day + 1} / 7</div>
    <div class="dailyCoins">💰 ${reward}</div>`;
  document.getElementById('dailyOverlay').classList.remove('hidden');
}

function claimDailyReward() {
  const d = getData();
  const today = new Date().toDateString();
  if (d.dailyClaimed === today) return;
  const day = d.dailyDay % 7;
  const reward = DAILY_REWARDS[day];
  d.totalCoins += reward;
  d.dailyDay++;
  d.dailyClaimed = today;
  saveData(d);
  document.getElementById('dailyOverlay').classList.add('hidden');
  document.getElementById('dailyNotif').classList.add('hidden');
  updateTotalCoins();
  sfx.reward();
}

function addCoins(amount) {
  const d = getData();
  d.totalCoins += amount;
  saveData(d);
  updateTotalCoins();
}

function updateTotalCoins() {
  const d = getData();
  document.getElementById('totalCoinsStart').textContent = d.totalCoins;
}

function getBestScore() {
  const d = getData();
  return d.leaderboard.length > 0 ? d.leaderboard[0] : 0;
}

// ── UI Event Bindings ──
document.getElementById('skinsBtn').addEventListener('click', e => {
  e.stopPropagation(); renderSkins();
  document.getElementById('skinsOverlay').classList.remove('hidden');
});
document.getElementById('tabChars').addEventListener('click', () => {
  currentTab = 'chars';
  document.getElementById('tabChars').classList.add('active');
  document.getElementById('tabJets').classList.remove('active');
  if (document.getElementById('tabPets')) document.getElementById('tabPets').classList.remove('active');
  renderSkins();
});
document.getElementById('tabJets').addEventListener('click', () => {
  currentTab = 'jets';
  document.getElementById('tabJets').classList.add('active');
  document.getElementById('tabChars').classList.remove('active');
  if (document.getElementById('tabPets')) document.getElementById('tabPets').classList.remove('active');
  renderSkins();
});
if (document.getElementById('tabPets')) {
  document.getElementById('tabPets').addEventListener('click', () => {
    currentTab = 'pets';
    document.getElementById('tabPets').classList.add('active');
    document.getElementById('tabChars').classList.remove('active');
    document.getElementById('tabJets').classList.remove('active');
    renderSkins();
  });
}
document.getElementById('skinsClose').addEventListener('click', () => {
  document.getElementById('skinsOverlay').classList.add('hidden');
});
document.getElementById('leaderBtn').addEventListener('click', e => {
  e.stopPropagation(); renderLeaderboard();
  document.getElementById('leaderOverlay').classList.remove('hidden');
});
document.getElementById('leaderClose').addEventListener('click', () => {
  document.getElementById('leaderOverlay').classList.add('hidden');
});
document.getElementById('dailyNotif').addEventListener('click', e => {
  e.stopPropagation(); showDailyReward();
});
document.getElementById('claimBtn').addEventListener('click', e => {
  e.stopPropagation(); claimDailyReward();
});

// ── Init ──
const initD = getData();
if (!initD.gifted100k) {
  initD.totalCoins += 100000;
  initD.gifted100k = true;
  saveData(initD);
}
updateTotalCoins();
checkDailyReward();
