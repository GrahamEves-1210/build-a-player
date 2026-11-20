// Career specialties (2026-11-20), end to end through lib/career.js loaded the way the app loads it (Vite):
//   - every football and basketball position stamps a specialty on a new career, from its build
//   - a specialty trait's training window runs SPEC_TRAIN years longer than the same trait off-specialty
//   - its fade starts SPEC_FADE years later and runs slower: the grades lost by age, specialty vs not, over many
//     seeded careers (aging only, lib/careerAging.js fadeYear), and a speedster still loses speed by his mid-30s
//   - a save from before (no specialty) opens with one from its current build, every grade unchanged
//   - the 3-point cap on a grade (COST_MAX) still holds
// Run from the repo root:  node scripts/moments/specialty-check.mjs
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const A = await server.ssrLoadModule('/src/lib/careerAging.js')
const SP = await server.ssrLoadModule('/src/lib/careerSpecialty.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')

let bad = 0
const fail = (...a) => { bad++; console.log('FAIL', ...a) }
const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
const CASES = [['nfl', 'qb'], ['nfl', 'rb'], ['nfl', 'wr'], ['nfl', 'te'], ['nfl', 'db'], ['nfl', 'dl'], ['nfl', 'lb'], ['nfl', 'ol'], ['nfl', 'k'], ['bucket', 'guard'], ['bucket', 'big']]

// 1. new careers: a specialty, its traits on his card, and a note for the player page
console.log('── specialties by position (20 builds each) ──')
for (const [sport, pos] of CASES) {
  const S = C.SPORT[sport], seen = {}
  for (let i = 0; i < 20; i++) {
    const c = C.newCareer({ sport, pos, build: buildFor(S, pos, seeded(`spec-${pos}-${i}`)), name: 'Cole Norwood', owner: 'Guest' })
    if (!c.specialty?.traits?.length) { fail(pos, i, 'no specialty'); continue }
    if (!c.specialty.traits.every(t => c.types.includes(t))) fail(pos, i, 'specialty trait not on the card', c.specialty.traits)
    if (!c.specialty.traits.every(t => A.fadeOf(sport, pos, t) || C.trainWindow({ ...c, age: 0 }, t))) fail(pos, i, 'a specialty trait that neither trains nor fades', c.specialty.traits)
    seen[c.specialty.label] = (seen[c.specialty.label] ?? 0) + 1
    if (i === 0) { const n = C.specialtyNote(c); if (!n?.text || /\byou\b/i.test(n.text)) fail(pos, 'note', n?.text); console.log(`  ${pos.padEnd(5)} ${n.label}: ${n.text}`) }
  }
  console.log(`  ${pos.padEnd(5)} ${Object.entries(seen).map(([k, n]) => `${k} ${n}`).join(' · ')}`)
}

// 2. training windows: the same trait, specialty or not
console.log('\n── training windows (last age a trait trains), specialty vs not ──')
for (const [sport, pos] of CASES) {
  const S = C.SPORT[sport]
  const c = C.newCareer({ sport, pos, build: buildFor(S, pos, seeded(`spec-w-${pos}`)), name: 'Cole Norwood', owner: 'Guest' })
  const row = []
  for (const t of c.types) {
    const on = C.trainWindow({ ...c, age: 22, specialty: { traits: [t] } }, t), off = C.trainWindow({ ...c, age: 22, specialty: { traits: [] } }, t)
    if (!on && !off) continue
    if (on.until !== off.until + SP.SPEC_TRAIN || on.full !== off.full + SP.SPEC_TRAIN) fail(pos, t, 'window', off, on)
    row.push(`${t} ${off.until}→${on.until}`)
  }
  console.log(`  ${pos.padEnd(5)} ${row.join(' · ')}`)
}

// 3. aging: grades lost by age, specialty vs not (500 seeded bodies a trait, the build at A, durability C+)
console.log('\n── grades lost to age by 31 / 33 / 35 / 37 (no offseason work), off specialty → on ──')
const lostBy = (sport, pos, t, spec, declineAt) => {
  const ages = [31, 33, 35, 37], out = ages.map(() => 0), N = 500
  for (let i = 0; i < N; i++) {
    let build = { [t]: { val: 9 } }
    for (let age = 23, yr = 1; age <= 37; age++, yr++) {
      build = A.fadeYear({ sport, pos, types: [t], build, seed: `age-${i}`, year: yr, age, durability: 5, declineAt, spec: spec ? [t] : [] }).build
      const k = ages.indexOf(age)
      if (k >= 0) out[k] += 9 - Math.round(build[t].val)
    }
  }
  return out.map(x => (x / N).toFixed(1))
}
for (const [sport, pos] of CASES) {
  const S = C.SPORT[sport], dec = S.declineAt(pos)
  const row = []
  for (const t of Object.keys(A.FADE[sport][pos])) {
    const off = lostBy(sport, pos, t, false, dec), on = lostBy(sport, pos, t, true, dec)
    for (let k = 0; k < 4; k++) if (Number(on[k]) > Number(off[k])) fail(pos, t, 'specialty ages faster', off, on)
    if (A.fadeOf(sport, pos, t, true).from !== A.fadeOf(sport, pos, t).from + SP.SPEC_FADE) fail(pos, t, 'fade start')
    row.push(`${t} ${off.join('/')} → ${on.join('/')}`)
  }
  console.log(`  ${pos.padEnd(5)} ${row.join('\n        ')}`)
}
// a speedster still loses speed by his mid-30s
{ const by37 = Number(lostBy('nfl', 'wr', 'speed', true, 30)[3]); if (by37 < 1.5) fail('wr speedster keeps his speed into his late 30s', by37); console.log(`\n  WR speedster: ${by37} grades of speed lost by 37 (by 35: ${lostBy('nfl', 'wr', 'speed', true, 30)[2]})`) }

// 4. a save from before: a specialty from the current build, no grade moves
{
  const S = C.SPORT.nfl
  const c0 = C.newCareer({ sport: 'nfl', pos: 'wr', build: buildFor(S, 'wr', seeded('spec-old')), name: 'Cole Norwood', owner: 'Guest' })
  const { specialty, ...old } = c0
  const grades = JSON.stringify(Object.fromEntries(old.types.map(t => [t, old.build[t].val])))
  localStorage.setItem('bap_career_nfl_guest', JSON.stringify(old))
  const c = C.loadCareer('nfl', null, 0)
  if (!c?.specialty?.traits?.length) fail('old save: no specialty on open')
  else if (JSON.stringify(c.specialty) !== JSON.stringify(SP.specialtyFor('nfl', 'wr', old.build))) fail('old save: specialty not from its build')
  if (JSON.stringify(Object.fromEntries(c.types.map(t => [t, c.build[t].val]))) !== grades) fail('old save: a grade moved')
  console.log(`\n  old save opens as: ${c?.specialty?.label} (${c?.specialty?.traits.join(', ')}), grades unchanged`)
}

// 5. the cap: no grade ever costs more than 3
{
  if (C.COST_MAX !== 3) fail('COST_MAX', C.COST_MAX)
  const S = C.SPORT.nfl
  let c = C.newCareer({ sport: 'nfl', pos: 'wr', build: buildFor(S, 'wr', seeded('spec-cap')), name: 'Cole Norwood', owner: 'Guest' })
  c = { ...c, seasons: [{}], age: 33 }
  for (const t of c.types) for (const v of [8, 9, 10]) { const k = C.upgradeCost(v, { ...c, build: { ...c.build, [t]: { ...c.build[t], val: v } } }, t); if (k > 3) fail('cost over 3', t, v, k) }
}

console.log(bad ? `\n${bad} FAILED` : '\nall specialty checks passed')
await server.close()
process.exit(bad ? 1 : 0)
