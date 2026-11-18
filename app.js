import { firebaseConfig } from './firebase-config.js';

// ============================================================
// DATA
// ============================================================

// Any real country can become a home island: the world SVG map already
// draws every country as a <g id="XX"> using its ISO alpha-2 code, so once
// we know someone's code we can find their real shape and place a marker on
// it. CODE_NAMES gives a clean display name for the ones a Discord learner
// is likely to type; COUNTRY_ALIASES maps common spellings/nicknames to a
// code so "USA"/"America"/"United States" all land on the same island.
const CODE_NAMES = {
  tw: 'Taiwan', us: 'USA', nz: 'New Zealand', ph: 'Philippines', id: 'Indonesia', my: 'Malaysia', fr: 'France',
  gb: 'UK', ca: 'Canada', au: 'Australia', jp: 'Japan', kr: 'South Korea', kp: 'North Korea',
  cn: 'China', hk: 'Hong Kong', mo: 'Macau', sg: 'Singapore', th: 'Thailand', vn: 'Vietnam',
  mm: 'Myanmar', kh: 'Cambodia', la: 'Laos', bn: 'Brunei', in: 'India', pk: 'Pakistan',
  bd: 'Bangladesh', lk: 'Sri Lanka', np: 'Nepal', de: 'Germany', es: 'Spain', it: 'Italy',
  pt: 'Portugal', nl: 'Netherlands', be: 'Belgium', ch: 'Switzerland', at: 'Austria', ie: 'Ireland',
  se: 'Sweden', no: 'Norway', dk: 'Denmark', fi: 'Finland', is: 'Iceland', pl: 'Poland',
  cz: 'Czechia', sk: 'Slovakia', hu: 'Hungary', ro: 'Romania', bg: 'Bulgaria', gr: 'Greece',
  tr: 'Turkey', ru: 'Russia', ua: 'Ukraine', mx: 'Mexico', br: 'Brazil', ar: 'Argentina',
  cl: 'Chile', co: 'Colombia', pe: 'Peru', ve: 'Venezuela', ec: 'Ecuador', uy: 'Uruguay',
  py: 'Paraguay', bo: 'Bolivia', cu: 'Cuba', jm: 'Jamaica', do: 'Dominican Republic', eg: 'Egypt',
  za: 'South Africa', ng: 'Nigeria', ke: 'Kenya', ma: 'Morocco', il: 'Israel', sa: 'Saudi Arabia',
  ae: 'UAE', qa: 'Qatar', kw: 'Kuwait', jo: 'Jordan', lb: 'Lebanon', ir: 'Iran', iq: 'Iraq',
  af: 'Afghanistan', kz: 'Kazakhstan', mn: 'Mongolia', pg: 'Papua New Guinea', fj: 'Fiji',
  ws: 'Samoa', to: 'Tonga', pw: 'Palau', gu: 'Guam', lu: 'Luxembourg', mc: 'Monaco',
  li: 'Liechtenstein', ad: 'Andorra', sm: 'San Marino', va: 'Vatican City', mt: 'Malta',
  cy: 'Cyprus', hr: 'Croatia', si: 'Slovenia', rs: 'Serbia', ba: 'Bosnia & Herzegovina',
  al: 'Albania', mk: 'North Macedonia', me: 'Montenegro', ee: 'Estonia', lv: 'Latvia',
  lt: 'Lithuania', by: 'Belarus', md: 'Moldova', ge: 'Georgia', am: 'Armenia', az: 'Azerbaijan',
};

const COUNTRY_ALIASES = {};
Object.entries(CODE_NAMES).forEach(([code, name]) => { COUNTRY_ALIASES[name.toLowerCase()] = code; });
Object.assign(COUNTRY_ALIASES, {
  'united states': 'us', 'usa': 'us', 'u.s.a.': 'us', 'u.s.': 'us', 'america': 'us', 'united states of america': 'us',
  'uk': 'gb', 'u.k.': 'gb', 'britain': 'gb', 'great britain': 'gb', 'england': 'gb',
  'scotland': 'gb', 'wales': 'gb', 'united kingdom': 'gb', 'northern ireland': 'gb',
  'holland': 'nl', 'macao': 'mo', 'burma': 'mm', 'czech republic': 'cz', 'viet nam': 'vn',
  'korea': 'kr', 'south korea': 'kr', 'republic of korea': 'kr', 'korea, south': 'kr',
  'mainland china': 'cn', "people's republic of china": 'cn', 'republic of china': 'tw',
  'uae': 'ae', 'emirates': 'ae', 'dubai': 'ae', 'united arab emirates': 'ae',
  'vatican': 'va', 'holy see': 'va', 'macedonia': 'mk', 'bosnia': 'ba',
  'russian federation': 'ru', 'turkiye': 'tr', 'aotearoa': 'nz', 'the philippines': 'ph',
});

function codeToFlag(code) {
  return code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

// id -> {id, flag, nameEn, mapX, mapY}. mapX/mapY are percentage positions
// (0-100) on the world map stage; refined with real shape positions once
// the world SVG loads (see loadWorldMap/ensureCountryRegistered).
const countryRegistry = new Map();

function registerCountry(id, flag, nameEn, mapX, mapY) {
  if (countryRegistry.has(id)) return countryRegistry.get(id);
  const c = { id, flag, nameEn, mapX, mapY };
  countryRegistry.set(id, c);
  return c;
}

// The quick-pick buttons on the login screen; everyone starts knowing these.
const PRESET_COUNTRY_IDS = ['tw', 'us', 'nz', 'ph', 'id', 'my', 'fr'];
const PRESET_FALLBACK_POSITIONS = {
  tw: [86, 32], us: [20, 32], nz: [93, 82], ph: [78, 46], id: [73, 70], my: [65, 58], fr: [51, 20],
};
PRESET_COUNTRY_IDS.forEach((id) => {
  const [mapX, mapY] = PRESET_FALLBACK_POSITIONS[id];
  registerCountry(id, codeToFlag(id), CODE_NAMES[id] || id.toUpperCase(), mapX, mapY);
});
// Shared catch-all island for anyone whose typed country we can't place for
// real (a typo, or somewhere not in our name list yet).
registerCountry('other', '🌍', 'Other / Elsewhere', 50, 92);

// Set once loadWorldMap() fetches and inlines the real-world SVG; needed by
// normalizeCountryInput and ensureCountryRegistered to look up a country's
// actual drawn shape.
let worldSvgEl = null;

// Turns whatever someone typed into a real ISO country code, or null if we
// can't recognize it (caller falls back to the shared 'other' island).
function normalizeCountryInput(text) {
  const raw = (text || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (/^[a-z]{2}$/i.test(raw) && worldSvgEl && worldSvgEl.querySelector('g#' + raw.toUpperCase())) {
    return raw.toLowerCase();
  }
  return null;
}

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
  { id: 'breakfast', icon: '🍳', label: 'Breakfast Shop' },
  { id: 'gas', icon: '⛽', label: 'Gas Station' },
  { id: 'car', icon: '🚗', label: 'Car' },
  { id: 'bank', icon: '🏦', label: 'Bank' },
  { id: 'cinema', icon: '🎬', label: 'Cinema' },
  { id: 'claw', icon: '🕹️', label: 'Claw Machine Shop' },
  { id: 'pet', icon: '🐾', label: 'Pet House' },
  { id: 'soccer', icon: '⚽', label: 'Soccer Field' },
  { id: 'baseball', icon: '⚾', label: 'Baseball Field' },
  { id: 'park', icon: '🌳', label: 'Park' },
  { id: 'market', icon: '🛒', label: 'Supermarket' },
];
const HOUSE_ICON = '🏠';
const LOT_RADIUS = 0.34; // how far from the house (as a fraction of ONE tile) a decoration may be placed
const MAX_DECORATIONS = 8;

// ---------------- Hex grid (one tile per player, auto-arranged into an island) ----------------
const HEX_DIRS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];
const HEX_SIZE = 46; // base circumradius in layout units, before fit-to-stage scaling

function hexAdd(a, b) { return { q: a.q + b.q, r: a.r + b.r }; }
function hexScale(a, k) { return { q: a.q * k, r: a.r * k }; }

// The Nth tile in an outward hex spiral, starting with the center at N=0.
function spiralAxial(index) {
  if (index === 0) return { q: 0, r: 0 };
  let ring = 1, count = 6, idx = index - 1;
  while (idx >= count) { idx -= count; ring++; count = 6 * ring; }
  let hex = hexScale(HEX_DIRS[4], ring);
  const side = Math.floor(idx / ring);
  const posInSide = idx % ring;
  for (let s = 0; s < side; s++) hex = hexAdd(hex, HEX_DIRS[s]);
  hex = hexAdd(hex, hexScale(HEX_DIRS[side], posInSide));
  return hex;
}

// Flat-top axial -> pixel, centered on (0,0).
function axialToPixel(q, r) {
  return { x: HEX_SIZE * 1.5 * q, y: HEX_SIZE * Math.sqrt(3) * (r + q / 2) };
}

const ONLINE_TIMEOUT_MS = 60000;
const HEARTBEAT_MS = 15000;
const MOVE_SPEED = 160; // px per second
const WRITE_THROTTLE_MS = 300;

// ============================================================
// CHARACTER RENDERING (pixel art on canvas)
// ============================================================

// A denser logical pixel grid than the original 32x40 — more blocks per
// character, room for an outline + simple cel-shading, closer to a chunky
// retro-RPG sprite instead of flat color blocks.
const CHAR_W = 48, CHAR_H = 60;
const OUTLINE = '#1b1420';

function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `rgb(${r},${g},${b})`;
}

// Draws a filled block with a 1px dark halo around it (drawn first, so a
// later block painted on top cleanly covers the halo where they join —
// that's what gives each shape a crisp outline without manual tracing).
function block(ctx, x, y, w, h, color, outline = true) {
  if (outline) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawCharacter(ctx, look) {
  ctx.clearRect(0, 0, CHAR_W, CHAR_H);
  ctx.imageSmoothingEnabled = false;

  const { skin, hairStyle, hairColor, outfitStyle, outfitColor } = look;
  const skinShade = shadeColor(skin, 0.22);
  const hairShade = shadeColor(hairColor, 0.28);
  const outfitShade = shadeColor(outfitColor, 0.28);

  // back hair (behind head)
  if (hairStyle === 'long') {
    block(ctx, 9, 14, 4, 30, hairColor);
    block(ctx, 35, 14, 4, 30, hairColor);
    block(ctx, 35, 14, 2, 30, hairShade, false);
  } else if (hairStyle === 'ponytail') {
    block(ctx, 35, 13, 4, 22, hairColor);
    block(ctx, 37, 33, 4, 6, hairColor);
    block(ctx, 35, 13, 2, 22, hairShade, false);
  }

  // arms
  block(ctx, 5, 34, 6, 14, skin);
  block(ctx, 37, 34, 6, 14, skin);
  block(ctx, 5, 44, 6, 4, skinShade, false);
  block(ctx, 37, 44, 6, 4, skinShade, false);

  // head
  block(ctx, 13, 11, 22, 20, skin);
  block(ctx, 28, 11, 7, 20, skinShade, false); // shadowed side

  // blush
  ctx.fillStyle = '#ff9eb0';
  ctx.fillRect(16, 25, 3, 2);
  ctx.fillRect(29, 25, 3, 2);

  // eyes
  ctx.fillStyle = '#211a1a';
  ctx.fillRect(18, 20, 3, 3);
  ctx.fillRect(27, 20, 3, 3);

  // mouth
  ctx.fillStyle = '#7a3b3b';
  ctx.fillRect(21, 27, 6, 2);

  // front hair (top)
  block(ctx, 12, 7, 24, 8, hairColor);
  if (hairStyle === 'short') {
    block(ctx, 11, 15, 3, 6, hairColor);
    block(ctx, 34, 15, 3, 6, hairColor);
  } else if (hairStyle === 'curly') {
    block(ctx, 10, 9, 5, 5, hairColor);
    block(ctx, 16, 11, 5, 5, hairColor);
    block(ctx, 22, 9, 5, 5, hairColor);
    block(ctx, 28, 11, 5, 5, hairColor);
    block(ctx, 34, 9, 5, 5, hairColor);
  } else if (hairStyle === 'long' || hairStyle === 'ponytail') {
    block(ctx, 11, 15, 3, 6, hairColor);
    block(ctx, 34, 15, 3, 6, hairColor);
  }
  block(ctx, 30, 7, 6, 8, hairShade, false);

  // body / outfit base
  block(ctx, 12, 33, 24, 18, outfitColor);
  block(ctx, 30, 33, 6, 18, outfitShade, false);

  if (outfitStyle === 'hoodie') {
    block(ctx, 12, 29, 6, 6, outfitColor);
    block(ctx, 30, 29, 6, 6, outfitColor);
  } else if (outfitStyle === 'dress') {
    block(ctx, 9, 45, 30, 9, outfitColor);
    block(ctx, 33, 45, 6, 9, outfitShade, false);
  } else if (outfitStyle === 'sporty') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 39, 24, 3);
  }

  // legs / shoes
  block(ctx, 15, 51, 6, 9, '#3a3a52');
  block(ctx, 27, 51, 6, 9, '#3a3a52');
  ctx.fillStyle = '#242436';
  ctx.fillRect(15, 57, 6, 3);
  ctx.fillRect(27, 57, 6, 3);
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
  country: PRESET_COUNTRY_IDS[0],
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
  // Home decoration: the player's own fixed hex tile in their home country's
  // island. Tile position is computed from joinedAt order, not chosen.
  homeCountry: null,
  joinedAt: null,
  decorations: [], // [{type, dx, dy}] offsets from the tile's own center, as a fraction of one tile
  decorateSelected: null, // a BUILDING_TYPES id armed to place next click
  isNight: false,
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
    joinedAt: state.joinedAt,
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
const loginCountrySelect = document.getElementById('loginCountrySelect');
const loginCountryCustom = document.getElementById('loginCountryCustom');

PRESET_COUNTRY_IDS.forEach((id) => {
  const c = countryRegistry.get(id);
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = `${c.flag} ${c.nameEn}`;
  loginCountrySelect.appendChild(opt);
});
const loginCustomOpt = document.createElement('option');
loginCustomOpt.value = '__custom';
loginCustomOpt.textContent = '🌍 Other — type it below';
loginCountrySelect.appendChild(loginCustomOpt);

loginCountrySelect.addEventListener('change', () => {
  const isCustom = loginCountrySelect.value === '__custom';
  loginCountryCustom.style.display = isCustom ? '' : 'none';
  if (isCustom) loginCountryCustom.focus();
});

try {
  const last = localStorage.getItem('pmw_last_name');
  if (last) nameInput.value = last;
  const lastCountry = localStorage.getItem('pmw_last_country');
  if (lastCountry && PRESET_COUNTRY_IDS.includes(lastCountry)) loginCountrySelect.value = lastCountry;
} catch (e) {}

enterBtn.addEventListener('click', onEnter);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') onEnter(); });

// Resolves the login screen's country picker to a real code, registering a
// brand-new one (and falling back to the shared "other" island for a typo
// or an unrecognized place) so it's ready before we need it.
function resolveLoginCountry() {
  let id;
  if (loginCountrySelect.value === '__custom') {
    id = normalizeCountryInput(loginCountryCustom.value) || 'other';
  } else {
    id = loginCountrySelect.value;
  }
  ensureCountryRegistered(id);
  try { localStorage.setItem('pmw_last_country', id); } catch (e) {}
  return id;
}

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
    state.country = existing.country || PRESET_COUNTRY_IDS[0];
    state.x = existing.x ?? 0.5;
    state.y = existing.y ?? 0.5;
    state.homeCountry = existing.homeCountry || existing.country || PRESET_COUNTRY_IDS[0];
    ensureCountryRegistered(state.country);
    ensureCountryRegistered(state.homeCountry);
    // Players from before the island/tile system get a joinedAt now, which
    // puts them at the end of the spiral rather than disturbing anyone else.
    state.joinedAt = existing.joinedAt || Date.now();
    state.decorations = existing.decorations || [];
    persistLocalMemory();
    await pushMyDoc(true);
    enterWorld();
  } else {
    state.isFirstTimeSetup = true;
    state.look = { ...DEFAULT_LOOK };
    state.x = 0.5; state.y = 0.5;
    state.country = resolveLoginCountry();
    state.homeCountry = null;
    state.joinedAt = null;
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
const saveLookBtn = document.getElementById('saveLookBtn');

buildSwatches(skinSwatches, SKIN_COLORS, 'skin');
buildSwatches(hairStyleSwatches, null, 'hairStyle', { shape: true, labels: HAIR_STYLES });
buildSwatches(hairColorSwatches, HAIR_COLORS, 'hairColor');
buildSwatches(outfitStyleSwatches, null, 'outfitStyle', { shape: true, labels: OUTFIT_STYLES });
buildSwatches(outfitColorSwatches, OUTFIT_COLORS, 'outfitColor');

function openCustomizer() {
  refreshSwatchSelection(skinSwatches, state.look.skin);
  refreshSwatchSelection(hairStyleSwatches, state.look.hairStyle);
  refreshSwatchSelection(hairColorSwatches, state.look.hairColor);
  refreshSwatchSelection(outfitStyleSwatches, state.look.outfitStyle);
  refreshSwatchSelection(outfitColorSwatches, state.look.outfitColor);
  redrawPreview();
  showScreen('customizer');
}

// Spawn right-of-center so new/arriving players don't land under the
// bottom-left online panel on narrow viewports.
function spawnX() { return 0.62 + (Math.random() - 0.5) * 0.24; }
function spawnY() { return 0.45 + (Math.random() - 0.5) * 0.3; }

saveLookBtn.addEventListener('click', async () => {
  if (state.isFirstTimeSetup) {
    state.x = spawnX(); state.y = spawnY();
    state.isFirstTimeSetup = false;
    state.homeCountry = state.country;
    state.joinedAt = Date.now();
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
  worldSvgEl = svg;

  const worldRect = svg.querySelector('#World');
  if (worldRect) worldRect.setAttribute('fill', 'none');
  const ocean = svg.querySelector('#Ocean');
  if (ocean) { ocean.setAttribute('fill', '#173a5e'); ocean.setAttribute('stroke', 'none'); }
  const antarctica = svg.querySelector('g#AQ');
  if (antarctica) antarctica.setAttribute('display', 'none');

  // Known/registered-so-far countries get a gold outline; anyone's island
  // typed in later (see ensureCountryRegistered) gets the same treatment
  // applied the moment it's registered.
  const playableIds = new Set([...countryRegistry.keys()].map((id) => id.toUpperCase()));
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

  countryRegistry.forEach((c) => { if (c.id !== 'other') resolveCountryPosition(c); });
  syncCountryRegistryFromPlayers();
  if (state.screen === 'worldmap') renderWorldMap();
}

// Highlights a country's real shape on the map as a playable destination.
function applyPlayableStyle(g) {
  g.querySelectorAll('path').forEach((p) => {
    p.setAttribute('stroke', '#ffd166');
    p.setAttribute('stroke-width', '1.6');
  });
}

// Looks up a country's real drawn shape and refines its marker position
// from a guess to the shape's actual center, once the SVG is loaded.
function resolveCountryPosition(c) {
  if (!worldSvgEl) return;
  const g = worldSvgEl.querySelector('g#' + c.id.toUpperCase());
  if (!g) return;
  applyPlayableStyle(g);
  try {
    const vb = worldSvgEl.viewBox.baseVal;
    const box = g.getBBox();
    if (vb && vb.width && vb.height && box.width && box.height) {
      c.mapX = ((box.x + box.width / 2) / vb.width) * 100;
      c.mapY = ((box.y + box.height / 2) / vb.height) * 100;
    }
  } catch (err) { /* getBBox can throw on a detached/empty group — keep fallback */ }
}

// Registers a country id (any real ISO code, or 'other') so it has a map
// marker and a nameplate-ready name/flag, refining its position from the
// real SVG shape as soon as that's available.
function ensureCountryRegistered(id) {
  if (!id) return countryRegistry.get('other');
  let c = countryRegistry.get(id);
  if (!c) c = registerCountry(id, id === 'other' ? '🌍' : codeToFlag(id), CODE_NAMES[id] || id.toUpperCase(), 50, 50);
  if (id !== 'other') resolveCountryPosition(c);
  return c;
}

// Makes sure every country anyone is currently standing in or living in has
// a registered marker, so a friend's custom-typed country shows up on
// everyone's map, not just the person who typed it.
function syncCountryRegistryFromPlayers() {
  const ids = new Set();
  Object.values(state.players).forEach((p) => {
    if (p.country) ids.add(p.country);
    if (p.homeCountry) ids.add(p.homeCountry);
  });
  ids.forEach((id) => ensureCountryRegistered(id));
}

function onlinePlayers() {
  const now = Date.now();
  // Always count yourself as online — a backgrounded/throttled tab can
  // delay your own heartbeat write past the timeout even while you're
  // still here, which used to make your own avatar vanish.
  return Object.values(state.players).filter(
    (p) => p.nameKey === state.nameKey || now - (p.updatedAt || 0) < ONLINE_TIMEOUT_MS
  );
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
  syncCountryRegistryFromPlayers();
  const counts = {};
  onlinePlayers().forEach((p) => { counts[p.country] = (counts[p.country] || 0) + 1; });

  countryRegistry.forEach((c) => {
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

// ---------------- SCENE (hex island) ----------------

const sceneStage = document.getElementById('sceneStage');
const sceneTilesEl = document.getElementById('sceneTiles');
const sceneHomePlotsEl = document.getElementById('sceneHomePlots');
const sceneAvatarsEl = document.getElementById('sceneAvatars');
const sceneTitle = document.getElementById('sceneTitle');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

const avatarEls = new Map(); // nameKey -> {wrap, canvas, ctx, nameplate, bubble, activity}

function currentCountry() {
  return countryRegistry.get(state.country) || countryRegistry.get(PRESET_COUNTRY_IDS[0]);
}

// The fixed community tile every island starts with, at spiral index 0.
const TOWN_AMENITIES = [
  { icon: '🛒', dx: -0.32, dy: -0.28 },
  { icon: '☕', dx: 0.32, dy: -0.28 },
  { icon: '🌳', dx: -0.32, dy: 0.28 },
  { icon: '⚽', dx: 0.32, dy: 0.28 },
];

// Every player whose home is in this country gets one hex tile, oldest
// joiner first, arranged in an outward spiral around a shared town square.
function getIslandTiles(countryId) {
  const residents = Object.values(state.players)
    .filter((p) => p.homeCountry === countryId)
    .sort((a, b) => (a.joinedAt || Infinity) - (b.joinedAt || Infinity));
  const tiles = [{ kind: 'town' }, ...residents.map((p) => ({ kind: 'player', player: p }))];
  tiles.forEach((t, i) => {
    const { q, r } = spiralAxial(i);
    const px = axialToPixel(q, r);
    t.q = q; t.r = r; t.baseX = px.x; t.baseY = px.y;
  });
  return tiles;
}

// Scales + centers the island's abstract layout to fit the stage currently
// on screen, so it looks right whether there are 1 or 50 residents.
function fitIslandToStage(tiles, rect) {
  const pad = HEX_SIZE * 1.3;
  const xs = tiles.map((t) => t.baseX), ys = tiles.map((t) => t.baseY);
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  let scale = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY));
  scale = Math.max(0.25, Math.min(1.4, scale));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return { scale, originX: rect.width / 2 - cx * scale, originY: rect.height / 2 - cy * scale };
}

let islandTiles = []; // last-rendered tiles for this scene, for proximity checks

function renderIsland() {
  const rect = sceneStage.getBoundingClientRect();
  const tiles = getIslandTiles(state.country);
  const { scale, originX, originY } = fitIslandToStage(tiles, rect);
  const tileW = HEX_SIZE * 2 * scale, tileH = HEX_SIZE * Math.sqrt(3) * scale;
  const houseSize = Math.max(16, 30 * scale), decoSize = Math.max(11, 19 * scale);

  sceneTilesEl.innerHTML = '';
  sceneHomePlotsEl.innerHTML = '';

  tiles.forEach((t) => {
    t.screenX = originX + t.baseX * scale;
    t.screenY = originY + t.baseY * scale;
    t.tileW = tileW; t.tileH = tileH;

    const hexEl = document.createElement('div');
    hexEl.className = 'hex-tile' + (t.kind === 'town' ? ' hex-town' : '');
    hexEl.style.width = `${tileW}px`;
    hexEl.style.height = `${tileH}px`;
    hexEl.style.left = `${t.screenX}px`;
    hexEl.style.top = `${t.screenY}px`;
    if (t.kind === 'player') hexEl.style.background = WORLD_PALETTE[hashStr(t.player.nameKey) % WORLD_PALETTE.length];
    sceneTilesEl.appendChild(hexEl);

    const plot = document.createElement('div');
    plot.className = 'home-plot';

    const house = document.createElement('div');
    house.className = 'house';
    house.style.left = `${t.screenX}px`;
    house.style.top = `${t.screenY}px`;
    house.style.fontSize = `${houseSize}px`;
    house.textContent = t.kind === 'town' ? '🏛️' : HOUSE_ICON;
    plot.appendChild(house);

    const label = document.createElement('div');
    label.className = 'house-label';
    label.style.left = `${t.screenX}px`;
    label.style.top = `${t.screenY}px`;
    label.textContent = t.kind === 'town'
      ? 'Town Square'
      : (t.player.nameKey === state.nameKey ? 'Your home' : `${t.player.name}'s home`);
    plot.appendChild(label);

    const items = t.kind === 'town'
      ? TOWN_AMENITIES
      : (t.player.decorations || []).map((d) => ({ ...d, icon: (BUILDING_TYPES.find((b) => b.id === d.type) || {}).icon })).filter((d) => d.icon);
    items.forEach((d) => {
      const el = document.createElement('div');
      el.className = 'deco';
      el.style.left = `${t.screenX + d.dx * tileW}px`;
      el.style.top = `${t.screenY + d.dy * tileH}px`;
      el.style.fontSize = `${decoSize}px`;
      el.textContent = d.icon;
      plot.appendChild(el);
    });

    sceneHomePlotsEl.appendChild(plot);
  });

  islandTiles = tiles;
}

function nearestZoneLabel(xFrac, yFrac) {
  const rect = sceneStage.getBoundingClientRect();
  const px = xFrac * rect.width, py = yFrac * rect.height;
  for (const t of islandTiles) {
    const d = Math.hypot(px - t.screenX, py - t.screenY);
    if (d < Math.max(t.tileW, t.tileH) * 0.5) {
      return t.kind === 'town' ? '🏛️ at the Town Square' : `📍 at ${t.player.name}'s home`;
    }
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
  canvas.width = CHAR_W; canvas.height = CHAR_H;
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
    const isMe = p.nameKey === state.nameKey;
    const online = isMe || Date.now() - (p.updatedAt || 0) < ONLINE_TIMEOUT_MS;
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
    renderIsland();
    renderSceneAvatars();
  });
}

// ---------------- Day / night ----------------

const dayNightBtn = document.getElementById('dayNightBtn');
try { state.isNight = localStorage.getItem('pmw_night') === '1'; } catch (e) {}

function applyDayNight() {
  sceneStage.classList.toggle('night', state.isNight);
  dayNightBtn.querySelector('.bicon').textContent = state.isNight ? '☀️' : '🌙';
  dayNightBtn.querySelector('.blabel').textContent = state.isNight ? ' Day' : ' Night';
}
dayNightBtn.addEventListener('click', () => {
  state.isNight = !state.isNight;
  try { localStorage.setItem('pmw_night', state.isNight ? '1' : '0'); } catch (e) {}
  applyDayNight();
});
applyDayNight();

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
// Your home's tile position on the island is automatic (join order); this
// screen is just for choosing what to put on your own tile.

const decorateStage = document.getElementById('decorateStage');
const decorateTileEl = document.getElementById('decorateTile');
const decorateMyHomeEl = document.getElementById('decorateMyHome');
const decorateTitle = document.getElementById('decorateTitle');
const decorateHint = document.getElementById('decorateHint');
const decoratePaletteEl = document.getElementById('decoratePalette');
let decorateReturnTo = 'worldmap';

function homeCountryObj() {
  return countryRegistry.get(state.homeCountry) || currentCountry();
}

function openDecorate(returnTo) {
  decorateReturnTo = returnTo;
  state.decorateSelected = null;
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

  // The tile fills most of the stage here — this is a zoomed-in editor for
  // just your own tile, not the whole island.
  const tileH = Math.min(rect.height * 0.85, rect.width * 0.7);
  const tileW = tileH * (2 / Math.sqrt(3));
  const cx = rect.width / 2, cy = rect.height / 2;
  decorateTileEl.style.width = `${tileW}px`;
  decorateTileEl.style.height = `${tileH}px`;
  decorateTileEl.style.background = WORLD_PALETTE[hashStr(state.nameKey) % WORLD_PALETTE.length];

  // palette selection highlight
  [...decoratePaletteEl.children].forEach((el) => {
    const isNone = !el.dataset.id;
    el.classList.toggle('selected', isNone ? !state.decorateSelected : el.dataset.id === state.decorateSelected);
  });

  // hint text
  if (state.decorateSelected) {
    const bt = BUILDING_TYPES.find((b) => b.id === state.decorateSelected);
    decorateHint.textContent = `Click your tile to place a ${bt.label} (${state.decorations.length}/${MAX_DECORATIONS})`;
  } else {
    decorateHint.textContent = `Pick something below, then click your tile to place it. Click a placed item to remove it.`;
  }

  decorateMyHomeEl.innerHTML = '';

  const house = document.createElement('div');
  house.className = 'house';
  house.style.left = `${cx}px`;
  house.style.top = `${cy}px`;
  house.textContent = HOUSE_ICON;
  decorateMyHomeEl.appendChild(house);

  const label = document.createElement('div');
  label.className = 'house-label';
  label.style.left = `${cx}px`;
  label.style.top = `${cy}px`;
  label.textContent = 'Your home';
  decorateMyHomeEl.appendChild(label);

  state.decorations.forEach((d, i) => {
    const bt = BUILDING_TYPES.find((b) => b.id === d.type);
    if (!bt) return;
    const el = document.createElement('div');
    el.className = 'deco';
    el.style.left = `${cx + d.dx * tileW}px`;
    el.style.top = `${cy + d.dy * tileH}px`;
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
}

decorateStage.addEventListener('click', async (e) => {
  if (!state.decorateSelected) return;
  if (state.decorations.length >= MAX_DECORATIONS) {
    decorateHint.textContent = `You've placed the max of ${MAX_DECORATIONS} — remove one to add another.`;
    return;
  }
  const rect = decorateStage.getBoundingClientRect();
  const tileRect = decorateTileEl.getBoundingClientRect();
  const cx = tileRect.left + tileRect.width / 2 - rect.left;
  const cy = tileRect.top + tileRect.height / 2 - rect.top;
  let dx = (e.clientX - rect.left - cx) / tileRect.width;
  let dy = (e.clientY - rect.top - cy) / tileRect.height;
  const dist = Math.hypot(dx, dy);
  if (dist > LOT_RADIUS) { dx = (dx / dist) * LOT_RADIUS; dy = (dy / dist) * LOT_RADIUS; }
  state.decorations.push({ type: state.decorateSelected, dx, dy });
  await pushMyDoc(true);
  renderDecorateScreen();
});

document.getElementById('decorateBackBtn').addEventListener('click', () => {
  if (decorateReturnTo === 'scene') enterScene();
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
  countryRegistry.forEach((c) => {
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
  syncCountryRegistryFromPlayers();

  if (state.nameKey && !state.kicked) {
    const mine = all[state.nameKey];
    if (mine && mine.sessionId && state.sessionId && mine.sessionId !== state.sessionId) {
      handleKicked();
      return;
    }
  }

  if (state.screen === 'worldmap') renderWorldMap();
  if (state.screen === 'scene') { renderIsland(); renderSceneAvatars(); }
  if (state.screen === 'decorate') renderDecorateScreen();
  renderOnlinePanel();
}

async function boot() {
  loadWorldMap(); // runs in the background; login takes longer than this fetch
  await initBackend();
  backend.subscribe(onPlayersUpdate);
  setInterval(() => { if (state.nameKey) pushMyDoc(true); }, HEARTBEAT_MS);
  // Background tabs can throttle the interval above; catch up the instant
  // the tab is looked at again so you don't sit "stale" longer than needed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.nameKey) pushMyDoc(true);
  });
  showScreen('login');
}

boot();
