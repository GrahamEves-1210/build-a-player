// A season in ADVANCED (2026-11-19, a player: "I think I've won Ashton Jeanty 4 MVPs with 45 TDs in a season"): every
// offensive moment of the player's games is played on its engine by the mini games' good simulated human, a run
// called whenever the call sheet has one (the way a player who's found the run works would). The back's season line
// and the league's rushing leaders after.
//   bash scripts/franchise2/run.sh scripts/franchise2/frfix-rush.mjs [team=LV] [seasons=1]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { STEP } from '../../src/lib/mg/kit.js'
import { ENGINES } from '../../src/lib/mg/index.js'
import { seeded } from '../../src/lib/rng.js'
import throwBot from '../mg/bots/throw.mjs'
import runBot from '../mg/bots/kickret.mjs'
import stopBot from '../mg/bots/hitstick.mjs'
import fadeBot from '../mg/bots/goalline.mjs'
FR.useContracts(CONTRACTS)
const team = process.argv[2] ?? 'LV', N = Number(process.argv[3] ?? 1)
const GOOD = { react: 285, reactSd: 50, timing: 26, rate: 12, slip: 0.012 }
const BOTS = { 'fr-pass': throwBot, 'fr-run': runBot, 'fr-stop': stopBot, 'fr-fade': fadeBot }
function playEngine(S, seed) {
  const E = ENGINES[S.game]
  const g = E.make({ v: S.v, arm: S.arm, seed: S.seed, def: S.def, game: S.game, sport: 'nfl', pos: S.pos, cast: S.cast, situation: S.situation })
  const r = seeded(`bot-${seed}`)
  const step = BOTS[S.game](g, GOOD, r, S.game)
  let f = 0
  while (!g.done && f++ < 90 * 120) { const a = step(); if (a) for (const x of a) g.input(x); g.tick(STEP) }
  return g.done
}
const F = FR.createFranchise({ seed: 'rush-' + team, team, owner: 'G', builds: [] })
F.games = 'advanced'
let runs = 0, runTd = 0, runYds = 0, n = 0
for (let y = 0; y < N; y++) {
  while (F.phase === 'season') {
    const r = FR.playWeek(F, { moments: true })
    if (r.pending) while (F.pend) {
      const v = FR.momentView(F)
      const calls = FR.playsFor(v)
      const pick = calls.find(c => FR.PLAYS[c].kind === 'run') ?? calls[0]
      const S = FR.playSetup(F, v, pick)
      const done = playEngine(S, `${v.seed}-${n++}`)
      const out = FR.playResult(F, v, pick, done)
      if (FR.PLAYS[pick].kind === 'run') { runs++; runYds += out.yards ?? 0; if (out.td) runTd++ }
      const named = FR.nameSnap(F, v, out)
      if (process.env.DBG && FR.PLAYS[pick].kind === 'run' && out.td) console.log('  moment TD', named.txt, JSON.stringify(named.cr), JSON.stringify(named.st))
      FR.finishMoment(F, named)
    }
    if (process.env.DBG && r.pending !== undefined) { const rb0 = Object.values(FR.lineup(F.teams[team])).find(p => p.p === 'rb'); console.log('  wk', F.wk, 'rb line', JSON.stringify(F.ss?.[rb0.i] ?? null)) }
    if (F.ev) FR.chooseEvent(F, 0)
  }
  const tot = FR.leagueStats(F)
  const rb = F.teams[team].r.filter(p => p.p === 'rb').sort((a, b) => (tot[b.i]?.ra ?? 0) - (tot[a.i]?.ra ?? 0))[0]
  const line = tot[rb.i] ?? {}
  console.log(`${F.year} ${team} ${FR.recText(FR.records(F)[team])} · ${rb.n} (OVR ${rb.o}): ${line.ry ?? 0} rushing yds, ${line.rtd ?? 0} rushing TDs in ${line.gp ?? 0} games · moment runs ${runs}: ${runYds} yds (${(runYds / Math.max(1, runs)).toFixed(1)} a carry), ${runTd} TDs`)
  const all = FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.p === 'rb').map(p => ({ n: p.n, s, ry: tot[p.i]?.ry ?? 0, td: tot[p.i]?.rtd ?? 0 })))
  console.log('  leaders:', all.sort((a, b) => b.td - a.td).slice(0, 5).map(x => `${x.n} (${x.s}) ${x.ry} yds ${x.td} TD`).join(' · '))
  if (y < N - 1) {
    FR.intoPlayoffs(F); while (F.phase === 'playoffs') { const r = FR.playWeek(F, { moments: false }); if (r.pending) while (F.pend) FR.finishMoment(F, null) }
    FR.closeSeason(F); FR.closeCarousel(F); FR.ageLeague(F); FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true)
    FR.openFA(F); while (F.fad) FR.nextFADay(F); FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
    FR.closeDraft(F); FR.autoCamp(F); FR.newSeason(F); runs = runTd = runYds = 0
  }
}
