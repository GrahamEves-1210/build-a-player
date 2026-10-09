// The shop's catalog (app): everything you can buy with coins, earn from
// achievements, or unlock with BAP Pro. Pure data — prices, rarity, what each
// item looks like (CSS classes in app-shop.css, glyphs in NameTag.jsx, victory
// effects and sounds in juice.js).
//
//   slot     avatar · nameColor · nameFx · plate · winFx · winSound
//   rarity   0 common · 1 rare · 2 epic · 3 legendary
//   pro      BAP Pro members only (the Pro Vault)
//   level    unlocks at a level (still bought with coins)
//   ach      an achievement reward — never sold

export const SLOTS = [
  { id: 'avatar',    label: 'Avatars',      short: 'AVATAR' },
  { id: 'nameColor', label: 'Name Color',   short: 'COLOR' },
  { id: 'nameFx',    label: 'Name FX',      short: 'EFFECT' },
  { id: 'plate',     label: 'Nameplates',   short: 'PLATE' },
  { id: 'winFx',     label: 'Victory FX',   short: 'VICTORY' },
  { id: 'winSound',  label: 'Victory Sound', short: 'SOUND' },
]
export const RARITY = [
  { id: 0, name: 'Common',    color: '#9fb3a8' },
  { id: 1, name: 'Rare',      color: '#4ea8ff' },
  { id: 2, name: 'Epic',      color: '#b678ff' },
  { id: 3, name: 'Legendary', color: '#f2c94c' },
]
// What everyone starts with (free, always owned)
export const DEFAULTS = { avatar: null, nameColor: null, nameFx: null, plate: null, winFx: 'fx-confetti', winSound: 'snd-horn' }

const it = (slot, id, name, rarity, price, extra = {}) => ({ slot, id, name, rarity, price, ...extra })

// ── Avatars: a glyph on a colorway ───────────────────────────────────────────
// glyph: football basketball helmet crown flame bolt star trophy medal ring
//        target shield coin podium whistle hoop clipboard versus mono (your initial)
const AV = [
  it('avatar', 'av-pigskin',   'Pigskin',        0, 150, { glyph: 'football', pal: 'mint' }),
  it('avatar', 'av-rock',      'The Rock',       0, 150, { glyph: 'basketball', pal: 'sunset' }),
  it('avatar', 'av-north',     'North Star',     0, 180, { glyph: 'star', pal: 'ice' }),
  it('avatar', 'av-jolt',      'Jolt',           0, 180, { glyph: 'bolt', pal: 'royal' }),
  it('avatar', 'av-bullseye',  'Bullseye',       0, 200, { glyph: 'target', pal: 'crimson' }),
  it('avatar', 'av-wall',      'The Wall',       0, 200, { glyph: 'shield', pal: 'onyx' }),
  it('avatar', 'av-playbook',  'Playbook',       0, 220, { glyph: 'clipboard', pal: 'turf' }),
  it('avatar', 'av-whistle',   'Whistle',        0, 220, { glyph: 'whistle', pal: 'silver' }),
  it('avatar', 'av-helmet',    'Lid',            0, 250, { glyph: 'helmet', pal: 'royal' }),
  it('avatar', 'av-hoop',      'Bottom of the Net', 0, 250, { glyph: 'hoop', pal: 'sunset' }),
  it('avatar', 'av-royalty',   'Royalty',        1, 450, { glyph: 'crown', pal: 'violet' }),
  it('avatar', 'av-heatcheck', 'Heat Check',     1, 450, { glyph: 'flame', pal: 'lava' }),
  it('avatar', 'av-podium',    'Podium Finish',  1, 500, { glyph: 'podium', pal: 'gold' }),
  it('avatar', 'av-hardware',  'Hardware',       1, 520, { glyph: 'trophy', pal: 'ice' }),
  it('avatar', 'av-rivalry',   'Rivalry Week',   1, 520, { glyph: 'versus', pal: 'crimson' }),
  it('avatar', 'av-bag',       'Secure the Bag', 1, 560, { glyph: 'coin', pal: 'gold' }),
  it('avatar', 'av-ringchaser','Ring Chaser',    1, 600, { glyph: 'ring', pal: 'royal' }),
  it('avatar', 'av-medal',     'All-Pro',        1, 600, { glyph: 'medal', pal: 'mint' }),
  it('avatar', 'av-mono-gold', 'Gold Monogram',  1, 650, { glyph: 'mono', pal: 'gold' }),
  it('avatar', 'av-inferno',   'Inferno',        2, 950, { glyph: 'flame', pal: 'inferno', anim: 'flicker' }),
  it('avatar', 'av-storm',     'Thunderstorm',   2, 950, { glyph: 'bolt', pal: 'storm', anim: 'flash' }),
  it('avatar', 'av-crowned',   'Crowned',        2, 1100, { glyph: 'crown', pal: 'gold', anim: 'shine' }),
  it('avatar', 'av-chrome',    'Chrome Dome',    2, 1100, { glyph: 'helmet', pal: 'chrome', anim: 'shine' }),
  it('avatar', 'av-mono-neon', 'Neon Monogram',  2, 1200, { glyph: 'mono', pal: 'neon', anim: 'pulse' }),
  it('avatar', 'av-glacier',   'Glacier',        2, 1200, { glyph: 'star', pal: 'glacier', anim: 'shine' }),
  it('avatar', 'av-goat',      'G.O.A.T.',       3, 2400, { glyph: 'crown', pal: 'holo', anim: 'holo', level: 20 }),
  it('avatar', 'av-galaxy',    'Galaxy Brain',   3, 2600, { glyph: 'star', pal: 'galaxy', anim: 'spin' }),
  it('avatar', 'av-trophy-gold', 'Lombardi Gold', 3, 2800, { glyph: 'trophy', pal: 'gold', anim: 'shine', level: 30 }),
  it('avatar', 'av-pro-diamond', 'Diamond',      3, 1800, { glyph: 'mono', pal: 'diamond', anim: 'shine', pro: true }),
  it('avatar', 'av-pro-blackgold', 'Black & Gold', 2, 900, { glyph: 'crown', pal: 'blackgold', pro: true }),
  it('avatar', 'av-dynasty',   'Dynasty',        3, 0, { glyph: 'ring', pal: 'holo', anim: 'holo', ach: 'rings5' }),
  it('avatar', 'av-perfect',   'Perfect Season', 3, 0, { glyph: 'shield', pal: 'gold', anim: 'shine', ach: 'perfect' }),
]

// ── Name colors ──────────────────────────────────────────────────────────────
const NC = [
  it('nameColor', 'nc-mint',    'Mint',        0, 120),
  it('nameColor', 'nc-ice',     'Ice',         0, 120),
  it('nameColor', 'nc-sky',     'Sky',         0, 120),
  it('nameColor', 'nc-gold',    'Gold',        0, 160),
  it('nameColor', 'nc-crimson', 'Crimson',     0, 160),
  it('nameColor', 'nc-orange',  'Hardwood Orange', 0, 160),
  it('nameColor', 'nc-lime',    'Volt',        0, 160),
  it('nameColor', 'nc-rose',    'Rose',        0, 160),
  it('nameColor', 'nc-violet',  'Violet',      0, 180),
  it('nameColor', 'nc-silver',  'Silver',      0, 180),
  it('nameColor', 'nc-sunset',  'Sunset',      1, 380),
  it('nameColor', 'nc-ocean',   'Deep Ocean',  1, 380),
  it('nameColor', 'nc-aurora',  'Aurora',      1, 420),
  it('nameColor', 'nc-lava',    'Lava',        1, 420),
  it('nameColor', 'nc-turf',    'Turf',        1, 380),
  it('nameColor', 'nc-neon',    'Neon',        2, 800),
  it('nameColor', 'nc-chrome',  'Chrome',      2, 900),
  it('nameColor', 'nc-prism',   'Prism',       2, 950),
  it('nameColor', 'nc-holo',    'Holo',        3, 2000, { level: 15 }),
  it('nameColor', 'nc-pro-blackgold', 'Black Gold', 2, 700, { pro: true }),
  it('nameColor', 'nc-pro-platinum',  'Platinum',   3, 1500, { pro: true }),
  it('nameColor', 'nc-fivetool', 'Five-Tool',  3, 0, { ach: 'fivetool' }),
  it('nameColor', 'nc-compete',  'Pool Shark', 3, 0, { ach: 'cpwin10' }),
]

// ── Name effects ─────────────────────────────────────────────────────────────
const NFX = [
  it('nameFx', 'nfx-glow',     'Glow',          0, 250),
  it('nameFx', 'nfx-legend',   'Legend',        3, 0, { ach: 'legendtier' }),
  it('nameFx', 'nfx-shadow',   'Block Shadow',  0, 250),
  it('nameFx', 'nfx-outline',  'Outline',       0, 280),
  it('nameFx', 'nfx-pulse',    'Pulse',         1, 500),
  it('nameFx', 'nfx-shimmer',  'Shimmer',       1, 600),
  it('nameFx', 'nfx-wave',     'Wave',          1, 600),
  it('nameFx', 'nfx-frost',    'Frost',         1, 650),
  it('nameFx', 'nfx-neon',     'Neon Flicker',  2, 1000),
  it('nameFx', 'nfx-glitch',   'Glitch',        2, 1100),
  it('nameFx', 'nfx-heat',     'Heat Haze',     2, 1100),
  it('nameFx', 'nfx-electric', 'Electric',      3, 2200, { level: 25 }),
  it('nameFx', 'nfx-spotlight','Spotlight',     3, 2400),
  it('nameFx', 'nfx-pro-aura', 'Pro Aura',      3, 1600, { pro: true }),
]

// ── Nameplates (behind your name) ────────────────────────────────────────────
const PL = [
  it('plate', 'pl-carbon',     'Carbon Fiber',    0, 200),
  it('plate', 'pl-hardwood',   'Hardwood',        0, 200),
  it('plate', 'pl-turf',       'Turf',            0, 200),
  it('plate', 'pl-chalk',      'Chalk Talk',      0, 260),
  it('plate', 'pl-varsity',    'Varsity Stripes', 0, 260),
  it('plate', 'pl-mesh',       'Jersey Mesh',     0, 280),
  it('plate', 'pl-blueprint',  'Blueprint',       1, 500),
  it('plate', 'pl-marble',     'Marble',          1, 550),
  it('plate', 'pl-diamond',    'Diamond Plate',   1, 550),
  it('plate', 'pl-sunset',     'Retro Sunset',    1, 600),
  it('plate', 'pl-scoreboard', 'Scoreboard',      1, 650),
  it('plate', 'pl-ice',        'Frozen Tundra',   1, 650),
  it('plate', 'pl-goldbar',    'Gold Bar',        2, 1000),
  it('plate', 'pl-neongrid',   'Neon Grid',       2, 1150),
  it('plate', 'pl-lava',       'Lava Flow',       2, 1200),
  it('plate', 'pl-stadium',    'Stadium Lights',  2, 1300),
  it('plate', 'pl-galaxy',     'Galaxy',          3, 2500),
  it('plate', 'pl-hof',        'Hall of Fame',    3, 2800, { level: 40 }),
  it('plate', 'pl-pro-blackgold', 'Pro Black Gold', 2, 900, { pro: true }),
  it('plate', 'pl-pro-holo',   'Pro Holo',        3, 1800, { pro: true }),
  it('plate', 'pl-perfect',    'Perfect Season',  3, 0, { ach: 'perfect' }),
  it('plate', 'pl-blacktop',   'Blacktop King',   3, 0, { ach: 'bt25' }),
  it('plate', 'pl-allstar',    'All-Star',        3, 0, { ach: 'allstar' }),
]

// ── Victory animations (season titles, awards, wins in live modes) ─────────
const WF = [
  it('winFx', 'fx-confetti',  'Confetti',       0, 0, { free: true }),
  it('winFx', 'fx-streamers', 'Streamers',      0, 300),
  it('winFx', 'fx-snow',      'Snow Globe',     1, 500),
  it('winFx', 'fx-goldrain',  'Gold Rain',      1, 700),
  it('winFx', 'fx-shockwave', 'Shockwave',      1, 700),
  it('winFx', 'fx-fireworks', 'Fireworks',      2, 1200),
  it('winFx', 'fx-lightning', 'Lightning',      2, 1300),
  it('winFx', 'fx-spotlights','Spotlights',     2, 1300),
  it('winFx', 'fx-flames',    'Flame Burst',    3, 2400),
  it('winFx', 'fx-lasers',    'Laser Show',     3, 2600, { level: 35 }),
  it('winFx', 'fx-pro-supernova', 'Supernova',  3, 2000, { pro: true }),
]

// ── Victory sounds ───────────────────────────────────────────────────────────
const WS = [
  it('winSound', 'snd-horn',      'Air Horn',      0, 0, { free: true }),
  it('winSound', 'snd-roar',      'Stadium Roar',  0, 300),
  it('winSound', 'snd-fanfare',   'Brass Fanfare', 1, 500),
  it('winSound', 'snd-drumline',  'Drumline',      1, 600),
  it('winSound', 'snd-organ',     'Organ Charge',  1, 650),
  it('winSound', 'snd-riser',     'Synth Riser',   2, 1000),
  it('winSound', 'snd-cannon',    'Cannon Blast',  2, 1100),
  it('winSound', 'snd-pizzi',     'String Section', 1, 550),
  it('winSound', 'snd-sax',       'Sax Solo',      2, 900),
  it('winSound', 'snd-train',     'Train Horn',    2, 1200),
  it('winSound', 'snd-bassdrop',  'Bass Drop',     3, 2200),
  it('winSound', 'snd-pro-anthem','Pro Anthem',    3, 1800, { pro: true }),
]

export const ITEMS = [...AV, ...NC, ...NFX, ...PL, ...WF, ...WS]
const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]))
export const itemById = id => (id ? BY_ID[id] ?? null : null)
export const itemsFor = slot => ITEMS.filter(i => i.slot === slot)
export const isFree = i => !!i?.free
export const forSale = i => !!i && !i.ach && !i.free

// One line of copy for the detail sheet
export const BLURB = {
  avatar: 'Your profile picture: on your player card, in chat and on the Blacktop.',
  nameColor: 'The color of your username everywhere it shows.',
  nameFx: 'An effect on your username. Stacks with any color.',
  plate: 'A nameplate behind your username on your card, in chat and in lobbies.',
  winFx: 'Plays when you win: titles, awards, Takeover cities and Blacktop games.',
  winSound: 'The sound of your wins, played with your victory effect.',
}
