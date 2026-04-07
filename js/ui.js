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
  return { char, jet };
}

function renderSkins() {
  const d = getData();
  const list = document.getElementById('skinsList');
  list.innerHTML = '';

  const dataList = currentTab === 'chars' ? PLAYER_SKINS : JETPACK_SKINS;
  const unlockedList = currentTab === 'chars' ? d.unlockedSkins : d.unlockedJets;
  const selectedId = currentTab === 'chars' ? d.selectedSkin : d.selectedJet;

  dataList.forEach(item => {
    const unlocked = unlockedList.includes(item.id);
    const active = selectedId === item.id;
    const div = document.createElement('div');
    div.className = 'skinItem' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');

    // Premium frameSwatch
    div.innerHTML = `
      <div class="skinSwatch" style="background:${item.body}; border-color:${item.accent}; box-shadow: 0 0 12px ${item.glow} inset, 0 0 8px ${item.glow};"></div>
      <div class="skinInfo">
        <div class="skinName" style="color:${item.glow}">${item.name}</div>
        <div class="skinCost">${unlocked ? (active ? '✅ Equipped' : '🔓 Unlocked') : '🔒 💰 ' + item.cost}</div>
      </div>`;

    div.addEventListener('click', () => {
      if (!unlocked) {
        if (d.totalCoins >= item.cost) {
          d.totalCoins -= item.cost;
          if (currentTab === 'chars') d.unlockedSkins.push(item.id);
          else d.unlockedJets.push(item.id);

          if (currentTab === 'chars') d.selectedSkin = item.id;
          else d.selectedJet = item.id;

          saveData(d);
          renderSkins();
          updateTotalCoins();
          sfx.reward();
        }
      } else {
        if (currentTab === 'chars') d.selectedSkin = item.id;
        else d.selectedJet = item.id;
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
  renderSkins();
});
document.getElementById('tabJets').addEventListener('click', () => {
  currentTab = 'jets';
  document.getElementById('tabJets').classList.add('active');
  document.getElementById('tabChars').classList.remove('active');
  renderSkins();
});
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
updateTotalCoins();
checkDailyReward();
