// CAREER, SOCCER: the international game years on (2026-11-24). Career's national teams used to be the 2026 World
// Cup's squads for ever ("the 2030 Golden Boot went to Cristiano Ronaldo", 45). Here a nation's squad is read for a
// year: the real players aged (the young ones still improving, the legs going past 30, international retirement at
// 33-37), the next real ones stepping up from the club data, and generated players coming through behind them; the
// nations' strength drifts a little around today's; a World Cup's 48 qualify by confederation, and the continental
// championships are played on their real cycles (data/soccer-nations.js CONTINENTALS).
// Everything is seeded from the career's seed: the same career always meets the same world.
import { seeded } from './rng'
import { CAREER_NATIONS, CONTINENTALS, WC_SLOTS, WC_HOSTS } from '../data/soccer-nations'
import { SOCCER_ALL_STRIKERS, WC2026_STRIKERS } from '../data/soccer-strikers'
import { soccerNationField, calcSoccerOVR, SOCCER_TRAITS } from '../utils/soccerSimulation'

export const INTL_BASE = 2026            // the data's year: ages and squads are this season's
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const gauss = r => { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
const NATION = new Map(CAREER_NATIONS.map(n => [n.short, n]))
export const intlNation = short => NATION.get(short) ?? null
const isNine = p => !p?.role || p.role === 'ST' || p.role === 'SS'
const ovrOf = attrs => calcSoccerOVR(Object.fromEntries(SOCCER_TRAITS.map(t => [t, { val: attrs?.[t] ?? 5 }])), SOCCER_TRAITS)
// a level (0-99) as a flat grade on the 0-11 scale (calcSoccerOVR's line: 57 at a D, 44 points over nine grades)
const gradeAt = lvl => 1 + (lvl - 57) * 9 / 44

// ── The real players of a nation: its 2026 World Cup five, then everyone of that country in the club data ──
// (the club data's own code for a country where it isn't FIFA's: Kosovo is KVX there)
const DATA_CODE = { KVX: 'KOS' }
const REAL = new Map()
function realPool(short) {
  if (REAL.has(short)) return REAL.get(short)
  const seen = new Set(), out = []
  for (const p of [...WC2026_STRIKERS.filter(x => x.team === short), ...SOCCER_ALL_STRIKERS.filter(x => (DATA_CODE[x.nation] ?? x.nation) === short)]) {
    if (seen.has(p.name)) continue
    seen.add(p.name)
    out.push({ name: p.name, short: p.short ?? null, role: p.role ?? 'ST', age: p.age ?? 27, attrs: p.attrs, espn: p.espn ?? null, ovr0: ovrOf(p.attrs) })
  }
  REAL.set(short, out)
  return out
}
// a real player years on. Under 24 he's still improving (a wonderkid more than most: his own seeded ceiling); past 30
// the legs go first, then the rest, and composure and passing stay (lib/ageLadder.js soccer, the same shape)
const FADE = { pace: 0.5, dribbling: 0.3, shotPower: 0.2, heading: 0.2, finishing: 0.2, positioning: 0.15, passing: 0, composure: 0, size: 0 }
function agedAttrs(p, yrs) {
  if (!yrs) return p.attrs
  const r = seeded(`grow|${p.name}`)
  const grow = Math.min(yrs, Math.max(0, 24 - p.age)) * (0.12 + 0.2 * r())
  const past = Math.max(0, p.age + yrs - 30) - Math.max(0, p.age - 30)
  const out = {}
  for (const t of SOCCER_TRAITS) out[t] = clamp((p.attrs?.[t] ?? 5) + (t === 'size' ? 0 : grow * (t === 'pace' ? 0.5 : 1)) - past * (FADE[t] ?? 0.2), 0, 11)
  return out
}
// the year he stops playing for his country: 33 to 36, a year later for a great one
const lastAge = p => 33 + Math.floor(seeded(`intl-retire|${p.name}`)() * 4) + (p.ovr0 >= 92 ? 1 : 0)

// ── Generated players: a country's next ones ──
// Names by where a player is from (common given names and surnames, nothing more)
const NAMES = {
  iberian: [['Mateo', 'Diego', 'Álvaro', 'Hugo', 'Pablo', 'Sergio', 'Javier', 'Adrián', 'Iker', 'Marcos', 'Nicolás', 'Santiago', 'Tomás', 'Emiliano', 'Julián', 'Lautaro'], ['García', 'Herrera', 'Navas', 'Moreno', 'Ibarra', 'Castillo', 'Vega', 'Romero', 'Molina', 'Ortega', 'Fuentes', 'Paredes', 'Acosta', 'Rojas', 'Salinas', 'Cabrera', 'Benítez', 'Villalba']],
  luso: [['João', 'Tiago', 'Rafael', 'Bruno', 'Gabriel', 'Matheus', 'Lucas', 'Pedro', 'Vítor', 'Caio', 'Diogo', 'Rúben', 'Gustavo', 'Renan'], ['Ferreira', 'Costa', 'Lopes', 'Carvalho', 'Almeida', 'Ribeiro', 'Teixeira', 'Barbosa', 'Moura', 'Rocha', 'Nogueira', 'Pinto', 'Cardoso', 'Azevedo']],
  anglo: [['Jack', 'Harry', 'Callum', 'Ethan', 'Liam', 'Noah', 'Mason', 'Tyler', 'Owen', 'Jacob', 'Reece', 'Connor', 'Aidan', 'Kieran', 'Jude', 'Ryan'], ['Walker', 'Bennett', 'Hughes', 'Carter', 'Marsh', 'Fletcher', 'Doyle', 'Mitchell', 'Barnes', 'Sutton', 'Reid', 'Campbell', 'Morgan', 'Gallagher', 'Turner', 'Hayes']],
  franco: [['Théo', 'Hugo', 'Enzo', 'Lucas', 'Rayan', 'Mathis', 'Nathan', 'Yanis', 'Noé', 'Maxime', 'Kylian', 'Loïc', 'Bastien', 'Jules'], ['Moreau', 'Dubois', 'Lambert', 'Girard', 'Mercier', 'Fontaine', 'Renard', 'Marchand', 'Lemaire', 'Perrin', 'Colin', 'Benoît', 'Faure', 'Guérin']],
  german: [['Leon', 'Jonas', 'Felix', 'Niklas', 'Maximilian', 'Luca', 'Florian', 'Tim', 'Julian', 'Paul', 'Moritz', 'Fabian'], ['Brandt', 'Keller', 'Vogel', 'Hartmann', 'Krüger', 'Lang', 'Schubert', 'Winkler', 'Baumann', 'Seidel', 'Roth', 'Lindner']],
  dutch: [['Daan', 'Sem', 'Lars', 'Jesse', 'Milan', 'Thijs', 'Ruben', 'Stijn', 'Xavi', 'Jurriën', 'Quinten', 'Mees'], ['Jansen', 'de Boer', 'Visser', 'Bakker', 'Achterberg', 'van Dijk', 'Smit', 'Mulder', 'Hendriks', 'Kok', 'Dekker', 'Maas']],
  italian: [['Luca', 'Marco', 'Matteo', 'Lorenzo', 'Federico', 'Andrea', 'Davide', 'Simone', 'Nicolò', 'Tommaso', 'Giacomo', 'Riccardo'], ['Romano', 'Marchetti', 'Conti', 'Ferrari', 'Greco', 'Bianchi', 'Gallo', 'Rinaldi', 'De Luca', 'Moretti', 'Barbieri', 'Fabbri']],
  nordic: [['Emil', 'Oskar', 'Magnus', 'Elias', 'Anton', 'Viktor', 'Mikkel', 'Sander', 'Aron', 'Jonas', 'Mathias', 'Kasper'], ['Lindqvist', 'Petersen', 'Sørensen', 'Berg', 'Nilsson', 'Hansen', 'Dahl', 'Holm', 'Lund', 'Karlsson', 'Strand', 'Eriksen']],
  slavic: [['Luka', 'Marko', 'Nikola', 'Ivan', 'Filip', 'Jakub', 'Tomáš', 'Adam', 'Stefan', 'Matej', 'Petar', 'Mateusz', 'Andriy', 'Dominik'], ['Novak', 'Kovač', 'Petrović', 'Horvat', 'Varga', 'Jovanović', 'Marić', 'Babić', 'Kowalski', 'Nowak', 'Popescu', 'Dimitrov', 'Shevchuk', 'Hoxha']],
  greek: [['Giorgos', 'Kostas', 'Dimitris', 'Christos', 'Nikos', 'Vangelis', 'Tasos', 'Petros'], ['Papadopoulos', 'Ioannidis', 'Georgiou', 'Nikolaou', 'Vlachos', 'Karagiannis', 'Samaras', 'Douvikas']],
  turkic: [['Emre', 'Kerem', 'Arda', 'Yusuf', 'Can', 'Burak', 'Oğuz', 'Mert', 'Eldor', 'Jasur', 'Otabek', 'Azizbek'], ['Yılmaz', 'Demir', 'Kaya', 'Şahin', 'Aydın', 'Öztürk', 'Çelik', 'Arslan', 'Karimov', 'Rashidov', 'Tursunov', 'Aliev']],
  arabic: [['Youssef', 'Ibrahim', 'Omar', 'Amine', 'Karim', 'Hamza', 'Bilal', 'Sami', 'Mohamed', 'Ali', 'Salem', 'Mehdi', 'Tariq', 'Reza'], ['Haddad', 'Benali', 'El Amrani', 'Mansour', 'Bouzid', 'Al-Harbi', 'Saleh', 'Khalil', 'Ziani', 'Trabelsi', 'Hassan', 'Rahimi', 'Al-Najjar', 'Farouk']],
  african: [['Ibrahima', 'Moussa', 'Sékou', 'Cheikh', 'Kwame', 'Emmanuel', 'Samuel', 'Victor', 'Amadou', 'Ismaël', 'Chidera', 'Kelechi', 'Thabo', 'Franck'], ['Diallo', 'Mensah', 'Okoro', 'Kourouma', 'Traoré', 'Ndiaye', 'Boateng', 'Adeyemi', 'Koné', 'Camara', 'Eze', 'Mbemba', 'Zulu', 'Onana']],
  japanese: [['Takumi', 'Daichi', 'Ren', 'Kaito', 'Haruto', 'Sota', 'Yuto', 'Riku', 'Kota', 'Shun'], ['Tanaka', 'Sato', 'Ito', 'Nakamura', 'Kobayashi', 'Yamamoto', 'Suzuki', 'Matsuda', 'Hayashi', 'Mori']],
  korean: [['Min-jae', 'Ji-ho', 'Seung-woo', 'Hyun-woo', 'Tae-yang', 'Jun-seo', 'Do-yun', 'Sung-min'], ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Han']],
  easia: [['Wei', 'Hao', 'Jun', 'Minh', 'Anh', 'Thanh', 'Rizky', 'Arif', 'Somchai', 'Faiz', 'Chanathip', 'Yong'], ['Wang', 'Li', 'Zhang', 'Chen', 'Nguyen', 'Tran', 'Pham', 'Pratama', 'Saputra', 'Rahman', 'Srisuk', 'Ri']],
  indian: [['Rahul', 'Sahal', 'Anirudh', 'Liston', 'Vikram', 'Suresh', 'Manvir', 'Ashique'], ['Singh', 'Thapa', 'Chhetri', 'Colaco', 'Fernandes', 'Kumar', 'Rao', 'Das']],
  // (2026-11-25, with the rest of FIFA)
  pacific: [['Setareki', 'Tiko', 'Malakai', 'Sione', 'Iosefa', 'Kalani', 'Tevita', 'Jone', 'Micah', 'Raphael', 'Teaonui', 'Bertrand'], ['Krishna', 'Tuilagi', 'Vakatawa', 'Fifita', 'Kaufana', 'Tapueluelu', 'Naidu', 'Kami', 'Tehau', 'Wajoka', 'Kalsakau', 'Faitala']],
  baltic: [['Kristers', 'Rauno', 'Henri', 'Edgaras', 'Arminas', 'Vladislavs', 'Mattias', 'Fedor', 'Gytis', 'Raivis', 'Karol', 'Martynas'], ['Tamm', 'Sappinen', 'Kazlauskas', 'Ikaunieks', 'Uldriķis', 'Vaštakas', 'Zenjovs', 'Sorga', 'Golubickas', 'Kask', 'Novikovas', 'Jaunzems']],
  caucasus: [['Artur', 'Tigran', 'Narek', 'Vahan', 'Eduard', 'Lucas', 'Emin', 'Ramil', 'Mahir', 'Toral', 'Renat', 'Rustam'], ['Grigoryan', 'Barseghyan', 'Spertsyan', 'Ranos', 'Hovhannisyan', 'Mkhitaryan', 'Mahmudov', 'Bayramov', 'Emreli', 'Sheydayev', 'Huseynov', 'Aliyev']],
}
const REGION = {
  iberian: 'ESP ARG MEX COL URU PAR ECU CHI PER VEN BOL CRC PAN HON GUA SLV DOM NCA EQG',
  luso: 'POR BRA CPV ANG MOZ', anglo: 'ENG SCO WAL IRL NIR USA CAN AUS NZL JAM TRI GUY', franco: 'FRA BEL SUI HAI',
  german: 'GER AUT', dutch: 'NED CUW SUR', italian: 'ITA', nordic: 'NOR SWE DEN ISL FIN',
  slavic: 'CRO SRB BIH CZE SVK SVN POL UKR MNE MKD BUL ROU HUN KOS ALB GEO ISR', greek: 'GRE', turkic: 'TUR UZB KGZ TJK',
  arabic: 'MAR ALG TUN EGY KSA QAT IRQ JOR UAE OMA SYR PLE BHR KUW LBN IRN COM',
  african: 'SEN CIV GHA NGA CMR MLI BFA GUI GAM BEN TOG GAB COD RSA UGA ZIM ZAM', japanese: 'JPN', korean: 'KOR',
  easia: 'CHN PRK THA VIE IDN MAS', indian: 'IND',
}
// the rest of FIFA (2026-11-25): each to the names its football is full of
const REGION_REST = {
  iberian: 'CUB PUR AND', luso: 'GNB STP', italian: 'SMR', german: 'LIE', dutch: 'ARU', nordic: 'FRO', greek: 'CYP',
  franco: 'LUX MRI NCL TAH', slavic: 'RUS BLR MDA', baltic: 'EST LVA LTU', caucasus: 'ARM AZE', turkic: 'KAZ TKM',
  anglo: 'GIB MLT AIA ATG BAH BRB BLZ BER VGB CAY DMA GRN MSR SKN LCA VIN TCA VIR GUM',
  arabic: 'LBY SDN MTN DJI SOM YEM AFG',
  african: 'BOT BDI CTA CHA CGO ERI SWZ ETH KEN LES LBR MAD MWI NAM NIG RWA SEY SLE SSD TAN',
  easia: 'BRU CAM TPE HKG LAO MAC MNG MYA PHI SGP TLS', indian: 'BAN BHU MDV NEP PAK SRI',
  pacific: 'ASA COK FIJ PNG SAM SOL TGA VAN',
}
const REGION_OF = new Map([REGION, REGION_REST].flatMap(R => Object.entries(R).flatMap(([k, v]) => v.split(' ').map(s => [s, k]))))
const genName = (short, r) => { const [f, l] = NAMES[REGION_OF.get(short) ?? 'anglo']; return `${f[Math.floor(r() * f.length)]} ${l[Math.floor(r() * l.length)]}` }
// how good a country's next player is: around its level (Spain's high 80s, England's mid-80s, Qatar's high 60s), the
// odd one far better: every generation has its star. (Set against 2026: a country's best No. 9 is about its own
// level, a few points either way, the second five behind him, the third nine.)
// Half of it is the country's level, half its strikers today (Nigeria and Sweden produce better No. 9s than their
// results say; Spain's are behind its wingers)
const GEN_MEAN = new Map()
function genMean(n) {
  if (!n) return 75
  if (GEN_MEAN.has(n.short)) return GEN_MEAN.get(n.short)
  const lvl = 68.5 + ((n.ovr ?? 75) - 67) * 0.6
  const nines = realPool(n.short).filter(isNine).map(p => p.ovr0).sort((a, b) => b - a).slice(0, 3)
  const v = nines.length ? (lvl + nines.reduce((a, b) => a + b, 0) / nines.length - 3) / 2 : lvl
  GEN_MEAN.set(n.short, v)
  return v
}
const GEN_ROLES = [['ST', 0.36], ['SS', 0.08], ['LW', 0.14], ['RW', 0.14], ['AM', 0.1], ['CM', 0.1], ['DM', 0.08]]
const ROLE_TILT = { ST: { finishing: 1, positioning: 1, passing: -1 }, SS: { finishing: 0.5, dribbling: 0.5 }, LW: { pace: 1, dribbling: 1, heading: -1.5 }, RW: { pace: 1, dribbling: 1, heading: -1.5 }, AM: { passing: 1.5, composure: 0.5, heading: -1.5 }, CM: { passing: 1.5, finishing: -1 }, DM: { passing: 1, size: 1, finishing: -1.5, pace: -0.5 } }
// the ones who came through in `year` (0-2 a year, one and a quarter on average), each with his own ceiling
function cohort(seed, short, year) {
  const r = seeded(`gen|${seed}|${short}|${year}`)
  const nat = NATION.get(short)
  const n = (r() < 0.85 ? 1 : 0) + (r() < 0.4 ? 1 : 0)
  const out = []
  for (let i = 0; i < n; i++) {
    let roll = r(), role = 'ST'
    for (const [k, w] of GEN_ROLES) { roll -= w; if (roll <= 0) { role = k; break } }
    const peak = clamp(genMean(nat) + 5 * gauss(r) + (r() < 0.06 ? 8 : 0), 58, 97)
    const born = year - 19 - Math.floor(r() * 3)
    const tilt = ROLE_TILT[role] ?? {}
    const noise = Object.fromEntries(SOCCER_TRAITS.map(t => [t, (tilt[t] ?? 0) + (r() - 0.5) * 2]))
    out.push({ name: genName(short, r), role, born, peak, noise, gen: true })
  }
  return out
}
function genAt(g, year) {
  const age = year - g.born
  const lvl = g.peak - Math.max(0, 25 - age) * 1.6 - Math.max(0, age - 30) * 1.6
  const base = gradeAt(lvl)
  const attrs = Object.fromEntries(SOCCER_TRAITS.map(t => [t, clamp(base + g.noise[t], 0, 11)]))
  return { name: g.name, short: g.name.split(' ').slice(1).join(' '), role: g.role, age, attrs, ovr: ovrOf(attrs), gen: true }
}

// ── A nation's players in a year ──
const POOLS = new Map()
// every attacker and midfielder his country can call on in `year`, best first
export function nationPool(short, year, seed) {
  const id = `${seed}|${short}|${year}`
  if (POOLS.has(id)) return POOLS.get(id)
  const yrs = Math.max(0, year - INTL_BASE)
  const out = []
  for (const p of realPool(short)) {
    const age = p.age + yrs
    if (yrs > 0 && age >= lastAge(p)) continue
    const attrs = agedAttrs(p, yrs)
    out.push({ name: p.name, short: p.short, role: p.role, age, attrs, ovr: ovrOf(attrs), espn: p.espn, gen: false })
  }
  for (let y = INTL_BASE + 1; y <= year; y++) for (const g of cohort(seed, short, y)) { if (year - g.born < 34) out.push(genAt(g, year)) }
  // The depth the data doesn't carry (it has a country's first few, not its squad): a second and a third striker at
  // the level its football says (about its mean, and three under), and enough players for a squad. Each is a man in
  // his prime for six years, then the next one.
  const mean = genMean(NATION.get(short)), era = Math.floor(year / 6)
  const filler = (j, role, peak) => {
    const r = seeded(`fill|${seed}|${short}|${era}|${j}`)
    const tilt = ROLE_TILT[role] ?? {}
    return genAt({ name: genName(short, r), role, born: era * 6 - 21 - Math.floor(r() * 4), peak, noise: Object.fromEntries(SOCCER_TRAITS.map(t => [t, (tilt[t] ?? 0) + (r() - 0.5)])), gen: true }, year)
  }
  const nines = out.filter(isNine).map(p => p.ovr).sort((a, b) => b - a)
  ;[mean + 2, mean - 1, mean - 4].forEach((want, i) => { if ((nines[i] ?? 0) < want - 1.5) out.push(filler(i, 'ST', want + 2.5)) })
  for (let j = 3; out.length < 7 && j < 12; j++) out.push(filler(j, GEN_ROLES[1 + (j % (GEN_ROLES.length - 1))][0], mean - 3 + (j % 3)))
  out.sort((a, b) => b.ovr - a.ovr || (a.name < b.name ? -1 : 1))
  if (POOLS.size > 600) POOLS.clear()
  POOLS.set(id, out)
  return out
}
// the five the engine plays a tournament with: the first-choice No. 9, then the best of the rest
export function nationSquad(short, year, seed) {
  const pool = nationPool(short, year, seed)
  const nine = pool.find(p => p.role === 'ST') ?? pool.find(isNine)
  const rest = pool.filter(p => p !== nine).slice(0, 4)
  return [nine, ...rest].filter(Boolean).map(p => ({ name: p.name, short: p.short, team: short, role: p.role, age: p.age, attrs: p.attrs, espn: p.espn ?? null, starter: p === nine }))
}
// The pecking order up front: his country's strikers in `year`, each with the season he's having (a seeded run of
// form, a point or two either way), best first. → [{ name, ovr, age, score }]
export function peckingOrder(short, year, seed) {
  return nationPool(short, year, seed).filter(isNine).map(p => ({ name: p.name, ovr: Math.round(p.ovr), age: p.age, gen: !!p.gen, score: p.ovr + 2 * gauss(seeded(`form|${seed}|${p.name}|${year}`)) })).sort((a, b) => b.score - a.score)
}

// ── A nation's strength in a year: today's, drifting (a slow walk that pulls back to where it is now) ──
function driftOf(short, year, seed) {
  let d = 0
  for (let b = 1; b <= Math.floor(Math.max(0, year - INTL_BASE) / 2); b++) d = 0.8 * d + 0.8 * gauss(seeded(`drift|${seed}|${short}|${b}`))
  return clamp(d, -4, 4)
}
export function nationIn(short, year, seed) {
  const n = NATION.get(short)
  if (!n) return null
  const d = driftOf(short, year, seed)
  return { short: n.short, name: n.name, color: n.color, color2: n.color2, conf: n.conf, att: clamp(n.att + d, 40, 100), def: clamp(n.def + d, 40, 100), ovr: clamp(n.ovr + d, 40, 100) }
}

// ── Qualifying and the draw ──
// The best `slots` of a confederation over a qualifying campaign (its level and a campaign's luck); hosts are in.
// me: { short, lift }: his own country, with what he adds to it up front
function qualify(list, slots, tag, seed, hosts = [], me = null) {
  const scored = list.map(n => ({ n, s: (hosts.includes(n.short) ? 100 : 0) + n.ovr + 3 * gauss(seeded(`q|${seed}|${tag}|${n.short}`)) + (me && me.short === n.short ? me.lift ?? 0 : 0) }))
  return scored.sort((a, b) => b.s - a.s).slice(0, slots).map(x => x.n)
}
// pots by strength (the hosts in the first), one from each pot to a group
function draw(nations, groups, tag, seed, hosts = []) {
  const r = seeded(`draw|${seed}|${tag}`)
  const order = [...nations].sort((a, b) => (hosts.includes(b.short) - hosts.includes(a.short)) || b.ovr - a.ovr || (a.short < b.short ? -1 : 1))
  const letters = 'ABCDEFGHIJKL'.slice(0, groups).split('')
  const out = []
  for (let p = 0; p * groups < order.length; p++) {
    const pot = order.slice(p * groups, p * groups + groups)
    for (let i = pot.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pot[i], pot[j]] = [pot[j], pot[i]] }
    pot.forEach((n, i) => out.push({ ...n, group: letters[i] }))
  }
  return out
}
// what he adds to his country in qualifying: a far better No. 9 than the one it has is worth a few points of level
function liftFor(me, year, seed) {
  if (!me?.short || me.ovr == null) return 0
  const best = peckingOrder(me.short, year, seed)[0]?.ovr ?? 70
  return clamp((me.ovr - best) / 3, 0, 5) * (me.role === 'Starter' ? 1 : me.role === 'Rotation' ? 0.5 : 0.2)
}
const FIELDS = new Map()
const keep = (id, make) => { if (FIELDS.has(id)) return FIELDS.get(id); if (FIELDS.size > 24) FIELDS.clear(); const v = make(); FIELDS.set(id, v); return v }
// (a suspended nation, Russia, is in no qualifying and no finals)
const allIn = (year, seed) => CAREER_NATIONS.filter(n => !n.suspended).map(n => nationIn(n.short, year, seed))

// The World Cup of `year` (2030, 2034...): 48 nations by confederation, the hosts in, twelve groups drawn.
// → { field (for the engine: team.field), nations: [short], hosts, in: his country qualified }
export function worldCupOf(year, seed, me = null) {
  const lift = Math.round(liftFor(me, year, seed) * 2) / 2
  return keep(`wc|${seed}|${year}|${me?.short ?? ''}|${lift}`, () => {
    const all = allIn(year, seed), hosts = WC_HOSTS[year] ?? []
    const q = []
    for (const [conf, slots] of Object.entries(WC_SLOTS)) q.push(...qualify(all.filter(n => n.conf === conf), slots, `wc${year}`, seed, hosts, me ? { short: me.short, lift } : null))
    const nations = draw(q.slice(0, 48), 12, `wc${year}`, seed, hosts)
    const players = nations.flatMap(n => nationSquad(n.short, year, seed))
    return { field: soccerNationField(`wc${year}`, nations, players, hosts, { yrs: year - INTL_BASE, label: String(year) }), nations: nations.map(n => n.short), hosts, in: !!me && nations.some(n => n.short === me.short) }
  })
}
// The continental championship his country plays in the summer of `year`, if there is one (a CONCACAF nation is a
// guest at the Copa América when it's one of the six invited)
export function continentalOf(short, year) {
  const n = NATION.get(short)
  if (!n) return null
  const on = d => year >= d.from && (year - d.from) % d.every === 0 || (d.also ?? []).includes(year)
  return CONTINENTALS.find(d => d.conf === n.conf && on(d)) ?? CONTINENTALS.find(d => d.guests?.[0] === n.conf && on(d)) ?? null
}
// → { def, field, nations, hosts, in }
export function continentalField(def, year, seed, me = null) {
  const lift = Math.round(liftFor(me, year, seed) * 2) / 2
  return keep(`${def.id}|${seed}|${year}|${me?.short ?? ''}|${lift}`, () => {
    const all = allIn(year, seed), hosts = def.hosts?.[year] ?? []
    const tag = `${def.id}${year}`, mine = me ? { short: me.short, lift } : null
    const guests = def.guests ? qualify(all.filter(n => n.conf === def.guests[0]), def.guests[1], `${tag}-guest`, seed, [], mine) : []
    const home = qualify(all.filter(n => n.conf === def.conf), def.size - guests.length, tag, seed, hosts, mine)
    const q = [...home, ...guests]
    // (short of a full field: the format needs fours)
    const size = Math.floor(q.length / 4) * 4, groups = size >= 24 ? 6 : 4
    const nations = draw(q.slice(0, groups * 4), groups, tag, seed, hosts)
    const players = nations.flatMap(n => nationSquad(n.short, year, seed))
    return { def, field: soccerNationField(tag, nations, players, hosts, { yrs: year - INTL_BASE, groups, label: `${def.short} ${year}` }), nations: nations.map(n => n.short), hosts, in: !!me && nations.some(n => n.short === me.short) }
  })
}
