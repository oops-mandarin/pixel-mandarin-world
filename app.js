import { firebaseConfig } from './firebase-config.js';

// ============================================================
// DATA
// ============================================================

const COUNTRIES = [
  { id: 'tw', flag: '🇹🇼', nameEn: 'Taiwan' },
  { id: 'nz', flag: '🇳🇿', nameEn: 'New Zealand' },
  { id: 'us', flag: '🇺🇸', nameEn: 'USA' },
  { id: 'id', flag: '🇮🇩', nameEn: 'Indonesia' },
  { id: 'my', flag: '🇲🇾', nameEn: 'Malaysia' },
  { id: 'ph', flag: '🇵🇭', nameEn: 'Philippines' },
  { id: 'fr', flag: '🇫🇷', nameEn: 'France' },
];

// Every country scene reuses the same four activity zones (percentage of stage size).
// All zones sit at px >= 0.55 (right side of the stage) so the fixed-width
// bottom-left online panel can never cover one, on any viewport width.
const ZONES = [
  { id: 'market', icon: '🛒', label: 'Supermarket', px: 0.58, py: 0.22 },
  { id: 'cafe',   icon: '☕', label: 'Cafe', px: 0.88, py: 0.22 },
  { id: 'park',   icon: '🌳', label: 'Park', px: 0.58, py: 0.68 },
  { id: 'soccer', icon: '⚽', label: 'Soccer Field', px: 0.88, py: 0.68 },
];

const SKIN_COLORS = ['#ffdbac', '#f1c27d', '#c68642', '#8d5524'];
const HAIR_COLORS = ['#2b2b2b', '#6b4226', '#d9b56b', '#b23a2a', '#e07bb0', '#4a7fd6'];
const OUTFIT_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9d4edd', '#eaeaea'];

const HAIR_STYLES = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'curly', label: 'Curly' },
];

const OUTFIT_STYLES = [
  { id: 'tee', label: 'Tee' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'dress', label: 'Dress' },
  { id: 'sporty', label: 'Sporty' },
];

const DEFAULT_LOOK = {
  skin: SKIN_COLORS[0],
  hairStyle: 'short',
  hairColor: HAIR_COLORS[0],
  outfitStyle: 'tee',
  outfitColor: OUTFIT_COLORS[0],
};

const ONLINE_TIMEOUT_MS = 45000;
const HEARTBEAT_MS = 15000;
const MOVE_SPEED = 160; // px per second
const WRITE_THROTTLE_MS = 300;

// ============================================================
// CHARACTER RENDERING (pixel art on canvas)
// ============================================================

function drawCharacter(ctx, look) {
  ctx.clearRect(0, 0, 32, 40);
  ctx.imageSmoothingEnabled = false;

  const { skin, hairStyle, hairColor, outfitStyle, outfitColor } = look;

  // back hair (behind head)
  ctx.fillStyle = hairColor;
  if (hairStyle === 'long') {
    ctx.fillRect(6, 10, 3, 20);
    ctx.fillRect(23, 10, 3, 20);
  } else if (hairStyle === 'ponytail') {
    ctx.fillRect(23, 9, 3, 15);
    ctx.fillRect(24, 22, 3, 3);
  }

  // arms
  ctx.fillStyle = skin;
  ctx.fillRect(4, 23, 4, 9);
  ctx.fillRect(24, 23, 4, 9);

  // head
  ctx.fillStyle = skin;
  ctx.fillRect(9, 8, 14, 12);

  // eyes
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(12, 14, 2, 2);
  ctx.fillRect(18, 14, 2, 2);

  // front hair (top)
  ctx.fillStyle = hairColor;
  ctx.fillRect(8, 5, 16, 5);
  if (hairStyle === 'short') {
    ctx.fillRect(8, 10, 2, 4);
    ctx.fillRect(22, 10, 2, 4);
  } else if (hairStyle === 'curly') {
    ctx.fillRect(7, 8, 3, 3);
    ctx.fillRect(11, 9, 3, 3);
    ctx.fillRect(16, 8, 3, 3);
    ctx.fillRect(21, 9, 3, 3);
    ctx.fillRect(24, 8, 3, 3);
  } else if (hairStyle === 'long' || hairStyle === 'ponytail') {
    ctx.fillRect(8, 10, 2, 4);
    ctx.fillRect(22, 10, 2, 4);
  }

  // body / outfit base
  ctx.fillStyle = outfitColor;
  ctx.fillRect(8, 22, 16, 12);

  if (outfitStyle === 'hoodie') {
    ctx.fillRect(8, 19, 4, 4);
    ctx.fillRect(20, 19, 4, 4);
  } else if (outfitStyle === 'dress') {
    ctx.fillRect(6, 30, 20, 6);
  } else if (outfitStyle === 'sporty') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 26, 16, 2);
  }

  // legs / shoes
  ctx.fillStyle = '#2b2b3d';
  ctx.fillRect(10, 34, 4, 6);
  ctx.fillRect(18, 34, 4, 6);
}

// ============================================================
// BACKEND ADAPTER
// subscribe(cb) -> unsubscribe fn ; cb receives { [nameKey]: playerDoc }
// upsert(doc) -> Promise
// getPlayer(nameKey) -> Promise<doc|null>
// ============================================================

function makeLocalBackend() {
  const STORE_KEY = 'pmw_players_v1';
  let channel = null;
  try { channel = new BroadcastChannel('pmw_sync_v1'); } catch (e) { channel = null; }

  function readAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function writeAll(obj) {
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  }

  const listeners = new Set();
  function notify() {
    const all = readAll();
    listeners.forEach((cb) => cb(all));
  }

  if (channel) channel.onmessage = () => notify();
  window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) notify(); });

  return {
    mode: 'local',
    subscribe(cb) {
      listeners.add(cb);
      cb(readAll());
      return () => listeners.delete(cb);
    },
    async upsert(doc) {
      const all = readAll();
      all[doc.nameKey] = doc;
      writeAll(all);
      if (channel) channel.postMessage('update');
      notify();
    },
    async getPlayer(nameKey) {
      const all = readAll();
      return all[nameKey] || null;
    },
  };
}

async function makeFirebaseBackend(config) {
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  const app = appMod.initializeApp(config);
  const db = fsMod.getFirestore(app);
  const colRef = fsMod.collection(db, 'players');

  return {
    mode: 'firebase',
    subscribe(cb) {
      return fsMod.onSnapshot(colRef, (snap) => {
        const all = {};
        snap.forEach((d) => { all[d.id] = d.data(); });
        cb(all);
      });
    },
    async upsert(doc) {
      await fsMod.setDoc(fsMod.doc(colRef, doc.nameKey), doc, { merge: true });
    },
    async getPlayer(nameKey) {
      const snap = await fsMod.getDoc(fsMod.doc(colRef, nameKey));
      return snap.exists() ? snap.data() : null;
    },
  };
}

let backend = null;
async function initBackend() {
  const configured = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'REPLACE_ME';
  if (configured) {
    try {
      backend = await makeFirebaseBackend(firebaseConfig);
      console.log('[Mandarin World] using Firebase backend — cross-device sync is ON');
      return;
    } catch (err) {
      console.warn('[Mandarin World] Firebase init failed, falling back to local demo mode', err);
    }
  } else {
    console.log('[Mandarin World] local demo mode — fill in firebase-config.js to enable cross-device sync');
  }
  backend = makeLocalBackend();
}

// ============================================================
// STATE
// ============================================================

const state = {
  nameKey: null,
  name: null,
  look: { ...DEFAULT_LOOK },
  country: COUNTRIES[0].id,
  x: 0.5, y: 0.5, // fraction of stage size
  message: '', messageAt: 0,
  players: {}, // all players from backend, keyed by nameKey
  screen: 'login',
  movingTarget: null, // {x,y} in fractions
  keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
  lastWrite: 0,
  isFirstTimeSetup: false,
  customizerReturnTo: 'worldmap',
};

function nameToKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 24);
}

function myDoc() {
  return {
    nameKey: state.nameKey,
    name: state.name,
    country: state.country,
    x: state.x,
    y: state.y,
    ...state.look,
    message: state.message,
    messageAt: state.messageAt,
    updatedAt: Date.now(),
  };
}

function persistLocalMemory() {
  try {
    localStorage.setItem('pmw_last_name', state.name);
  } catch (e) {}
}

async function pushMyDoc(force) {
  const now = Date.now();
  if (!force && now - state.lastWrite < WRITE_THROTTLE_MS) return;
  state.lastWrite = now;
  await backend.upsert(myDoc());
}

// ============================================================
// SCREENS
// ============================================================

const screens = {
  login: document.getElementById('screen-login'),
  customizer: document.getElementById('screen-customizer'),
  worldmap: document.getElementById('screen-worldmap'),
  scene: document.getElementById('screen-scene'),
};
const onlinePanel = document.getElementById('onlinePanel');

function showScreen(name) {
  state.screen = name;
  Object.entries(screens).forEach(([k, el]) => { el.style.display = (k === name) ? '' : 'none'; });
  onlinePanel.style.display = (name === 'worldmap' || name === 'scene') ? '' : 'none';
}

// ---------------- LOGIN ----------------

const nameInput = document.getElementById('nameInput');
const enterBtn = document.getElementById('enterBtn');
const loginHint = document.getElementById('loginHint');

try {
  const last = localStorage.getItem('pmw_last_name');
  if (last) nameInput.value = last;
} catch (e) {}

enterBtn.addEventListener('click', onEnter);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') onEnter(); });

async function onEnter() {
  const raw = nameInput.value;
  const key = nameToKey(raw);
  if (!key) { loginHint.textContent = 'Please type a name'; return; }

  loginHint.textContent = 'Logging in…';
  state.name = raw.trim();
  state.nameKey = key;

  const existing = await backend.getPlayer(key);
  if (existing) {
    state.look = {
      skin: existing.skin, hairStyle: existing.hairStyle, hairColor: existing.hairColor,
      outfitStyle: existing.outfitStyle, outfitColor: existing.outfitColor,
    };
    state.country = existing.country || COUNTRIES[0].id;
    state.x = existing.x ?? 0.5;
    state.y = existing.y ?? 0.5;
    persistLocalMemory();
    await pushMyDoc(true);
    enterWorld();
  } else {
    state.isFirstTimeSetup = true;
    state.look = { ...DEFAULT_LOOK };
    state.x = 0.5; state.y = 0.5;
    openCustomizer();
  }
}

// ---------------- CUSTOMIZER ----------------

const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');

function buildSwatches(container, colors, key, { shape = false, labels = null } = {}) {
  container.innerHTML = '';
  const items = shape ? labels : colors;
  items.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'swatch';
    if (shape) {
      el.textContent = labels[i].label;
      el.dataset.value = labels[i].id;
    } else {
      el.style.background = c;
      el.dataset.value = c;
    }
    el.addEventListener('click', () => {
      state.look[key] = el.dataset.value;
      refreshSwatchSelection(container, el.dataset.value);
      redrawPreview();
    });
    container.appendChild(el);
  });
}

function refreshSwatchSelection(container, value) {
  [...container.children].forEach((el) => {
    el.classList.toggle('selected', el.dataset.value === value);
  });
}

function redrawPreview() {
  drawCharacter(previewCtx, state.look);
}

const skinSwatches = document.getElementById('skinSwatches');
const hairStyleSwatches = document.getElementById('hairStyleSwatches');
const hairColorSwatches = document.getElementById('hairColorSwatches');
const outfitStyleSwatches = document.getElementById('outfitStyleSwatches');
const outfitColorSwatches = document.getElementById('outfitColorSwatches');
const homeCountrySelect = document.getElementById('homeCountrySelect');
const saveLookBtn = document.getElementById('saveLookBtn');

buildSwatches(skinSwatches, SKIN_COLORS, 'skin');
buildSwatches(hairStyleSwatches, null, 'hairStyle', { shape: true, labels: HAIR_STYLES });
buildSwatches(hairColorSwatches, HAIR_COLORS, 'hairColor');
buildSwatches(outfitStyleSwatches, null, 'outfitStyle', { shape: true, labels: OUTFIT_STYLES });
buildSwatches(outfitColorSwatches, OUTFIT_COLORS, 'outfitColor');

COUNTRIES.forEach((c) => {
  const opt = document.createElement('option');
  opt.value = c.id;
  opt.textContent = `${c.flag} ${c.nameEn}`;
  homeCountrySelect.appendChild(opt);
});

function openCustomizer() {
  refreshSwatchSelection(skinSwatches, state.look.skin);
  refreshSwatchSelection(hairStyleSwatches, state.look.hairStyle);
  refreshSwatchSelection(hairColorSwatches, state.look.hairColor);
  refreshSwatchSelection(outfitStyleSwatches, state.look.outfitStyle);
  refreshSwatchSelection(outfitColorSwatches, state.look.outfitColor);
  homeCountrySelect.value = state.country;
  redrawPreview();
  showScreen('customizer');
}

// Spawn right-of-center so new/arriving players don't land under the
// bottom-left online panel on narrow viewports.
function spawnX() { return 0.62 + (Math.random() - 0.5) * 0.24; }
function spawnY() { return 0.45 + (Math.random() - 0.5) * 0.3; }

saveLookBtn.addEventListener('click', async () => {
  state.country = homeCountrySelect.value;
  if (state.isFirstTimeSetup) {
    state.x = spawnX(); state.y = spawnY();
    state.isFirstTimeSetup = false;
  }
  persistLocalMemory();
  await pushMyDoc(true);
  if (state.customizerReturnTo === 'scene') enterScene();
  else enterWorld();
});

document.getElementById('editLookBtnWorld').addEventListener('click', () => {
  state.customizerReturnTo = 'worldmap';
  openCustomizer();
});
document.getElementById('editLookBtnScene').addEventListener('click', () => {
  state.customizerReturnTo = 'scene';
  openCustomizer();
});

// ---------------- WORLD MAP ----------------

const countryGrid = document.getElementById('countryGrid');

function countryOf(nameKey) {
  return state.players[nameKey]?.country;
}

function onlinePlayers() {
  const now = Date.now();
  return Object.values(state.players).filter((p) => now - (p.updatedAt || 0) < ONLINE_TIMEOUT_MS);
}

function renderWorldMap() {
  const counts = {};
  onlinePlayers().forEach((p) => { counts[p.country] = (counts[p.country] || 0) + 1; });

  countryGrid.innerHTML = '';
  COUNTRIES.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'country-card';
    card.innerHTML = `
      <span class="flag">${c.flag}</span>
      <div class="cname">${c.nameEn}</div>
      <div class="ccount">🟢 ${counts[c.id] || 0} online</div>
    `;
    card.addEventListener('click', () => travelTo(c.id));
    countryGrid.appendChild(card);
  });

  document.getElementById('meTagWorld').textContent = `👤 ${state.name}`;
}

function enterWorld() {
  showScreen('worldmap');
  renderWorldMap();
}

async function travelTo(countryId) {
  state.country = countryId;
  state.x = spawnX(); state.y = spawnY();
  await pushMyDoc(true);
  enterScene();
}

document.getElementById('zoomOutBtn').addEventListener('click', () => {
  stopMovementKeys();
  showScreen('worldmap');
  renderWorldMap();
});

// ---------------- SCENE ----------------

const sceneStage = document.getElementById('sceneStage');
const sceneZonesEl = document.getElementById('sceneZones');
const sceneAvatarsEl = document.getElementById('sceneAvatars');
const sceneTitle = document.getElementById('sceneTitle');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

const avatarEls = new Map(); // nameKey -> {wrap, canvas, ctx, nameplate, bubble, activity}

function currentCountry() {
  return COUNTRIES.find((c) => c.id === state.country) || COUNTRIES[0];
}

function renderZones() {
  sceneZonesEl.innerHTML = '';
  const rect = sceneStage.getBoundingClientRect();
  ZONES.forEach((z) => {
    const el = document.createElement('div');
    el.className = 'zone';
    el.style.left = `${z.px * rect.width}px`;
    el.style.top = `${z.py * rect.height}px`;
    el.innerHTML = `<span class="zicon">${z.icon}</span><span class="zlabel">${z.label}</span>`;
    sceneZonesEl.appendChild(el);
  });
}

function nearestZoneLabel(xFrac, yFrac) {
  const rect = sceneStage.getBoundingClientRect();
  const px = xFrac * rect.width, py = yFrac * rect.height;
  for (const z of ZONES) {
    const zx = z.px * rect.width, zy = z.py * rect.height;
    const d = Math.hypot(px - zx, py - zy);
    if (d < 55) return `${z.icon} at the ${z.label}`;
  }
  return '';
}

function ensureAvatarEl(nameKey, isMe) {
  if (avatarEls.has(nameKey)) return avatarEls.get(nameKey);
  const wrap = document.createElement('div');
  wrap.className = 'avatar' + (isMe ? ' me' : '');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.style.display = 'none';
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 40;
  const nameplate = document.createElement('div');
  nameplate.className = 'nameplate';
  const activity = document.createElement('span');
  activity.className = 'activity';
  wrap.appendChild(bubble);
  wrap.appendChild(canvas);
  wrap.appendChild(nameplate);
  wrap.appendChild(activity);
  sceneAvatarsEl.appendChild(wrap);
  const rec = { wrap, canvas, ctx: canvas.getContext('2d'), nameplate, bubble, activity };
  avatarEls.set(nameKey, rec);
  return rec;
}

function removeAvatarEl(nameKey) {
  const rec = avatarEls.get(nameKey);
  if (rec) { rec.wrap.remove(); avatarEls.delete(nameKey); }
}

function renderSceneAvatars() {
  const rect = sceneStage.getBoundingClientRect();
  const here = Object.values(state.players).filter((p) => {
    const online = Date.now() - (p.updatedAt || 0) < ONLINE_TIMEOUT_MS;
    return online && p.country === state.country;
  });

  const seen = new Set();
  here.forEach((p) => {
    const isMe = p.nameKey === state.nameKey;
    const rec = ensureAvatarEl(p.nameKey, isMe);
    seen.add(p.nameKey);

    drawCharacter(rec.ctx, p);
    rec.nameplate.textContent = isMe ? `${p.name} (you)` : p.name;

    const xFrac = isMe ? state.x : p.x;
    const yFrac = isMe ? state.y : p.y;
    rec.wrap.style.left = `${xFrac * rect.width}px`;
    rec.wrap.style.top = `${yFrac * rect.height}px`;

    const act = nearestZoneLabel(xFrac, yFrac);
    rec.activity.textContent = act;

    const fresh = p.message && (Date.now() - (p.messageAt || 0) < 5000);
    rec.bubble.style.display = fresh ? '' : 'none';
    if (fresh) rec.bubble.textContent = p.message;
  });

  [...avatarEls.keys()].forEach((k) => { if (!seen.has(k)) removeAvatarEl(k); });
}

function enterScene() {
  stopMovementKeys();
  showScreen('scene');
  const c = currentCountry();
  sceneTitle.textContent = `${c.flag} ${c.nameEn}`;
  document.getElementById('meTagScene').textContent = `👤 ${state.name}`;
  avatarEls.forEach((rec) => rec.wrap.remove());
  avatarEls.clear();
  requestAnimationFrame(() => {
    renderZones();
    renderSceneAvatars();
  });
}

// click-to-move
sceneStage.addEventListener('click', (e) => {
  const rect = sceneStage.getBoundingClientRect();
  const xFrac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const yFrac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
  state.movingTarget = { x: xFrac, y: yFrac };
});

// arrow-key movement
function stopMovementKeys() {
  Object.keys(state.keys).forEach((k) => (state.keys[k] = false));
  state.movingTarget = null;
}
window.addEventListener('keydown', (e) => {
  if (state.screen !== 'scene') return;
  if (e.key in state.keys) { state.keys[e.key] = true; state.movingTarget = null; }
});
window.addEventListener('keyup', (e) => {
  if (e.key in state.keys) state.keys[e.key] = false;
});

// game loop
let lastTick = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;

  if (state.screen === 'scene') {
    const rect = sceneStage.getBoundingClientRect();
    if (rect.width > 0) {
      let dx = 0, dy = 0;
      if (state.keys.ArrowUp) dy -= 1;
      if (state.keys.ArrowDown) dy += 1;
      if (state.keys.ArrowLeft) dx -= 1;
      if (state.keys.ArrowRight) dx += 1;

      let moved = false;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        state.x += (dx / len) * (MOVE_SPEED / rect.width) * dt;
        state.y += (dy / len) * (MOVE_SPEED / rect.height) * dt;
        moved = true;
      } else if (state.movingTarget) {
        const tx = state.movingTarget.x, ty = state.movingTarget.y;
        const pdx = (tx - state.x) * rect.width, pdy = (ty - state.y) * rect.height;
        const dist = Math.hypot(pdx, pdy);
        if (dist < 4) {
          state.movingTarget = null;
        } else {
          const step = MOVE_SPEED * dt;
          const ratio = Math.min(1, step / dist);
          state.x += (tx - state.x) * ratio;
          state.y += (ty - state.y) * ratio;
          moved = true;
        }
      }

      state.x = Math.min(0.98, Math.max(0.02, state.x));
      state.y = Math.min(0.97, Math.max(0.05, state.y));

      renderSceneAvatars();
      if (moved) pushMyDoc(false);
    }
  }

  requestAnimationFrame(gameLoop);
}
requestAnimationFrame((t) => { lastTick = t; requestAnimationFrame(gameLoop); });

// chat
chatSendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  state.message = text;
  state.messageAt = Date.now();
  chatInput.value = '';
  await pushMyDoc(true);
  renderSceneAvatars();
}

// ---------------- ONLINE PANEL ----------------

const onlineListEl = document.getElementById('onlineList');
const onlineCountEl = document.getElementById('onlineCount');
const onlinePanelHeader = document.getElementById('onlinePanelHeader');
let onlinePanelCollapsed = false;
onlinePanelHeader.addEventListener('click', () => {
  onlinePanelCollapsed = !onlinePanelCollapsed;
  onlineListEl.style.display = onlinePanelCollapsed ? 'none' : '';
});

function renderOnlinePanel() {
  const players = onlinePlayers();
  onlineCountEl.textContent = players.length;

  const byCountry = {};
  players.forEach((p) => {
    (byCountry[p.country] = byCountry[p.country] || []).push(p);
  });

  onlineListEl.innerHTML = '';
  COUNTRIES.forEach((c) => {
    const list = byCountry[c.id];
    if (!list || !list.length) return;
    const group = document.createElement('div');
    group.className = 'online-group';
    group.innerHTML = `<div class="online-group-title">${c.flag} ${c.nameEn} (${list.length})</div>`;
    list.forEach((p) => {
      const isMe = p.nameKey === state.nameKey;
      const row = document.createElement('div');
      row.className = 'online-player' + (isMe ? ' self' : '');
      row.innerHTML = `<span>${p.name}${isMe ? ' (you)' : ''}</span>`;
      if (!isMe) {
        row.title = 'Click to go find them';
        row.addEventListener('click', () => travelTo(p.country));
      }
      group.appendChild(row);
    });
    onlineListEl.appendChild(group);
  });
}

// ============================================================
// BOOT
// ============================================================

function onPlayersUpdate(all) {
  state.players = all;
  if (state.screen === 'worldmap') renderWorldMap();
  if (state.screen === 'scene') renderSceneAvatars();
  renderOnlinePanel();
}

async function boot() {
  await initBackend();
  backend.subscribe(onPlayersUpdate);
  setInterval(() => { if (state.nameKey) pushMyDoc(true); }, HEARTBEAT_MS);
  showScreen('login');
}

boot();
