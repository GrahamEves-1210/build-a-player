// NBA Franchise SANDBOX: League rules > Sandbox puts a build into the draft class (draft.js addSandboxProspect).
// Off: nothing goes in. On: he's in the class with the build's ratings, ranked on the board, drafted on draft night
// by somebody (or the GM), and on that team's roster after; the switch round-trips through the save.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-sandbox.mjs
import * as N from '../../src/lib/franchise2/nba/index'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
let bad = 0
const fail = (...m) => { bad++; console.log('  FAIL', ...m) }
const asB = a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { val: v }]))
const G = NBA_GUARD_PLAYERS.filter(p => p.attrs)
const F = N.createNbaFranchise({ seed: 'sbx', team: 'BOS', owner: 'G', rules: { cap: true, inj: true } })
if (F.sandbox) fail('sandbox on by default')
if (N.addSandboxProspect(F, { pos: 'guard', spot: 'PG', build: asB(G[0].attrs), name: 'Off Switch' })) fail('added with Sandbox off')
const S = N.createNbaFranchise({ seed: 'sbx2', team: 'BOS', owner: 'G', sandbox: true })
if (!S.sandbox) fail('setup sandbox not kept')
F.sandbox = true
const n0 = F.dc.length
const x = N.addSandboxProspect(F, { pos: 'guard', spot: 'PG', build: asB(G[0].attrs), name: 'Sandbox Kid' })
if (!x || F.dc.length !== n0 + 1 || x.p !== 'PG' || !x.sb || !(x.rank >= 1)) fail('not added', JSON.stringify(x))
if (new Set(F.dc.map(p => p.rank)).size !== F.dc.length) fail('ranks not unique')
console.log(`added: ${x.n} ${x.p} ${x.o} (ceiling ${x.pk}), board rank ${x.rank} of ${F.dc.length}, ${x.c}`)
const B = N.unpackNba(N.packNba(F))
if (!B.sandbox || !B.dc.some(p => p.sb && p.n === 'Sandbox Kid')) fail('save round trip')
N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
while (F.off.step !== 'draft') N.nextStep(F)
if (!N.canSandbox(F)) fail('closed before the first pick')
let g = 0
while (N.onClock(F) && g++ < 80) { const pk = N.onClock(F); if (pk.t === F.team) N.makePick(F, N.available(F).sort((a, b) => a.rank - b.rank)[0].i); else N.draftTo(F) }
if (N.canSandbox(F)) fail('open after the draft')
N.nextStep(F)
const s = N.SHORTS.find(t => F.teams[t].r.some(p => p.n === 'Sandbox Kid'))
const m = s && F.teams[s].r.find(p => p.n === 'Sandbox Kid')
console.log(`drafted: ${m ? `${s}, pick ${m.dr?.[2]}, $${m.$}M x${m.y}` : 'not on a roster'}`)
if (!m && !(F.fa ?? []).some(p => p.n === 'Sandbox Kid')) fail('he went nowhere')
console.log(bad ? `${bad} FAIL` : 'ALL OK')
if (bad) process.exit(1)
