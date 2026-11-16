// WORLD CUP mode's legends, checked (2026-11-16): node scripts/soccer/wc-legends-check.mjs [tournaments=600]
//  - the 48 nations: 48 codes, each once, att / def / ovr / group (twelve groups of four), a flag in public/logos/nations
//  - the legends: exactly the nine keys of data/soccer-attrs.js, each an integer 0-11; Size = soccerSizeGrade of his bio;
//    2-6 a nation; one main striker a nation; attackers and midfielders only; a bio (height, foot, years, peak, age)
//  - every card can be landed on a spin: every legend's nation is on the wheel (SoccerApp TEAMS_OF.alltime = WC_NATIONS)
//    and has players to spin; no name|nation twice
//  - the decade spread (by the year of his peak): most of the pool from the 1990s on, few before 1980
//  - Career's World Cup still plays the real 2026 nations (team.wc 2026), an old save's 2026 nation still plays, a
//    legends season says 'All-Time'; old share links still read the 2026 squads, new ones the legends
//  - N all-time World Cups: who wins them (the favourites most of the time, upsets too)
import { build } from 'esbuild'
import fs from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { WC_NATIONS, WC2026_NATIONS, WC_ALL_NATIONS } from '../../src/data/soccer-nations.js'
import { WC_STRIKERS, WC2026_STRIKERS } from '../../src/data/soccer-strikers.js'
import { SOCCER_TYPES, soccerSizeGrade } from '../../src/data/soccer-attrs.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const N = Number(process.argv[2] ?? 600)
const errs = []
const err = m => { if (errs.length < 80) errs.push(m) }

// ── the nations ──
const codes = new Set(WC_NATIONS.map(n => n.short))
if (WC_NATIONS.length !== 48 || codes.size !== 48) err(`WC_NATIONS: ${WC_NATIONS.length} rows, ${codes.size} codes`)
for (const n of WC_NATIONS) {
  if (!n.name || !/^#[0-9A-Fa-f]{6}$/.test(n.color) || !/^#[0-9A-Fa-f]{6}$/.test(n.color2)) err(`${n.short}: name or colours`)
  if (!(n.att > 0 && n.att <= 100 && n.def > 0 && n.def <= 100 && n.ovr > 0)) err(`${n.short}: att ${n.att} def ${n.def} ovr ${n.ovr}`)
  if (!fs.existsSync(join(ROOT, 'public', 'logos', 'nations', `${n.short}.png`))) err(`${n.short}: no flag`)
}
for (const g of 'ABCDEFGHIJKL') { const k = WC_NATIONS.filter(n => n.group === g).length; if (k !== 4) err(`group ${g}: ${k} nations`) }
if (WC2026_NATIONS.length !== 48 || WC2026_STRIKERS.length !== 240) err(`the 2026 lists changed: ${WC2026_NATIONS.length} nations, ${WC2026_STRIKERS.length} players`)
for (const n of WC2026_NATIONS) if (!WC_ALL_NATIONS.some(x => x.short === n.short)) err(`WC_ALL_NATIONS misses ${n.short}`)

// ── the legends ──
const ROLES = new Set(['ST', 'SS', 'LW', 'RW', 'AM', 'CM', 'DM'])
const seen = new Set()
for (const p of WC_STRIKERS) {
  const k = Object.keys(p.attrs ?? {})
  if (k.length !== 9 || !SOCCER_TYPES.every(t => k.includes(t))) err(`${p.name}: keys ${k.join(',')}`)
  for (const t of SOCCER_TYPES) { const v = p.attrs?.[t]; if (!Number.isInteger(v) || v < 0 || v > 11) err(`${p.name}: ${t} = ${v}`) }
  if (soccerSizeGrade(p.height, p.weight, p.role) !== p.attrs.size) err(`${p.name}: size ${p.attrs.size} is not his bio's`)
  if (!ROLES.has(p.role) || p.position !== 'ST') err(`${p.name}: role ${p.role} / position ${p.position}`)
  if (!(p.height > 60) || !['left', 'right', 'both'].includes(p.foot) || !/^\d{4}–\d{4}$/.test(p.years ?? '') || !(p.peak >= 1950 && p.peak <= 2026) || !(p.age >= 16 && p.age <= 40)) err(`${p.name}: bio ${p.height} ${p.foot} ${p.years} ${p.peak} ${p.age}`)
  if (p.team !== p.nation) err(`${p.name}: team ${p.team} nation ${p.nation}`)
  if (!codes.has(p.team)) err(`card ${p.name}: ${p.team} is not on the wheel`)
  const key = `${p.name}|${p.team}`
  if (seen.has(key)) err(`card ${key} twice`)
  seen.add(key)
}
for (const n of WC_NATIONS) {
  const mine = WC_STRIKERS.filter(p => p.team === n.short)
  if (mine.length < 2 || mine.length > 6) err(`${n.short}: ${mine.length} legends`)
  if (mine.filter(p => p.starter).length !== 1) err(`${n.short}: ${mine.filter(p => p.starter).length} main strikers`)
}
const byDec = {}
for (const p of WC_STRIKERS) { const d = `${Math.floor(p.peak / 10) * 10}s`; byDec[d] = (byDec[d] ?? 0) + 1 }
const pre80 = WC_STRIKERS.filter(p => p.peak < 1980).length, since90 = WC_STRIKERS.filter(p => p.peak >= 1990).length
if (pre80 > 8) err(`${pre80} legends peaked before 1980`)
if (since90 / WC_STRIKERS.length < 0.75) err(`only ${since90} of ${WC_STRIKERS.length} legends peaked in 1990 or later`)
const S = Object.fromEntries(SOCCER_TYPES.map(t => [t, WC_STRIKERS.filter(p => p.attrs[t] === 11).length]))

// ── the engine ──
const outDir = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
fs.mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, `wcl-${Date.now()}.mjs`)
const entry = ["export * from './src/utils/soccerSimulation.js'", "export { encodeSoccerBuild, decodeSoccerBuild } from './src/lib/soccerShare.js'"].join(';')
await build({ stdin: { contents: entry, resolveDir: ROOT }, bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error', define: { 'import.meta.env': '{}' } })
const Sim = await import(pathToFileURL(outfile).href)
const { encodeSoccerBuild, decodeSoccerBuild } = Sim
// ── share links ──
const asPool = (list, pool) => list.map(p => ({ ...p, pool }))
const pools = { current: [], alltime: asPool(WC_STRIKERS, 'alltime'), wc2026: asPool(WC2026_STRIKERS, 'alltime') }
const pick = (list, i) => ({ qbFull: list[i].name, team: list[i].team, val: 9 })
const shareBuild = Object.fromEntries(SOCCER_TYPES.map((t, i) => [t, pick(WC_STRIKERS, i * 17 % WC_STRIKERS.length)]))
const code = encodeSoccerBuild(shareBuild, SOCCER_TYPES, 'alltime', pools)
const back = decodeSoccerBuild(code, pools, () => null)
if (!code?.startsWith('L.') || !back || SOCCER_TYPES.some(t => back.build[t].qbFull !== shareBuild[t].qbFull)) err(`a legends link doesn't come back: ${code}`)
const oldBuild = Object.fromEntries(SOCCER_TYPES.map((t, i) => [t, pick(WC2026_STRIKERS, i * 23 % 240)]))
const oldCode = encodeSoccerBuild(oldBuild, SOCCER_TYPES, 'alltime', { alltime: pools.wc2026 }).slice(2)   // (as an old link was: no 'L.')
const oldBack = decodeSoccerBuild(oldCode, pools, () => null)
if (!oldBack || SOCCER_TYPES.some(t => oldBack.build[t].qbFull !== oldBuild[t].qbFull)) err('an old World Cup link no longer shows its players')

const T = Sim.SOCCER_TRAITS
const mk = v => Object.fromEntries(T.map(t => [t, { type: t, val: v }]))
const leg = Sim.runSoccerSimulation(mk(7), T, { short: 'BRA' }, 'alltime', 'wcl-a')
const car = Sim.runSoccerSimulation(mk(7), T, { short: 'ENG', wc: 2026, usage: 1 }, 'alltime', 'wcl-b')
const old = Sim.runSoccerSimulation(mk(7), T, { short: 'HAI' }, 'alltime', 'wcl-c')
if (leg.season !== 'All-Time' || leg.wcField !== 'legends' || leg.groups && Object.values(leg.groups).flat().some(r => !codes.has(r.short))) err(`a legends World Cup: ${leg.season} ${leg.wcField}`)
const carCodes = new Set(Object.values(car.groups ?? {}).flat().map(r => r.short))
if (car.season !== '2026' || car.wcField !== 'wc2026' || !carCodes.has('CUW') || carCodes.has('ITA')) err(`Career's World Cup is not the 2026 field: ${car.season} ${car.wcField}`)
if (old.season !== '2026' || old.team?.short !== 'HAI' || !old.finish) err(`an old save's nation (HAI) doesn't play: ${old.season} ${old.team?.short} ${old.finish}`)
const sq = Sim.scriptSoccerSeason({ short: 'ARG' }, { att: 96, def: 96 }, 'wcl-d', 'alltime')
const sqLine = Sim.runSoccerSimulation(mk(8), T, { short: 'ARG', usage: 0.8 }, 'alltime', 'wcl-e', 'classic', sq)
if (sq.wcField !== 'legends' || sqLine.finish !== sq.finish) err(`Squad Builder's World Cup script: ${sq.wcField} ${sq.finish} vs ${sqLine.finish}`)
// who wins: an average striker at each nation in turn (his nation plays at its own strength)
const champ = {}, finals = {}
for (let i = 0; i < N; i++) {
  const n = WC_NATIONS[i % 48]
  const r = Sim.runSoccerSimulation(mk(5), T, { short: n.short }, 'alltime', `wcl-t${i}`)
  champ[r.worldChampion] = (champ[r.worldChampion] ?? 0) + 1
  for (const s of [r.bracket?.final?.home, r.bracket?.final?.away]) if (s) finals[s] = (finals[s] ?? 0) + 1
}
// Career reads the 2026 lists (its national teams, call-ups and rivals) and plays its World Cups on the 2026 field
const CAREER = fs.readFileSync(join(ROOT, 'src', 'lib', 'careerSoccer.js'), 'utf8')
if (!/import \{ WC2026_NATIONS as WC_NATIONS \}/.test(CAREER) || !/WC2026_STRIKERS as WC_STRIKERS/.test(CAREER) || !/short: c\.nation, wc: 2026/.test(CAREER)) err('Career is not wired to the 2026 nations')
const FAV = ['BRA', 'GER', 'ARG', 'FRA', 'ITA', 'ESP']
const favShare = FAV.reduce((s, k) => s + (champ[k] ?? 0), 0) / N
if (favShare < 0.5 || favShare > 0.9) err(`the six favourites won ${(favShare * 100).toFixed(0)}% (want most, not all)`)

console.log(`${WC_NATIONS.length} nations, ${WC_STRIKERS.length} legends (${WC_NATIONS.map(n => WC_STRIKERS.filter(p => p.team === n.short).length).join('/')}), ${WC_STRIKERS.filter(p => p.espn != null).length} with an ESPN id`)
console.log(`decades (peak): ${Object.entries(byDec).sort().map(([d, k]) => `${d} ${k}`).join(', ')} · before 1980 ${pre80}, 1990 on ${since90} (${(since90 / WC_STRIKERS.length * 100).toFixed(0)}%)`)
console.log(`S grades: ${Object.entries(S).map(([t, k]) => `${t} ${k}`).join(', ')}`)
console.log(`${N} all-time World Cups, champions: ${Object.entries(champ).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N * 100).toFixed(1)}%`).join(', ')}`)
console.log(`finalists: ${Object.entries(finals).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${(v / N * 100).toFixed(0)}%`).join(', ')}`)
console.log(`the six favourites (${FAV.join(', ')}) won ${(favShare * 100).toFixed(1)}%; ${Object.keys(champ).length} different champions`)
console.log(`legends World Cup ${leg.season}: ${leg.team?.name} ${leg.finish}; Career ${car.season}: England ${car.finish}; old save HAI ${old.season}: ${old.finish}`)
console.log(errs.length ? `ERRORS (${errs.length}):\n${errs.join('\n')}` : 'nine keys, 2-6 a nation, 48 nations, every card spinnable, decades, Career and old saves: OK')
try { fs.unlinkSync(outfile) } catch {}
process.exitCode = errs.length ? 1 : 0
