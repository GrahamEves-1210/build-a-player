// WORLD CUP mode (2026-11-16): the 48 greatest World Cup nations and their legends -> src/data/soccer-legends.js
//   node scripts/soccer/wc-legends.mjs            (writes the file; prints the ranking, the line and the team strengths)
// Inputs: scripts/soccer/wc-history.json (every nation's World Cup placings and all-time table row) and
// scripts/soccer/wc-legends-table.mjs (the legends). The method is in the header written below.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LEGENDS } from './wc-legends-table.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'src', 'data', 'soccer-legends.js')
const imp = f => import(pathToFileURL(path.join(ROOT, 'src', 'data', f)).href)
const S = await imp('soccer-strikers.js')
const { soccerSizeGrade } = await imp('soccer-attrs.js')
const { WC2026_NATIONS } = await imp('soccer-nations.js')
const HIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'soccer', 'wc-history.json'), 'utf8'))

// ─── the ranking ─────────────────────────────────────────────────────────────
// stage points a tournament (FIFA's rank in it), times 1 + 0.5 x (year - 1930) / 96; plus 0.1 x all-time table points
const stage = (rank, teams) => (rank === 1 ? 10 : rank === 2 ? 7 : rank === 3 ? 5 : rank === 4 ? 4.5 : rank <= 8 ? 3 : rank <= 16 && teams > 16 ? 1.5 : 1)
const ranked = Object.entries(HIST.nations).map(([short, h]) => {
  let st = 0, W = 0, F = 0, SF = 0, QF = 0
  for (const [y, rank] of Object.entries(h.placings)) {
    st += stage(rank, HIST.teams[y]) * (1 + 0.5 * (+y - 1930) / 96)
    if (rank === 1) W++
    if (rank <= 2) F++
    if (rank <= 4) SF++
    if (rank <= 8) QF++
  }
  const [pld, w, d, , gf, ga] = h.table ?? [0, 0, 0, 0, 0, 0]
  return { short, score: Math.round((st + 0.1 * (3 * w + d)) * 10) / 10, W, F, SF, QF, apps: Object.keys(h.placings).length, pld, gf, ga }
}).sort((a, b) => b.score - a.score)
// the line: places 1-44 by score; the nations scoring 6.5-10 (under one quarter-final run apart) are too close to call,
// and their four places go to the bigger names (the owner's rule)
const BAND = [6.5, 10]
const BAND_PICKS = ['ECU', 'ALG', 'CIV', 'EGY']
const top = ranked.filter(r => r.score > BAND[1])
const band = ranked.filter(r => r.score >= BAND[0] && r.score <= BAND[1])
if (top.length !== 44 || BAND_PICKS.some(s => !band.some(r => r.short === s))) throw new Error(`the line moved: ${top.length} above the band, band ${band.map(r => r.short)}`)
const PICKED = [...top, ...band.filter(r => BAND_PICKS.includes(r.short))]
const RANK = new Map(PICKED.map((r, i) => [r.short, { ...r, rank: i + 1 }]))
console.log('the 48:', PICKED.map((r, i) => `${i + 1} ${r.short} ${r.score}`).join(', '))
console.log('the band:', band.map(r => `${r.short} ${r.score}${BAND_PICKS.includes(r.short) ? ' IN' : ' out'}`).join(', '))
console.log('next out:', ranked.filter(r => r.score < BAND[0]).slice(0, 5).map(r => `${r.short} ${r.score}`).join(', '))

// nations not at the 2026 World Cup: name and home-kit colours (current FIFA code)
const NEW = {
  ITA: ['Italy', '#0066CC', '#FFFFFF'], SRB: ['Serbia', '#C6363C', '#0C4076'], RUS: ['Russia', '#D52B1E', '#FFFFFF'], HUN: ['Hungary', '#CE2939', '#477050'],
  POL: ['Poland', '#FFFFFF', '#DC143C'], CHI: ['Chile', '#D52B1E', '#0039A6'], ROU: ['Romania', '#FCD116', '#002B7F'], DEN: ['Denmark', '#C60C30', '#FFFFFF'],
  CMR: ['Cameroon', '#007A5E', '#CE1126'], BUL: ['Bulgaria', '#FFFFFF', '#00966E'], CRC: ['Costa Rica', '#CE1126', '#002B7F'], PER: ['Peru', '#FFFFFF', '#D91023'],
  NGA: ['Nigeria', '#008751', '#FFFFFF'],
}

// ─── the legends ─────────────────────────────────────────────────────────────
const W26 = S.WC2026_STRIKERS, ALL = [...W26, ...S.SOCCER_ALL_STRIKERS]
const EIGHT = ['pace', 'finishing', 'shotPower', 'dribbling', 'passing', 'positioning', 'heading', 'composure']
const NINE = ['pace', 'finishing', 'shotPower', 'dribbling', 'passing', 'positioning', 'heading', 'size', 'composure']
const inch = cm => Math.round(cm / 2.54), lbs = kg => Math.round(kg * 2.20462)
const OVR_W = { finishing: 0.18, positioning: 0.17, dribbling: 0.12, composure: 0.11, pace: 0.10, shotPower: 0.08, heading: 0.08, passing: 0.08, size: 0.08 }   // utils/soccerSimulation.js SOCCER_OVR_WEIGHTS
const ovrOf = a => { let s = 0, w = 0; for (const [k, x] of Object.entries(OVR_W)) { s += a[k] * x; w += x } return Math.min(99, Math.round(57 + ((s / w - 1) / 9) * 44)) }
const rows = []
for (const [name, short, nat, number, role, years, peak, born, cm, kg, foot, skin, starter, v, from] of LEGENDS) {
  let height = cm != null ? inch(cm) : null, weight = kg != null ? lbs(kg) : null, ft = foot, sk = skin, espn = null
  if (from) {
    const src = W26.find(p => p.name === from) ?? ALL.find(p => p.name === from)
    if (!src) throw new Error(`no row for ${from}`)
    ;({ height, weight, foot: ft, skin: sk } = src); espn = src.espn ?? null
  }
  if (!RANK.has(nat)) throw new Error(`${name}: ${nat} is not one of the 48`)
  const a = Object.fromEntries(EIGHT.map((t, i) => [t, v[i]]))
  a.size = soccerSizeGrade(height, weight, role)
  rows.push({ name, short, team: nat, nation: nat, number, height, weight, age: peak - born, foot: ft, skin: sk, espn, starter, role, years, peak, attrs: Object.fromEntries(NINE.map(k => [k, a[k]])) })
}

// ─── team strength ───────────────────────────────────────────────────────────
const topScore = PICKED[0].score
const zOf = vals => { const m = vals.reduce((a, b) => a + b, 0) / vals.length; const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length); return x => (x - m) / sd }
const zF = zOf(PICKED.map(r => r.gf / r.pld)), zA = zOf(PICKED.map(r => r.ga / r.pld))
const nations = PICKED.map(h => {
  const [o1, o2, o3] = [...rows.filter(p => p.team === h.short).map(p => ovrOf(p.attrs)).sort((a, b) => b - a), 86, 86, 86]
  const q = Math.max(0, Math.min(1.15, (o1 * 0.4 + o2 * 0.35 + o3 * 0.25 - 86) / (97 - 86)))
  const hh = Math.log(h.score) / Math.log(topScore)
  const att = Math.min(100, Math.round(67 + 28 * (0.45 * q + 0.55 * hh) + 1.2 * zF(h.gf / h.pld) + 1.2 * h.W))
  const def = Math.min(100, Math.round(67 + 28 * (0.25 * q + 0.75 * hh) - 1.2 * zA(h.ga / h.pld) + 1.2 * h.W))
  const n26 = WC2026_NATIONS.find(n => n.short === h.short)
  const [name, color, color2] = n26 ? [n26.name, n26.color, n26.color2] : NEW[h.short]
  return { short: h.short, name, color, color2, att, def, ovr: Math.round((att + def) / 2), rank: RANK.get(h.short).rank, titles: h.W }
})
// groups: four pots of twelve by strength, snake order (the twelve strongest in twelve different groups)
const L = 'ABCDEFGHIJKL'
;[...nations].sort((a, b) => (b.att + b.def) - (a.att + a.def) || a.rank - b.rank).forEach((n, i) => { const pot = Math.floor(i / 12), k = i % 12; n.group = L[pot % 2 ? 11 - k : k] })
for (const n of [...nations].sort((a, b) => b.ovr - a.ovr)) console.log(`${n.short} ${n.group} att ${n.att} def ${n.def} ovr ${n.ovr}`)

// ─── write ───────────────────────────────────────────────────────────────────
const HEADER = `// WORLD CUP (pool key 'alltime', since 2026-11-16): the legends of the 48 greatest World Cup nations.
// The owner: "the world cup mode is about the top 48 countries performance wise in world cup history and their
// legends... could be 2-6 players per country... if you can't decide between what country is better performance
// wise go with the one with the bigger names. should favor recency a bit, i don't want a bunch of really old players
// no one's heard of." GENERATED by scripts/soccer/wc-legends.mjs from scripts/soccer/wc-legends-table.mjs and
// wc-history.json: edit those and rerun it (then scripts/soccer/wc-legends-check.mjs).
// Career keeps the real 2026 national teams (soccer-nations.js WC2026_NATIONS, soccer-strikers.js WC2026_STRIKERS).
//
// THE 48 NATIONS
//   Score = stage points in every World Cup 1930-2026 (won 10, runners-up 7, third 5, fourth 4.5, last eight 3, last
//   16 when the field was over 16 teams 1.5, any other appearance 1), each times a mild recency weight (1.0 for 1930
//   rising evenly to 1.5 for 2026), plus 0.1 x all-time World Cup table points (3 for a win, 1 for a draw).
//   Placings: FIFA's ranking of every finals tournament (Wikipedia "National team appearances in the FIFA World Cup");
//   points and goals: the all-time World Cup table (Wikipedia "FIFA World Cup records and statistics", after 2026).
//   Successor states count with the record FIFA gives them: Germany with West Germany (and the 1934-38 Germany; not
//   East Germany), Russia with the Soviet Union, Serbia with Yugoslavia, FR Yugoslavia and Serbia and Montenegro,
//   Czechia with Czechoslovakia (Slovakia keeps only its own 2010), DR Congo with Zaire. Codes and colours are today's.
//   Places 1-44 are the score's top 44. The line: the seven nations scoring 6.5-10 (${band.map(r => `${r.short} ${r.score}`).join(', ')})
//   are less than one quarter-final run apart, too close to call, so the last four places went to the bigger names:
//   Ecuador (Enner Valencia, Caicedo), Algeria (Mahrez), Ivory Coast (Drogba, Yaya Touré) and Egypt (Salah). Out:
//   Ireland, Northern Ireland, South Africa. rank: the order here (the four from the band 45-48); titles: World Cups won.
//
// WHO IS IN (2-6 a nation: 6 for the eight biggest, 5 for the next three, 2-4 for the rest; ${rows.length} in all)
//   Outfield attacking players only (the build is a striker): strikers, wingers, attacking, central and defensive
//   midfielders, role as in the club pool ('ST' | 'SS' | 'LW' | 'RW' | 'AM' | 'CM' | 'DM'). Famous World Cup
//   performers and national icons, most from the 1990s to now; before 1980 only names a 14-year-old knows (Pelé,
//   Puskás, Eusébio, Gerd Müller, Cruyff; Dalglish's peak is 1979). Active players can be legends (Messi, Ronaldo,
//   Mbappé, Kane, Haaland, Yamal). starter: the nation's main striker (one a nation, the man a build replaces).
//
// BIO   height: his Wikipedia infobox height (club and FIFA profiles cited there), inches. weight: his playing weight
//       as commonly listed in his prime (club and FIFA profiles, Transfermarkt), rounded: an estimate for the older
//       players. foot; number (his best-known shirt for the national team); years (his national-team span); peak
//       (the year of his rating) and age (his age that year). Active players already in the club or 2026 World Cup
//       data keep that row's ESPN bio, ESPN id (photo) and sampled skin. Everyone else has no photo (the owner's rule:
//       ESPN headshots only, initials beat a bad photo) and a skin picked by hand from the pool's swatches.
//
// RATINGS  each legend at his career peak, on the club pool's 0-11 scale (F=0 ... S=11) and its spread.
//   Sources: FBref and Transfermarkt career records (goals a game for club and country, World Cup goals, assists,
//   penalties and free kicks), the peak-season numbers where FBref has them (2017-18 on: xG, take-ons, chances
//   created, aerials), and his well-known reputation at his peak. Each trait was placed against the club pool's own
//   players: the grade a current player with that profile gets. S is kept for the all-time greats in their signature
//   traits (Pelé, Maradona, Messi, Ronaldo, Cristiano Ronaldo, Cruyff, Zidane, Gerd Müller, Mbappé, Haaland...: as
//   Haaland is S in the club pool); a great but lesser legend tops out around A or A+, a smaller nation's icon around
//   A-. Size: data/soccer-attrs.js soccerSizeGrade of his height and weight.
//
// TEAM STRENGTH (att / def, 0-100 like the club scale; the all-time tournament in utils/soccerSimulation.js)
//   q = the nation's three best legends' OVR (weights 0.4 / 0.35 / 0.25; a nation with two counts an 86 third) on
//   86-97, h = ln(score) / ln(Brazil's score). att = 67 + 28 x (0.45 q + 0.55 h) + 1.2 x z(World Cup goals for a game)
//   + 1.2 x titles; def = 67 + 28 x (0.25 q + 0.75 h) - 1.2 x z(goals against a game) + 1.2 x titles; 100 at most.
//   The legends lean on the attack, the record on the defence (no defenders here). Groups: four pots of twelve by
//   strength, snake order.
`
const q = JSON.stringify
const rowJs = p => `  { name: ${q(p.name)}, short: ${q(p.short)}, team: '${p.team}', nation: '${p.nation}', number: ${p.number}, height: ${p.height}, weight: ${p.weight}, age: ${p.age}, foot: '${p.foot}', skin: '${p.skin}', espn: ${p.espn}, starter: ${p.starter}, position: 'ST', role: '${p.role}', years: '${p.years}', peak: ${p.peak},\n    attrs: { ${NINE.map(k => `${k}: ${p.attrs[k]}`).join(', ')} } },`
const natJs = n => `  { short: '${n.short}', name: ${q(n.name)}, color: '${n.color}', color2: '${n.color2}', att: ${n.att}, def: ${n.def}, ovr: ${n.ovr}, group: '${n.group}', rank: ${n.rank}, titles: ${n.titles} },`
let out = `${HEADER}\nexport const WC_LEGEND_NATIONS = [\n${nations.map(natJs).join('\n')}\n]\n\nexport const WC_LEGENDS = [\n`
for (const n of nations) out += `\n  // ─── ${n.short} ${'─'.repeat(68)}\n${rows.filter(p => p.team === n.short).map(rowJs).join('\n')}\n`
out += ']\n'
fs.writeFileSync(OUT, out.replace(/\n/g, '\r\n'))
console.log(`${rows.length} legends, ${nations.length} nations -> ${path.relative(ROOT, OUT)}`)
