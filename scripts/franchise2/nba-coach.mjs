// NBA Franchise: the coaches are real and modest. (coach.js)
//   1. Wins: one team's games against the league with the best staff possible, the real best (Spoelstra's lines), the
//      real worst and the worst possible, everything else the same (the same games, the same dice).
//   2. Development: young men's OVR over three summers under the best staff and the worst.
//   3. The setup's coach and hires on the save, the carousel over a few seasons (firings, hires a year), the save
//      round trip and an older save (no staffs, no pace) loading.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-coach.mjs [games-per-opponent=6] [seasons=3]
import * as N from '../../src/lib/franchise2/nba/index'
import { ageMan } from '../../src/lib/franchise2/nba/aging'
import { rngOf } from '../../src/lib/franchise2/rng'
const C = N.NC
const GPO = +(process.argv[2] ?? 6), SEASONS = +(process.argv[3] ?? 3)
let bad = 0
const fail = m => { bad++; console.log('FAIL', m) }

// ── 1. wins ──────────────────────────────────────────────────────────────────
const five = v => Array(5).fill(v)
const arr = o => C.CTYPES.map(t => o[t])
// the best and worst head coach the wheel can build (the best and worst real line of each), good and poor assistants
const lineMax = C.CTYPES.map(t => Math.max(...N.SHORTS.map(s => C.realHC(s).attrs[t]))), lineMin = C.CTYPES.map(t => Math.min(...N.SHORTS.map(s => C.realHC(s).attrs[t])))
const STAFFS = {
  best: { hc: lineMax, as: five(9) },
  spoelstra: { hc: arr(C.realHC('MIA').attrs), as: five(6) },
  average: null,
  keefe: { hc: arr(C.realHC('WAS').attrs), as: five(6) },
  worst: { hc: lineMin, as: five(3) },
}
const teams = ['BOS', 'CHA', 'DEN', 'SAC', 'NYK']
const res = {}
for (const X of teams) {
  for (const [k, st] of Object.entries(STAFFS)) {
    const F = N.createNbaFranchise({ seed: `coach-${X}`, team: 'ATL', owner: 'chk' })
    if (st) { const T = F.staff[X]; T.hc.r = [...st.hc]; for (const j of C.JOBS) T[j].r = [...st.as] }
    let w = 0, g = 0, pts = 0, opp = 0
    for (const o of N.SHORTS) {
      if (o === X) continue
      for (let j = 0; j < GPO; j++) {
        const home = j % 2 === 0
        const r = home ? N.CAP_SIM.simGame(F, X, o, { seed: `${X}-${o}-${j}` }) : N.CAP_SIM.simGame(F, o, X, { seed: `${o}-${X}-${j}` })
        const us = home ? r.hs : r.as, them = home ? r.as : r.hs
        w += us > them ? 1 : 0; g++; pts += us; opp += them
      }
    }
    ;(res[X] ??= {})[k] = { w82: (w / g) * 82, net: (pts - opp) / g, ppg: pts / g }
  }
  const r = res[X]
  console.log(`${X}  ` + Object.entries(r).map(([k, x]) => `${k} ${x.w82.toFixed(1)}w ${x.net >= 0 ? '+' : ''}${x.net.toFixed(1)}`).join(' | '))
}
const avg = k => teams.reduce((a, X) => a + res[X][k].w82, 0) / teams.length
const avgNet = k => teams.reduce((a, X) => a + res[X][k].net, 0) / teams.length
const swing = avg('best') - avg('worst'), real = avg('spoelstra') - avg('keefe')
console.log(`\nWINS /82 (avg of ${teams.length} teams, ${GPO * 29} games each): best ${avg('best').toFixed(1)} · Spoelstra ${avg('spoelstra').toFixed(1)} · average ${avg('average').toFixed(1)} · Keefe ${avg('keefe').toFixed(1)} · worst ${avg('worst').toFixed(1)}`)
console.log(`NET RATING a game: best ${avgNet('best').toFixed(2)} · average ${avgNet('average').toFixed(2)} · worst ${avgNet('worst').toFixed(2)}`)
console.log(`swing best-worst possible ${swing.toFixed(1)} wins · real best-worst head coach ${real.toFixed(1)} wins`)
if (!(swing > 5 && swing < 15)) fail(`best-worst swing ${swing.toFixed(1)} outside 5-15 wins`)
if (!(real > 1.5 && real < 9)) fail(`Spoelstra-Keefe ${real.toFixed(1)} outside 1.5-9 wins`)

// pace and threes: the PACE AND SPACE style against DEFENSE FIRST
{
  const F = N.createNbaFranchise({ seed: 'coach-pace', team: 'BOS', owner: 'chk', coach: { name: 'Pace Test', r: { dev: 6, off: 6, def: 6, rot: 6, late: 6 }, style: 'pace' } })
  const run = st => {
    F.coach.style = st
    let fga = 0, tpa = 0, g = 0, pts = 0
    for (const o of N.SHORTS) if (o !== 'BOS') for (let j = 0; j < 4; j++) {
      const r = N.CAP_SIM.simGame(F, 'BOS', o, { seed: `p-${o}-${j}` })
      for (const l of r.box.BOS) { fga += l.fga; tpa += l.tpa }
      pts += r.hs; g++
    }
    return { fga: fga / g, tpa: tpa / g, pts: pts / g }
  }
  const a = run('pace'), b = run('defense'), c = run('developer')
  console.log(`\nSTYLE  pace-and-space ${a.fga.toFixed(1)} FGA ${a.tpa.toFixed(1)} 3PA ${a.pts.toFixed(1)} pts · neutral ${c.fga.toFixed(1)} FGA ${c.tpa.toFixed(1)} 3PA · defense-first ${b.fga.toFixed(1)} FGA ${b.tpa.toFixed(1)} 3PA ${b.pts.toFixed(1)} pts`)
  if (!(a.fga > c.fga && c.fga > b.fga && a.tpa > c.tpa)) fail('style pace/threes not in order')
}

// ── 2. development ───────────────────────────────────────────────────────────
{
  const F = N.createNbaFranchise({ seed: 'coach-dev', team: 'ATL', owner: 'chk' })
  const young = N.SHORTS.flatMap(s => F.teams[s].r).filter(p => p.ag <= 22)
  const devOf = st => { const T = F.staff.BOS; T.hc.r = [...st.hc]; for (const j of C.JOBS) T[j].r = [...st.as] }
  const grow = st => {
    if (st) devOf(st)
    let d = 0
    for (const p0 of young) {
      const p = JSON.parse(JSON.stringify(p0)), R = rngOf(`dev-${p.i}`)
      for (let y = 0; y < 3; y++) ageMan(p, R, { mpg: 20, coach: st ? C.coachDev(F, 'BOS', p) : 0 })
      d += p.o - p0.o
    }
    return d / young.length
  }
  const none = grow(null), best = grow(STAFFS.best), sp = grow(STAFFS.spoelstra), worst = grow(STAFFS.worst)
  console.log(`\nDEVELOPMENT (${young.length} men 22 and under, OVR over three summers): no coach ${none.toFixed(2)} · best ${best.toFixed(2)} · Spoelstra ${sp.toFixed(2)} · worst ${worst.toFixed(2)}`)
  console.log(`  a summer: best +${((best - none) / 3).toFixed(2)} · worst ${((worst - none) / 3).toFixed(2)} OVR`)
  if (!(best - worst > 1.5 && best - worst < 8)) fail(`development spread ${(best - worst).toFixed(2)} over three summers outside 1.5-8`)
}

// ── 3. the setup, the carousel, the saves ────────────────────────────────────
{
  const cb = C.newCoachBuild('s1', 'BOS')
  let b = cb
  for (const t of C.CTYPES) { b = { ...b, cur: C.dealSpin(b), n: b.n + 1 }; b = C.takeLine(b, t) }
  if (!C.linesDone(b)) fail('coach build lines not done')
  const coach = C.finishCoach(b, { name: 'Sam Test', face: null, style: 'developer' })
  const hires = Object.fromEntries(C.JOBS.map(k => [k, C.setupCandidates('s1', 'BOS', k)[2]]))
  const F = N.createNbaFranchise({ seed: 'coach-car', team: 'BOS', owner: 'chk', coach, staff: hires, pace: 'light' })
  if (F.pace !== 'light') fail('pace not on the save')
  if (!F.staff.BOS.hc.mine) fail('the GM coach is not the hc')
  for (const k of C.JOBS) if (F.staff.BOS[k].n !== hires[k].n) fail(`hire ${k} not placed`)
  if (!F.cpool.some(c => c.n === 'Joe Mazzulla')) fail('Mazzulla not in the pool')
  console.log(`\nSETUP  coach ${coach.name} ${JSON.stringify(coach.r)} · hires ${C.JOBS.map(k => `${k} ${F.staff.BOS[k].n}`).join(', ')} · pool ${F.cpool.length}`)
  for (let y = 0; y < SEASONS; y++) {
    N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F)
    N.closeSeason(F)
    const ev = F.cev?.ev ?? []
    const coy = F.hist.at(-1).coy
    console.log(`${F.year}  fired ${ev.filter(e => e.k === 'fire').map(e => `${e.s} ${e.n} (${e.rec})`).join(', ') || '-'} | retired ${ev.filter(e => e.k === 'ret').length} | hired ${ev.filter(e => e.k === 'hire').map(e => `${e.s} ${e.n}${e.from ? ` [${e.from}]` : ''}`).join(', ') || '-'} | COY ${coy ? `${coy.n} ${coy.s} ${coy.rec}` : '-'} | pool ${F.cpool.length}`)
    // the GM's offseason: interview two for player development and hire the better one
    const list = C.staffCandidates(F, 'pd')
    for (const c of list.slice(0, 2)) C.interviewStaff(F, 'pd', c.i)
    const pick = list.slice(0, 2).sort((a, b) => b.r[0] - a.r[0])[0]
    if (!C.hireStaff(F, 'pd', pick.i)) fail('offseason hire failed')
    while (F.phase === 'off') {
      if (F.off.step === 'camp') {
        const T = F.teams[F.team]
        while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i)
        for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
      }
      N.nextStep(F)
    }
    for (const s of N.SHORTS) { const T = F.staff[s]; if (!T.hc || C.JOBS.some(k => !T[k])) fail(`${s} staff not full at the new season`) }
  }
  const json = N.packNba(F), G = N.unpackNba(json)
  N.upgradeNba(G)
  if (JSON.stringify(G.staff.BOS) !== JSON.stringify(F.staff.BOS)) fail('staff changed across a save')
  console.log(`SAVE  ${(json.length / 1024).toFixed(0)} KB, staffs + pool ${(JSON.stringify({ s: F.staff, p: F.cpool }).length / 1024).toFixed(1)} KB`)
  // an older save: no staffs, no pace, no coach
  const O = JSON.parse(json)
  delete O.staff; delete O.cpool; delete O.pace; delete O.coach; delete O.cid
  const Q = N.unpackNba(JSON.stringify(O)); N.upgradeNba(Q)
  if (Q.pace !== 'full') fail('old save pace')
  if (Q.staff.BOS.hc?.n !== 'Joe Mazzulla') fail('old save: its team keeps its real head coach')
  const r = N.CAP_SIM.simGame(Q, 'BOS', 'NYK', { seed: 'old' })
  if (!(r.hs > 60 && r.as > 60)) fail('old save game')
  console.log(`OLD SAVE  pace ${Q.pace}, BOS head coach ${Q.staff.BOS.hc.n}, a game ${r.hs}-${r.as}`)
}
console.log(bad ? `\n${bad} FAILED` : '\nALL OK')
if (bad) process.exit(1)
