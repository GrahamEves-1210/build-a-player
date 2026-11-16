// Soccer Career on the nine ratings (2026-11-16): node scripts/soccer/career-check.mjs
// Starts a career, takes the first academy offer, plays a whole season week by week (moments answered with the
// first option), books it and starts the next; then loads a career saved with the ten old ratings (written to a
// fake localStorage the way the game writes it) and plays a season of it too. Career stays on the domestic leagues.
import { build } from 'esbuild'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, `career-${Date.now()}.mjs`)
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size } }
globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }; globalThis.location = { search: '', hostname: 'localhost', href: 'http://localhost/' }
await build({
  stdin: { contents: `export * from './src/lib/career.js'\nexport * from './src/lib/careerSoccer.js'\nexport { SOCCER_STRIKERS } from './src/data/soccer-strikers.js'\nexport { SOCCER_CLUBS } from './src/data/soccer-clubs.js'`, resolveDir: ROOT, loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error', loader: { '.jsx': 'jsx', '.json': 'json', '.png': 'empty', '.css': 'empty', '.webp': 'empty' },
  define: { 'import.meta.env': '{"DEV":false,"VITE_SUPABASE_URL":"http://localhost:1","VITE_SUPABASE_ANON_KEY":"x"}' },
})
const C = await import(pathToFileURL(outfile).href)
const T = C.SPORT.soccer.types.st
const errs = []
const say = (...a) => console.log(...a)
const mkBuild = vals => Object.fromEntries(T.map((t, i) => [t, { type: t, val: vals[i], qb: 'Test', qbFull: 'Test Player', team: 'ARS', height: 73, weight: 172 }]))

function playSeason(c, tag) {
  if (!c.team) {
    let d = C.runDraft(c)
    const o = d.offers?.[0]
    if (!o) { errs.push(`${tag}: no offers`); return c }
    c = C.signOffer(d, o)
  }
  if (!C.SOCCER_CLUBS.some(x => x.short === c.team)) errs.push(`${tag}: club ${c.team} is not a league club`)
  let D
  ;[c, D] = [C.startSeason(c), null]
  D = C.resumeSeason(c)?.D ?? null
  let s = c, guard = 0
  const dir = () => C.resumeSeason(s)
  let R = dir()
  while (guard++ < 200) {
    const a = s.active
    if (!a) break
    if (a.moment) { const [n] = C.chooseMoment(s, R.D ?? R, 0); s = n; continue }
    const [n, ev] = C.advanceWeek(s, R.D ?? R)
    if (n === s) break
    s = n
  }
  return s
}

// a season from the start of the weeks to the next season (moments: the first option; injuries: rest)
function season(c, tag) {
  let D
  ;[c, D] = C.startSeason(c)
  say(`${tag}: season ${c.year + 1} at ${c.team} (${C.SOCCER_CLUBS.some(x => x.short === c.team) ? 'a league club' : 'NOT A LEAGUE CLUB'}), ${D.total} matches, role ${c.role}`)
  if (!C.SOCCER_CLUBS.some(x => x.short === c.team)) errs.push(`${tag}: ${c.team} is not a league club`)
  for (let guard = 0; guard < 400; guard++) {
    const a = c.active
    if (a.moment) { ;[c] = C.chooseMoment(c, D, a.moment.options[0]); continue }
    if (a.injury) { c = C.resolveInjury(c, D, false); if (Array.isArray(c)) c = c[0]; continue }
    if (a.k >= D.total) break
    const [n] = C.advanceWeek(c, D)
    if (n === c) { errs.push(`${tag}: stuck at week ${a.k}`); break }
    c = n
  }
  c = C.finishRegular(c, D)
  for (let guard = 0; guard < 20 && c.active?.po && !c.active.po.done; guard++) {
    const before = c.active.po.idx
    c = C.playoffRound(c, 0.6)
    if (Array.isArray(c)) c = c[0]
    if (c.active?.po?.idx === before && !c.active.po.done) break
  }
  if (c.active && !c.seasons.some(s => s.year === c.year + 1)) c = C.bookSeason(c)
  const s = c.seasons.at(-1)
  say(`${tag}: booked ${c.seasons.length} season(s); last: ${s ? `${s.stats?.goals ?? s.goals ?? '?'} goals, ${s.stats?.assists ?? s.assists ?? '?'} assists, finished ${s.seed ?? s.pos ?? '?'}` : 'none'}`)
  if (!s) errs.push(`${tag}: no season booked`)
  return c
}

// 1. a new career
let c = C.newCareer({ sport: 'soccer', pos: 'st', build: mkBuild([8, 8, 7, 7, 6, 8, 6, 7, 7]), name: 'Test' })
say(`new career: ${c.types.join(',')}; durability ${c.durability}; ovr ${c.ovr}`)
if (c.types.length !== 9) errs.push('types are not the nine')
try {
  c = C.skipCombine?.(c) ?? c
  const d = C.runDraft(c)
  const offers = d.draft?.offers ?? []
  say(`academy offers: ${offers.map(x => x.team).join(', ')}`)
  if (!offers.length) throw new Error('no academy offers')
  c = C.signAcademy(d, offers[0])
  c = season(c, 'new')
  const sizeBefore = c.build.size.val
  c = C.nextSeason(c)
  say(`next season: age ${c.age}, ${Object.entries(c.build).map(([t, x]) => `${t} ${x.val}`).join(', ')}`)
  if (c.build.size.val !== sizeBefore) errs.push(`size moved in the offseason: ${sizeBefore} -> ${c.build.size.val}`)
  say(`size: ${sizeBefore} before the offseason, ${c.build.size.val} after (his frame: it never moves)`)
  C.saveCareer(c)
} catch (e) { errs.push('new career: ' + e.stack.split('\n').slice(0, 4).join(' | ')) }

// 2. a career saved with the ten old ratings: the same career, its keys written back the old way
try {
  const OLD = { positioning: 'offBall', passing: 'linkUp', size: 'strength' }
  const toOld = x => {
    if (Array.isArray(x)) return x.flatMap(v => (v === 'dribbling' ? ['dribbling', 'firstTouch'] : [typeof v === 'string' ? OLD[v] ?? v : toOld(v)]))
    if (!x || typeof x !== 'object') return x
    const o = {}
    for (const [k, v] of Object.entries(x)) o[OLD[k] ?? k] = toOld(v)
    if ('dribbling' in x && 'pace' in x && x.dribbling && typeof x.dribbling === 'object' && 'val' in x.dribbling) o.firstTouch = { ...x.dribbling }
    return o
  }
  const key = [...store.keys()].find(k => k.startsWith('bap_career_soccer_'))
  const saved = JSON.parse(store.get(key))
  const old = { ...saved, build: toOld(saved.build), base: toOld(saved.base), types: toOld(saved.types) }
  store.set(key, JSON.stringify(old))
  say(`old save: types ${old.types.join(',')}`)
  let o = C.loadCareer('soccer', null, 0)
  if (!o) throw new Error('the old save did not load')
  say(`loaded: types ${o.types.join(',')}; build keys ${Object.keys(o.build).join(',')}`)
  if (o.types.length !== 9 || ['offBall', 'linkUp', 'firstTouch', 'strength'].some(k => k in o.build || o.types.includes(k))) errs.push('old save kept old keys')
  o = season(o, 'old save')
} catch (e) { errs.push('old save: ' + e.stack.split('\n').slice(0, 4).join(' | ')) }

console.log(errs.length ? `ERRORS:\n${errs.join('\n')}` : 'career: OK')
