// ── UI MANAGER: Skins, Daily Rewards, Leaderboard ──

const SKINS = [
  { id:'default', name:'Spirit', body:'#ddf0ff', glow:'#aaddff', accent:'#6699ff', jet:'#ff6600', cost:0 },
  { id:'apsara', name:'Apsara', body:'#fff4cc', glow:'#ffd700', accent:'#ff9500', jet:'#ffaa00', cost:500 },
  { id:'naga', name:'Naga', body:'#ccffdd', glow:'#00ffaa', accent:'#00aa66', jet:'#22cc88', cost:2000 },
  { id:'guardian', name:'Guardian', body:'#ffcccc', glow:'#ff6644', accent:'#cc2200', jet:'#ff4400', cost:5000 },
  { id:'ocean', name:'Ocean Spirit', body:'#ccffff', glow:'#00ffff', accent:'#0088cc', jet:'#00aaff', cost:10000 }
];

const DAILY_REWARDS = [50, 100, 150, 200, 300, 400, 500];
const KD = ['0','1','2','3','4','5','6','7','8','9'];
function toK(n) { return String(n); }

// ── LocalStorage helpers ──
function getData() {
  try {
    const d = JSON.parse(localStorage.getItem('ksr_data'));
    return d || defaultData();
  } catch { return defaultData(); }
}
function saveData(d) { localStorage.setItem('ksr_data', JSON.stringify(d)); }
function defaultData() {
  return { totalCoins:0, selectedSkin:'default', unlockedSkins:['default'],
    leaderboard:[], dailyDay:0, dailyClaimed:null };
}

// ── Skins ──
function getSkinColors() {
  const d = getData();
  return SKINS.find(s => s.id === d.selectedSkin) || SKINS[0];
}

function renderSkins() {
  const d = getData();
  const list = document.getElementById('skinsList');
  list.innerHTML = '';
  SKINS.forEach(skin => {
    const unlocked = d.unlockedSkins.includes(skin.id);
    const active = d.selectedSkin === skin.id;
    const div = document.createElement('div');
    div.className = 'skinItem' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');
    div.innerHTML = `
      <div class="skinSwatch" style="background:${skin.body};border-color:${skin.accent}"></div>
      <div class="skinInfo">
        <div class="skinName">${skin.name}</div>
        <div class="skinCost">${unlocked ? (active ? '✅ Active' : '🔓 Unlocked') : '🔒 💰 ' + skin.cost}</div>
      </div>`;
    div.addEventListener('click', () => {
      if (!unlocked) {
        if (d.totalCoins >= skin.cost) {
          d.totalCoins -= skin.cost;
          d.unlockedSkins.push(skin.id);
          d.selectedSkin = skin.id;
          saveData(d);
          renderSkins();
          updateTotalCoins();
          sfx.reward();
        }
      } else {
        d.selectedSkin = skin.id;
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
