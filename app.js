import { firebaseConfig } from './firebase-config.js';

// ============================================================
// DATA
// ============================================================

// mapX/mapY are percentage positions (0-100) on the world map stage,
// loosely matching each country's real-world location.
const COUNTRIES = [
  { id: 'tw', flag: '🇹🇼', nameEn: 'Taiwan', mapX: 86, mapY: 32 },
  { id: 'nz', flag: '🇳🇿', nameEn: 'New Zealand', mapX: 93, mapY: 82 },
  { id: 'us', flag: '🇺🇸', nameEn: 'USA', mapX: 20, mapY: 32 },
  { id: 'id', flag: '🇮🇩', nameEn: 'Indonesia', mapX: 73, mapY: 70 },
  { id: 'my', flag: '🇲🇾', nameEn: 'Malaysia', mapX: 65, mapY: 58 },
  { id: 'ph', flag: '🇵🇭', nameEn: 'Philippines', mapX: 78, mapY: 46 },
  { id: 'fr', flag: '🇫🇷', nameEn: 'France', mapX: 51, mapY: 20 },
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

// Buildings players can place around their own home to decorate their
// home-country scene for everyone who visits it.
const BUILDING_TYPES = [
  { id: 'cafe', icon: '☕', label: 'Cafe' },
  { id: 'store', icon: '🏪', label: 'Convenience Store' },
  { id: 'restaurant', icon: '🥡', label: 'Chinese Restaurant' },
  { id: 'gas', icon: '⛽', label: 'Gas Station' },
  { id: 'car', icon: '🚗', label: 'Car' },
  { id: 'soccer', icon: '⚽', label: 'Soccer Field' },
  { id: 'baseball', icon: '⚾', label: 'Baseball Field' },
  { id: 'park', icon: '🌳', label: 'Park' },
  { id: 'market', icon: '🛒', label: 'Supermarket' },
];
const HOUSE_ICON = '🏠';
const LOT_RADIUS = 0.18; // how far from the house a decoration may be placed
const MAX_DECORATIONS = 10;

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
  sessionId: null,
  kicked: false,
  // Home decoration: the player's own fixed territory in their home country.
  homeCountry: null,
  homeX: null, homeY: null, // fraction position in that country's scene
  decorations: [], // [{type, dx, dy}] offsets from homeX/homeY
  decorateReturnTo: 'worldmap',
  decorateSelected: null, // a BUILDING_TYPES id armed to place next click
  decorateMovingHouse: false,
};

function nameToKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 24);
}

function newSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
    sessionId: state.sessionId,
    homeCountry: state.homeCountry,
    homeX: state.homeX,
    homeY: state.homeY,
    decorations: state.decorations,
    updatedAt: Date.now(),
  };
}

function persistLocalMemory() {
  try {
    localStorage.setItem('pmw_last_name', state.name);
  } catch (e) {}
}

async function pushMyDoc(force) {
  if (state.kicked) return;
  const now = Date.now();
  if (!force && now - state.lastWrite < WRITE_THROTTLE_MS) return;
  state.lastWrite = now;
  await backend.upsert(myDoc());
}

// If another tab/device logs in with the same name, that other session gets
// a new sessionId and overwrites ours. When we notice our own doc now carries
// someone else's sessionId, we back off instead of fighting over position
// updates (which looked like "two of me" flickering on screen).
function handleKicked() {
  state.kicked = true;
  state.nameKey = null;
  stopMovementKeys();
  loginHint.textContent = 'This name just logged in somewhere else — please enter again.';
  showScreen('login');
}

// ============================================================
// SCREENS
// ============================================================

const screens = {
  login: document.getElementById('screen-login'),
  customizer: document.getElementById('screen-customizer'),
  worldmap: document.getElementById('screen-worldmap'),
  scene: document.getElementById('screen-scene'),
  decorate: document.getElementById('screen-decorate'),
};
const onlinePanel = document.getElementById('onlinePanel');

function showScreen(name) {
  state.screen = name;
  Object.entries(screens).forEach(([k, el]) => { el.style.display = (k === name) ? '' : 'none'; });
  // Only shown in-scene: the world map already shows an online count per
  // country on each marker, so the list would just duplicate that there
  // while also risking covering markers on narrow viewports.
  onlinePanel.style.display = (name === 'scene') ? '' : 'none';
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
  state.kicked = false;
  state.name = raw.trim();
  state.nameKey = key;
  state.sessionId = newSessionId();

  const existing = await backend.getPlayer(key);
  if (existing) {
    state.look = {
      skin: existing.skin, hairStyle: existing.hairStyle, hairColor: existing.hairColor,
      outfitStyle: existing.outfitStyle, outfitColor: existing.outfitColor,
    };
    state.country = existing.country || COUNTRIES[0].id;
    state.x = existing.x ?? 0.5;
    state.y = existing.y ?? 0.5;
    state.homeCountry = existing.homeCountry || existing.country || COUNTRIES[0].id;
    state.homeX = existing.homeX ?? null;
    state.homeY = existing.homeY ?? null;
    state.decorations = existing.decorations || [];
    persistLocalMemory();
    await pushMyDoc(true);
    enterWorld();
  } else {
    state.isFirstTimeSetup = true;
    state.look = { ...DEFAULT_LOOK };
    state.x = 0.5; state.y = 0.5;
    state.homeCountry = null;
    state.homeX = null; state.homeY = null;
    state.decorations = [];
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
    state.homeCountry = state.country;
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

const countryMarkers = document.getElementById('countryMarkers');
const worldMapSvgHost = document.getElementById('worldMapSvgHost');
const markerEls = new Map(); // country id -> {el, countEl}

// A varied, pleasant palette so the whole world reads as colorful (like a
// real illustrated atlas) rather than flat continents. Picked once per
// country, deterministically, so the map looks the same every load.
const WORLD_PALETTE = [
  '#e07a5f', '#81b29a', '#f2cc8f', '#3d5a80', '#98c1d9',
  '#e56b6f', '#6d9f71', '#f4a261', '#9d8df1', '#588157',
  '#e9c46a', '#5fa8d3', '#bc6c25', '#a3cef1', '#d4a373',
  '#76c893', '#ee9b00', '#7b9e89',
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Fetches the (large, detailed) world SVG, colors every country, and uses
// each of our 7 playable countries' real drawn shape to place its marker
// in the right spot. Falls back to the plain ocean background + the
// hand-guessed mapX/mapY above if the fetch fails for any reason.
async function loadWorldMap() {
  let svgText;
  try {
    const res = await fetch('assets/world-states.svg');
    if (!res.ok) throw new Error('bad status ' + res.status);
    svgText = await res.text();
  } catch (err) {
    console.warn('[Mandarin World] could not load world map art, using plain background', err);
    return;
  }

  worldMapSvgHost.innerHTML = svgText;
  const svg = worldMapSvgHost.querySelector('svg');
  if (!svg) return;
  svg.removeAttribute('width');
  svg.removeAttribute('height');

  const worldRect = svg.querySelector('#World');
  if (worldRect) worldRect.setAttribute('fill', 'none');
  const ocean = svg.querySelector('#Ocean');
  if (ocean) { ocean.setAttribute('fill', '#173a5e'); ocean.setAttribute('stroke', 'none'); }
  const antarctica = svg.querySelector('g#AQ');
  if (antarctica) antarctica.setAttribute('display', 'none');

  const playableIds = new Set(COUNTRIES.map((c) => c.id.toUpperCase()));
  svg.querySelectorAll('g[id]').forEach((g) => {
    if (!/^[A-Z]{2}$/.test(g.id)) return;
    const playable = playableIds.has(g.id);
    const color = WORLD_PALETTE[hashStr(g.id) % WORLD_PALETTE.length];
    g.querySelectorAll('path').forEach((p) => {
      p.setAttribute('fill', color);
      p.setAttribute('stroke', playable ? '#ffd166' : '#12233a');
      p.setAttribute('stroke-width', playable ? '1.6' : '0.6');
    });
  });

  const vb = svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) {
    COUNTRIES.forEach((c) => {
      const g = svg.querySelector('g#' + c.id.toUpperCase());
      if (!g) return;
      try {
        const box = g.getBBox();
        if (box.width && box.height) {
          c.mapX = ((box.x + box.width / 2) / vb.width) * 100;
          c.mapY = ((box.y + box.height / 2) / vb.height) * 100;
        }
      } catch (err) { /* getBBox can throw on a detached/empty group — keep fallback */ }
    });
  }

  if (state.screen === 'worldmap') renderWorldMap();
}

function onlinePlayers() {
  const now = Date.now();
  return Object.values(state.players).filter((p) => now - (p.updatedAt || 0) < ONLINE_TIMEOUT_MS);
}

function ensureMarkerEl(c) {
  if (markerEls.has(c.id)) return markerEls.get(c.id);
  const el = document.createElement('div');
  el.className = 'country-marker';
  el.innerHTML = `
    <span class="marker-flag">${c.flag}</span>
    <span class="marker-label">${c.nameEn}</span>
    <span class="marker-count">🟢 <span class="marker-count-n">0</span></span>
  `;
  el.addEventListener('click', () => travelTo(c.id));
  countryMarkers.appendChild(el);
  const rec = { el, countEl: el.querySelector('.marker-count-n') };
  markerEls.set(c.id, rec);
  return rec;
}

function renderWorldMap() {
  const counts = {};
  onlinePlayers().forEach((p) => { counts[p.country] = (counts[p.country] || 0) + 1; });

  COUNTRIES.forEach((c) => {
    const rec = ensureMarkerEl(c);
    rec.el.style.left = `${c.mapX}%`;
    rec.el.style.top = `${c.mapY}%`;
    const n = counts[c.id] || 0;
    rec.countEl.textContent = n;
    rec.el.classList.toggle('has-people', n > 0);
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
const sceneHomePlotsEl = document.getElementById('sceneHomePlots');
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

// Renders every player's decorated home-plot that belongs in this scene's
// country — regardless of whether that player is currently online here.
// A plot is the player's permanent territory, not tied to their presence.
function renderHomePlots() {
  const rect = sceneStage.getBoundingClientRect();
  sceneHomePlotsEl.innerHTML = '';
  Object.values(state.players).forEach((p) => {
    if (p.homeCountry !== state.country || p.homeX == null || p.homeY == null) return;

    const plot = document.createElement('div');
    plot.className = 'home-plot';
    const hx = p.homeX * rect.width, hy = p.homeY * rect.height;

    const house = document.createElement('div');
    house.className = 'house';
    house.style.left = `${hx}px`;
    house.style.top = `${hy}px`;
    house.textContent = HOUSE_ICON;
    plot.appendChild(house);

    const label = document.createElement('div');
    label.className = 'house-label';
    label.style.left = `${hx}px`;
    label.style.top = `${hy}px`;
    label.textContent = p.nameKey === state.nameKey ? 'Your home' : `${p.name}'s home`;
    plot.appendChild(label);

    (p.decorations || []).forEach((d) => {
      const bt = BUILDING_TYPES.find((b) => b.id === d.type);
      if (!bt) return;
      const el = document.createElement('div');
      el.className = 'deco';
      el.style.left = `${(p.homeX + d.dx) * rect.width}px`;
      el.style.top = `${(p.homeY + d.dy) * rect.height}px`;
      el.textContent = bt.icon;
      plot.appendChild(el);
    });

    sceneHomePlotsEl.appendChild(plot);
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
    renderHomePlots();
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

// ---------------- DECORATE MY HOME ----------------

const decorateStage = document.getElementById('decorateStage');
const decorateLotRing = document.getElementById('decorateLotRing');
const decorateOtherHomesEl = document.getElementById('decorateOtherHomes');
const decorateMyHomeEl = document.getElementById('decorateMyHome');
const decorateTitle = document.getElementById('decorateTitle');
const decorateHint = document.getElementById('decorateHint');
const decoratePaletteEl = document.getElementById('decoratePalette');

function homeCountryObj() {
  return COUNTRIES.find((c) => c.id === state.homeCountry) || currentCountry();
}

function openDecorate(returnTo) {
  state.decorateReturnTo = returnTo;
  state.decorateSelected = null;
  state.decorateMovingHouse = false;
  if (!state.homeCountry) state.homeCountry = state.country;
  document.getElementById('meTagDecorate').textContent = `👤 ${state.name}`;
  buildDecoratePalette();
  showScreen('decorate');
  requestAnimationFrame(renderDecorateScreen);
}

function buildDecoratePalette() {
  decoratePaletteEl.innerHTML = '';

  const noneBtn = document.createElement('div');
  noneBtn.className = 'palette-item';
  noneBtn.innerHTML = `<span class="picon">🖐️</span><span class="plabel">None</span>`;
  noneBtn.addEventListener('click', () => {
    state.decorateSelected = null;
    renderDecorateScreen();
  });
  decoratePaletteEl.appendChild(noneBtn);

  BUILDING_TYPES.forEach((b) => {
    const el = document.createElement('div');
    el.className = 'palette-item';
    el.dataset.id = b.id;
    el.innerHTML = `<span class="picon">${b.icon}</span><span class="plabel">${b.label}</span>`;
    el.addEventListener('click', () => {
      state.decorateSelected = state.decorateSelected === b.id ? null : b.id;
      renderDecorateScreen();
    });
    decoratePaletteEl.appendChild(el);
  });
}

function renderDecorateScreen() {
  const c = homeCountryObj();
  decorateTitle.textContent = `🏡 Decorate — ${c.flag} ${c.nameEn}`;
  const rect = decorateStage.getBoundingClientRect();

  // palette selection highlight
  [...decoratePaletteEl.children].forEach((el) => {
    const isNone = !el.dataset.id;
    el.classList.toggle('selected', isNone ? !state.decorateSelected && !state.decorateMovingHouse : el.dataset.id === state.decorateSelected);
  });

  // hint text
  if (state.homeX == null) {
    decorateHint.textContent = `Click anywhere to place your house ${HOUSE_ICON}`;
  } else if (state.decorateMovingHouse) {
    decorateHint.textContent = 'Click a new spot to move your house (your decorations move with it)';
  } else if (state.decorateSelected) {
    const bt = BUILDING_TYPES.find((b) => b.id === state.decorateSelected);
    decorateHint.textContent = `Click near your house to place a ${bt.label} (${state.decorations.length}/${MAX_DECORATIONS})`;
  } else {
    decorateHint.textContent = `Click your house ${HOUSE_ICON} to move it, or pick something below to place`;
  }

  // other players' homes in this country, shown dim for context
  decorateOtherHomesEl.innerHTML = '';
  Object.values(state.players).forEach((p) => {
    if (p.nameKey === state.nameKey) return;
    if (p.homeCountry !== state.homeCountry || p.homeX == null || p.homeY == null) return;
    const house = document.createElement('div');
    house.className = 'house';
    house.style.left = `${p.homeX * rect.width}px`;
    house.style.top = `${p.homeY * rect.height}px`;
    house.textContent = HOUSE_ICON;
    decorateOtherHomesEl.appendChild(house);
    (p.decorations || []).forEach((d) => {
      const bt = BUILDING_TYPES.find((b) => b.id === d.type);
      if (!bt) return;
      const el = document.createElement('div');
      el.className = 'deco';
      el.style.left = `${(p.homeX + d.dx) * rect.width}px`;
      el.style.top = `${(p.homeY + d.dy) * rect.height}px`;
      el.textContent = bt.icon;
      decorateOtherHomesEl.appendChild(el);
    });
  });

  // my own home + decorations
  decorateMyHomeEl.innerHTML = '';
  if (state.homeX != null && state.homeY != null) {
    const hx = state.homeX * rect.width, hy = state.homeY * rect.height;

    decorateLotRing.style.display = '';
    const ringPx = LOT_RADIUS * Math.min(rect.width, rect.height);
    decorateLotRing.style.width = `${ringPx * 2}px`;
    decorateLotRing.style.height = `${ringPx * 2}px`;
    decorateLotRing.style.left = `${hx}px`;
    decorateLotRing.style.top = `${hy}px`;

    const house = document.createElement('div');
    house.className = 'house';
    house.style.left = `${hx}px`;
    house.style.top = `${hy}px`;
    house.textContent = HOUSE_ICON;
    house.addEventListener('click', (e) => {
      e.stopPropagation();
      state.decorateSelected = null;
      state.decorateMovingHouse = !state.decorateMovingHouse;
      renderDecorateScreen();
    });
    decorateMyHomeEl.appendChild(house);

    const label = document.createElement('div');
    label.className = 'house-label';
    label.style.left = `${hx}px`;
    label.style.top = `${hy}px`;
    label.textContent = 'Your home';
    decorateMyHomeEl.appendChild(label);

    state.decorations.forEach((d, i) => {
      const bt = BUILDING_TYPES.find((b) => b.id === d.type);
      if (!bt) return;
      const el = document.createElement('div');
      el.className = 'deco';
      el.style.left = `${(state.homeX + d.dx) * rect.width}px`;
      el.style.top = `${(state.homeY + d.dy) * rect.height}px`;
      el.style.cursor = 'pointer';
      el.textContent = bt.icon;
      el.title = 'Click to remove';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        state.decorations.splice(i, 1);
        pushMyDoc(true);
        renderDecorateScreen();
      });
      decorateMyHomeEl.appendChild(el);
    });
  } else {
    decorateLotRing.style.display = 'none';
  }
}

decorateStage.addEventListener('click', async (e) => {
  const rect = decorateStage.getBoundingClientRect();
  const xFrac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const yFrac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

  if (state.homeX == null || state.homeY == null) {
    state.homeX = xFrac; state.homeY = yFrac;
    await pushMyDoc(true);
    renderDecorateScreen();
    return;
  }

  if (state.decorateMovingHouse) {
    state.homeX = xFrac; state.homeY = yFrac;
    state.decorateMovingHouse = false;
    await pushMyDoc(true);
    renderDecorateScreen();
    return;
  }

  if (state.decorateSelected) {
    if (state.decorations.length >= MAX_DECORATIONS) {
      decorateHint.textContent = `You've placed the max of ${MAX_DECORATIONS} — remove one to add another.`;
      return;
    }
    let dx = xFrac - state.homeX, dy = yFrac - state.homeY;
    const dist = Math.hypot(dx, dy);
    if (dist > LOT_RADIUS) { dx = (dx / dist) * LOT_RADIUS; dy = (dy / dist) * LOT_RADIUS; }
    state.decorations.push({ type: state.decorateSelected, dx, dy });
    await pushMyDoc(true);
    renderDecorateScreen();
  }
});

document.getElementById('decorateBackBtn').addEventListener('click', () => {
  if (state.decorateReturnTo === 'scene') enterScene();
  else enterWorld();
});

document.getElementById('myHomeBtnWorld').addEventListener('click', () => openDecorate('worldmap'));
document.getElementById('myHomeBtnScene').addEventListener('click', () => openDecorate('scene'));

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

  if (state.nameKey && !state.kicked) {
    const mine = all[state.nameKey];
    if (mine && mine.sessionId && state.sessionId && mine.sessionId !== state.sessionId) {
      handleKicked();
      return;
    }
  }

  if (state.screen === 'worldmap') renderWorldMap();
  if (state.screen === 'scene') { renderHomePlots(); renderSceneAvatars(); }
  if (state.screen === 'decorate') renderDecorateScreen();
  renderOnlinePanel();
}

async function boot() {
  loadWorldMap(); // runs in the background; login takes longer than this fetch
  await initBackend();
  backend.subscribe(onPlayersUpdate);
  setInterval(() => { if (state.nameKey) pushMyDoc(true); }, HEARTBEAT_MS);
  showScreen('login');
}

boot();
