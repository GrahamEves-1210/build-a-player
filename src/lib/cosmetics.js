// The shop's catalog (app): everything you can buy with coins, earn from
// achievements, or unlock with BAP Pro. Pure data — prices, rarity, what each
// item looks like (CSS classes in app-shop.css, glyphs in NameTag.jsx, victory
// effects and sounds in juice.js).
//
//   slot     avatar · nameColor · nameFx · plate · winFx · winSound · court
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
  { id: 'court',     label: 'Courts',        short: 'COURT' },
]
export const RARITY = [
  { id: 0, name: 'Common',    color: '#9fb3a8' },
  { id: 1, name: 'Rare',      color: '#4ea8ff' },
  { id: 2, name: 'Epic',      color: '#b678ff' },
  { id: 3, name: 'Legendary', color: '#f2c94c' },
]
// What everyone starts with (free, always owned)
export const DEFAULTS = { avatar: null, nameColor: null, nameFx: null, plate: null, winFx: 'fx-confetti', winSound: 'snd-horn', court: 'ct-blacktop' }

const it = (slot, id, name, rarity, price, extra = {}) => ({ slot, id, name, rarity, price, ...extra })

// ── Avatars: a glyph on a colorway ───────────────────────────────────────────
// glyph: football basketball helmet crown flame bolt star trophy medal ring
//        target shield coin podium whistle hoop clipboard versus mono (your initial)
const AV = [
  it('avatar', 'av-pigskin',   'Pigskin', 0, 350, { glyph: 'football', pal: 'mint' }),
  it('avatar', 'av-rock',      'The Rock', 0, 350, { glyph: 'basketball', pal: 'sunset' }),
  it('avatar', 'av-north',     'North Star', 0, 400, { glyph: 'star', pal: 'ice' }),
  it('avatar', 'av-jolt',      'Jolt', 0, 400, { glyph: 'bolt', pal: 'royal' }),
  it('avatar', 'av-bullseye',  'Bullseye', 0, 500, { glyph: 'target', pal: 'crimson' }),
  it('avatar', 'av-wall',      'The Wall', 0, 500, { glyph: 'shield', pal: 'onyx' }),
  it('avatar', 'av-playbook',  'Playbook', 0, 550, { glyph: 'clipboard', pal: 'turf' }),
  it('avatar', 'av-whistle',   'Whistle', 0, 550, { glyph: 'whistle', pal: 'silver' }),
  it('avatar', 'av-helmet',    'Lid', 0, 600, { glyph: 'helmet', pal: 'royal' }),
  it('avatar', 'av-hoop',      'Bottom of the Net', 0, 650, { glyph: 'hoop', pal: 'sunset' }),
  it('avatar', 'av-royalty',   'Royalty', 1, 1400, { glyph: 'crown', pal: 'violet' }),
  it('avatar', 'av-heatcheck', 'Heat Check', 1, 1600, { glyph: 'flame', pal: 'lava' }),
  it('avatar', 'av-podium',    'Podium Finish', 1, 1600, { glyph: 'podium', pal: 'gold' }),
  it('avatar', 'av-hardware',  'Hardware', 1, 1700, { glyph: 'trophy', pal: 'ice' }),
  it('avatar', 'av-rivalry',   'Rivalry Week', 1, 1800, { glyph: 'versus', pal: 'crimson' }),
  it('avatar', 'av-bag',       'Secure the Bag', 1, 1900, { glyph: 'coin', pal: 'gold' }),
  it('avatar', 'av-ringchaser','Ring Chaser', 1, 2200, { glyph: 'ring', pal: 'royal' }),
  it('avatar', 'av-medal',     'All-Pro', 1, 2200, { glyph: 'medal', pal: 'mint' }),
  it('avatar', 'av-mono-gold', 'Gold Monogram', 1, 2400, { glyph: 'mono', pal: 'gold' }),
  it('avatar', 'av-inferno',   'Inferno', 2, 5400, { glyph: 'flame', pal: 'inferno', anim: 'flicker' }),
  it('avatar', 'av-storm',     'Thunderstorm', 2, 5800, { glyph: 'bolt', pal: 'storm', anim: 'flash' }),
  it('avatar', 'av-crowned',   'Crowned', 2, 6600, { glyph: 'crown', pal: 'gold', anim: 'shine' }),
  it('avatar', 'av-chrome',    'Chrome Dome', 2, 6200, { glyph: 'helmet', pal: 'chrome', anim: 'shine' }),
  it('avatar', 'av-mono-neon', 'Neon Monogram', 2, 7200, { glyph: 'mono', pal: 'neon', anim: 'pulse' }),
  it('avatar', 'av-glacier',   'Glacier', 2, 6000, { glyph: 'star', pal: 'glacier', anim: 'shine' }),
  it('avatar', 'av-goat',      'G.O.A.T.', 3, 19000, { glyph: 'crown', pal: 'holo', anim: 'holo', level: 20 }),
  it('avatar', 'av-galaxy',    'Galaxy Brain', 3, 26500, { glyph: 'star', pal: 'galaxy', anim: 'spin' }),
  it('avatar', 'av-trophy-gold', 'Lombardi Gold', 3, 23000, { glyph: 'trophy', pal: 'gold', anim: 'shine', level: 30 }),
  it('avatar', 'av-pro-diamond', 'Diamond', 3, 17000, { glyph: 'mono', pal: 'diamond', anim: 'shine', pro: true }),
  it('avatar', 'av-pro-blackgold', 'Black & Gold', 2, 5000, { glyph: 'crown', pal: 'blackgold', pro: true }),
  it('avatar', 'av-dynasty',   'Dynasty',        3, 0, { glyph: 'ring', pal: 'holo', anim: 'holo', ach: 'rings5' }),
  it('avatar', 'av-perfect',   'Perfect Season', 3, 0, { glyph: 'shield', pal: 'gold', anim: 'shine', ach: 'perfect' }),
]

// ── Name colors ──────────────────────────────────────────────────────────────
const NC = [
  it('nameColor', 'nc-mint',    'Mint', 0, 350),
  it('nameColor', 'nc-ice',     'Ice', 0, 350),
  it('nameColor', 'nc-sky',     'Sky', 0, 350),
  it('nameColor', 'nc-gold',    'Gold', 0, 400),
  it('nameColor', 'nc-crimson', 'Crimson', 0, 400),
  it('nameColor', 'nc-orange',  'Hardwood Orange', 0, 400),
  it('nameColor', 'nc-lime',    'Volt', 0, 500),
  it('nameColor', 'nc-rose',    'Rose', 0, 500),
  it('nameColor', 'nc-violet',  'Violet', 0, 550),
  it('nameColor', 'nc-silver',  'Silver', 0, 550),
  it('nameColor', 'nc-sunset',  'Sunset', 1, 1400),
  it('nameColor', 'nc-ocean',   'Deep Ocean', 1, 1600),
  it('nameColor', 'nc-aurora',  'Aurora', 1, 2000),
  it('nameColor', 'nc-lava',    'Lava', 1, 1800),
  it('nameColor', 'nc-turf',    'Turf', 1, 1400),
  it('nameColor', 'nc-neon',    'Neon', 2, 5400),
  it('nameColor', 'nc-chrome',  'Chrome', 2, 6200),
  it('nameColor', 'nc-prism',   'Prism', 2, 7200),
  it('nameColor', 'nc-holo',    'Holo', 3, 19000, { level: 15 }),
  it('nameColor', 'nc-pro-blackgold', 'Black Gold', 2, 4800, { pro: true }),
  it('nameColor', 'nc-pro-platinum',  'Platinum', 3, 15500, { pro: true }),
  it('nameColor', 'nc-fivetool', 'Color Block',  3, 0, { ach: 'fivetool' }),
  it('nameColor', 'nc-compete',  'Pool Shark', 3, 0, { ach: 'cpwin10' }),
]

// ── Name effects ─────────────────────────────────────────────────────────────
const NFX = [
  it('nameFx', 'nfx-glow',     'Glow', 0, 600),
  it('nameFx', 'nfx-legend',   'Legend',        3, 0, { ach: 'legendtier' }),
  it('nameFx', 'nfx-shadow',   'Block Shadow', 0, 550),
  it('nameFx', 'nfx-outline',  'Outline', 0, 600),
  it('nameFx', 'nfx-pulse',    'Pulse', 1, 1600),
  it('nameFx', 'nfx-shimmer',  'Shimmer', 1, 1900),
  it('nameFx', 'nfx-wave',     'Wave', 1, 1800),
  it('nameFx', 'nfx-frost',    'Frost', 1, 2200),
  it('nameFx', 'nfx-neon',     'Neon Flicker', 2, 6000),
  it('nameFx', 'nfx-glitch',   'Glitch', 2, 7200),
  it('nameFx', 'nfx-heat',     'Heat Haze', 2, 6600),
  it('nameFx', 'nfx-electric', 'Electric', 3, 21500, { level: 25 }),
  it('nameFx', 'nfx-spotlight','Spotlight', 3, 24000),
  it('nameFx', 'nfx-pro-aura', 'Pro Aura', 3, 17000, { pro: true }),
]

// ── Nameplates (behind your name) ────────────────────────────────────────────
const PL = [
  it('plate', 'pl-carbon',     'Carbon Fiber', 0, 400),
  it('plate', 'pl-hardwood',   'Hardwood', 0, 400),
  it('plate', 'pl-turf',       'Turf', 0, 400),
  it('plate', 'pl-chalk',      'Chalk Talk', 0, 550),
  it('plate', 'pl-varsity',    'Varsity Stripes', 0, 550),
  it('plate', 'pl-mesh',       'Jersey Mesh', 0, 650),
  it('plate', 'pl-blueprint',  'Blueprint', 1, 1600),
  it('plate', 'pl-marble',     'Marble', 1, 1700),
  it('plate', 'pl-diamond',    'Diamond Plate', 1, 1800),
  it('plate', 'pl-sunset',     'Retro Sunset', 1, 1900),
  it('plate', 'pl-scoreboard', 'Scoreboard', 1, 2300),
  it('plate', 'pl-ice',        'Frozen Tundra', 1, 2200),
  it('plate', 'pl-goldbar',    'Gold Bar', 2, 5800),
  it('plate', 'pl-neongrid',   'Neon Grid', 2, 6600),
  it('plate', 'pl-lava',       'Lava Flow', 2, 7200),
  it('plate', 'pl-stadium',    'Stadium Lights', 2, 8200),
  it('plate', 'pl-galaxy',     'Galaxy', 3, 21500),
  it('plate', 'pl-hof',        'Hall of Fame', 3, 29000, { level: 40 }),
  it('plate', 'pl-pro-blackgold', 'Pro Black Gold', 2, 5000, { pro: true }),
  it('plate', 'pl-pro-holo',   'Pro Holo', 3, 17000, { pro: true }),
  it('plate', 'pl-perfect',    'Perfect Season',  3, 0, { ach: 'perfect' }),
  it('plate', 'pl-blacktop',   'Blacktop King',   3, 0, { ach: 'bt25' }),
  it('plate', 'pl-allstar',    'All-Star',        3, 0, { ach: 'allstar' }),
]

// ── Victory animations (season titles, awards, wins in live modes) ─────────
const WF = [
  it('winFx', 'fx-confetti',  'Confetti',       0, 0, { free: true }),
  it('winFx', 'fx-streamers', 'Streamers', 0, 700),
  it('winFx', 'fx-snow',      'Snow Globe', 1, 1800),
  it('winFx', 'fx-goldrain',  'Gold Rain', 1, 2300),
  it('winFx', 'fx-shockwave', 'Shockwave', 1, 2600),
  it('winFx', 'fx-fireworks', 'Fireworks', 2, 6000),
  it('winFx', 'fx-lightning', 'Lightning', 2, 7800),
  it('winFx', 'fx-spotlights','Spotlights', 2, 7000),
  it('winFx', 'fx-flames',    'Flame Burst', 3, 21500),
  it('winFx', 'fx-lasers',    'Laser Show', 3, 30000, { level: 35 }),
  it('winFx', 'fx-pro-supernova', 'Supernova', 3, 19000, { pro: true }),
]

// ── Victory sounds ───────────────────────────────────────────────────────────
const WS = [
  it('winSound', 'snd-horn',      'Air Horn',      0, 0, { free: true }),
  it('winSound', 'snd-fanfare',   'Brass Fanfare', 1, 1600),
  it('winSound', 'snd-drumline',  'Drumline', 1, 1900),
  it('winSound', 'snd-organ',     'Organ Charge', 1, 2000),
  it('winSound', 'snd-riser',     'Synth Riser', 2, 6000),
  it('winSound', 'snd-cannon',    'Cannon Blast', 2, 7200),
  it('winSound', 'snd-train',     'Train Horn', 2, 7800),
  it('winSound', 'snd-bassdrop',  'Bass Drop', 3, 21500),
  it('winSound', 'snd-badge',     'Badge Pop', 0, 550),
  it('winSound', 'snd-zoom',      'Zoom By', 1, 1700),
  it('winSound', 'snd-shutter',   'Photo Finish', 1, 1800),
  it('winSound', 'snd-strike',    'Strike', 1, 2200),
  it('winSound', 'snd-nope',      'Not In My House', 1, 2400),
  it('winSound', 'snd-bell',      "Winner's Bell", 2, 4800),
  it('winSound', 'snd-rocket',    'Thunderclap', 2, 6600),
  it('winSound', 'snd-rise',      'The Big Rise', 3, 15500),
]

// ── Courts: the floor Blacktop is played on (every design shares the same lines,
// so the players' spots line up on each). img: the court; thumb: the shop card.
const ct = (id, name, rarity, price) => it('court', id, name, rarity, price, { img: `/courts/${id}.webp`, thumb: `/courts/thumbs/${id}.webp` })
const CT = [
  // cities, then seasons, then the rest (the free Blacktop leads the rest)
  ct('ct-overcast', 'NYC', 0, 2500),
  ct('ct-midnight', 'London', 0, 2500),
  ct('ct-autumn', 'Chicago', 1, 5000),
  ct('ct-nightrain', 'Tokyo', 1, 5000),
  ct('ct-redzone', 'Shanghai', 1, 5000),
  ct('ct-harbor', 'Pier', 1, 5000),
  ct('ct-carnival', 'Rio', 2, 9000),
  ct('ct-goldenhour', 'Honolulu', 2, 9000),
  ct('ct-tropic', 'Miami', 2, 9000),
  ct('ct-oldstone', 'Olympus', 2, 9000),
  ct('ct-retro', 'Los Angeles', 3, 16000),
  ct('ct-alley', 'Spring', 0, 2500),
  ct('ct-ivy', 'Summer', 0, 2500),
  ct('ct-snow', 'Winter', 1, 5000),
  it('court', 'ct-blacktop', 'Blacktop', 0, 0, { free: true, img: '/court-blacktop1.webp', thumb: '/courts/thumbs/ct-blacktop.webp' }),
  ct('ct-warehouse', 'Warehouse', 1, 5000),
  ct('ct-checker', 'Checkerboard', 2, 9000),
  ct('ct-neon', 'Neon Circuit', 3, 16000),
  ct('ct-marble', 'Emerald Marble', 3, 16000),
  ct('ct-space', 'Deep Space', 3, 16000),
]

// ── Unlocks: not looks, features. Sandbox in Career and in Takeover, bought one
// mode at a time (the switch is on the build screen; turning it on asks to buy)
export const UNLOCK_PRICE = 7500
const UL = [
  it('unlock', 'sandbox-career', 'Career Sandbox', 3, UNLOCK_PRICE, { unlock: true, mode: 'Career' }),
  it('unlock', 'sandbox-takeover', 'Takeover Sandbox', 3, UNLOCK_PRICE, { unlock: true, mode: 'Takeover' }),
]

// Prices: the numbers above are each item's weight (the showier, the higher).
// What it costs bends that down (a gentler climb: a top item is ~13x a cheap
// one, not ~30x) and gives every item its own nudge, -30% to +40%, fixed by its
// id. So rarity is a look, not a price bracket: a pricey Rare can cost more than
// a cheap Epic. Unlocks keep their own price.
const hash01 = s => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) } return (x >>> 0) / 4294967295 }
const cost = i => {
  if (!i.price || i.unlock) return i
  const v = 400 * Math.pow(i.price / 400, 0.75) * (0.7 + hash01(i.id) * 0.7)
  return { ...i, weight: i.price, price: Math.max(150, Math.round(v / 50) * 50) }
}
export const ITEMS = [...AV, ...NC, ...NFX, ...PL, ...WF, ...WS, ...CT].map(cost).concat(UL)
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
  court: 'The court your Blacktop games are played on.',
}
