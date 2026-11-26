// NBA Franchise: a build takes the named starter's spot only (rotation.js buildFive). With every man healthy the man
// he replaced comes off the bench; with that man hurt the coach fills the five around the injury and no better
// healthy starter goes to the bench because of the build. Every team, a build at each spot, each starter hurt in turn.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-buildstart.mjs
import * as N from '../../src/lib/franchise2/nba/index'
import { setupStarters } from '../../src/lib/franchise2/nba/setup'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
let bad = 0, n = 0, hurt = 0
const fail = (...m) => { bad++; if (bad < 30) console.log('  FAIL', ...m) }
const asB = a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { val: v }]))
const G = NBA_GUARD_PLAYERS.filter(p => p.attrs), B = NBA_BIG_PLAYERS.filter(p => p.attrs)
const grp = k => (k === 'PF' || k === 'C' ? 'big' : 'guard')
for (const team of N.SHORTS) for (const spot of N.SPOTS) {
  const picks = [{ id: 'b0', pos: grp(spot), spot }]
  // (a middling build, so the named man is often better than him)
  const builds = { b0: { pos: grp(spot), build: asB((grp(spot) === 'big' ? B : G)[40].attrs), name: 'Test Build', num: 90 } }
  const S = { seed: 'bs-a', team, picks, builds, rules: { cap: true, inj: true } }
  const F = N.createNbaFranchise({ seed: S.seed, team, owner: 'G', rules: S.rules, builds: [{ ...builds.b0, spot }] })
  const T = F.teams[team], five = setupStarters(S), named = T.r.find(x => x.n === five[spot]?.n)
  const b = T.r.find(x => x.b != null)
  const st0 = new Set(N.CAP_SIM.rotationOf(F, team).filter(x => x.st).map(x => x.i))
  if (!st0.has(b.i)) fail(team, spot, 'build not starting')
  if (named && st0.has(named.i)) fail(team, spot, named.n, 'named man still starts while healthy')
  n++
  // each other starter, and the named man, hurt in turn
  for (const out of T.r.filter(x => st0.has(x.i) && x !== b).concat(named ? [named] : [])) {
    out.inj = { g: 10, k: 'sprained ankle' }
    const rot = N.CAP_SIM.rotationOf(F, team), st = new Set(rot.filter(x => x.st).map(x => x.i))
    if (!st.has(b.i)) fail(team, spot, 'build benched with', out.n, 'out')
    // no healthy man who started before the injury goes to the bench, unless the named man came back into the five
    const healthy = T.r.filter(x => st0.has(x.i) && x !== out && x !== b)
    for (const h of healthy) if (!st.has(h.i)) {
      // allowed only for the coach's own reshuffle with no build at all: check that the coach without the build benches him too
      const noB = N.CAP_SIM.planRotation(N.CAP_SIM.dressed({ ...T, r: T.r.filter(x => x !== b) }, { year: F.year }), {})
      if (noB.st.includes(h.i) && (h.o ?? 0) >= Math.min(...[...st].map(i => T.r.find(x => x.i === i).o))) fail(team, spot, `${out.n} out: ${h.n} (${h.o}) benched behind`, [...st].map(i => { const m = T.r.find(x => x.i === i); return `${m.n} ${m.o}` }).join(', '))
    }
    delete out.inj; hurt++
  }
}
console.log(`build starts: ${n} setups, ${hurt} injuries tried${bad ? `, ${bad} FAIL` : ', ok'}`)
if (bad) process.exit(1)
