// FRANCHISE: a team as the game sim sees it on game day. Built once a game from the men who dress (depth.js
// lineupOf): what each one is good at (the same rating blends lib/teamSeason.js uses, 0-1), the units they add
// up to, who the ball goes to, who makes the plays on defense, and what the staff and the week's work add.
import { clamp } from './consts'
import { lineupOf, olFit } from './depth'
import { playcall } from './rows'
import { lastName } from './players'

// ── What a man is good at (0-1.1) ────────────────────────────────────────────
export function skillsOf(p) {
  const A = p.a, N = k => (A[k] ?? 5) / 11
  switch (p.pos) {
    case 'qb': {
      const arm = N('arm'), legs = N('legs'), sz = N('size'), proc = N('processing'), vis = N('vision'), play = N('playmaking'), acc = N('accuracy'), pock = N('pocket-presence'), ldr = N('leadership')
      return {
        comp: acc * 0.52 + vis * 0.18 + proc * 0.16 + pock * 0.14,
        deep: arm * 0.5 + acc * 0.3 + vis * 0.2,
        ypa: arm * 0.32 + acc * 0.30 + vis * 0.18 + pock * 0.10 + proc * 0.10,
        td: acc * 0.30 + vis * 0.25 + proc * 0.25 + arm * 0.10 + play * 0.10,
        intAvoid: proc * 0.45 + acc * 0.28 + pock * 0.15 + vis * 0.12,
        sackAvoid: pock * 0.55 + legs * 0.30 + proc * 0.15,
        legs: legs * 0.75 + play * 0.15 + sz * 0.10,
        sneak: legs * 0.4 + sz * 0.6,
        clutch: ldr * 0.6 + proc * 0.4,
      }
    }
    case 'rb': {
      const spd = N('speed'), bur = N('burst'), str = N('strength'), sz = N('size'), bal = N('balance'), elu = N('elusiveness'), vis = N('vision'), hnd = N('hands'), car = N('carrying')
      return {
        run: vis * 0.20 + bur * 0.17 + elu * 0.17 + spd * 0.14 + bal * 0.14 + str * 0.10 + sz * 0.08,
        brk: spd * 0.4 + elu * 0.35 + bur * 0.25,
        tgt: hnd * 0.60 + elu * 0.20 + spd * 0.20,
        catch: hnd * 0.75 + vis * 0.25,
        ypr: spd * 0.35 + elu * 0.35 + bur * 0.30,
        rz: hnd * 0.5 + sz * 0.25 + str * 0.25,
        gl: str * 0.35 + sz * 0.30 + bal * 0.15 + vis * 0.10 + car * 0.10,
        hold: car * 0.7 + str * 0.3,
        ret: spd * 0.45 + elu * 0.3 + bur * 0.25,
      }
    }
    case 'wr': {
      const spd = N('speed'), bod = N('bodyControl'), vrt = N('vertical'), rte = N('routeRunning'), rel = N('release'), hnd = N('hands'), awr = N('awareness'), sz = N('size'), yac = N('afterCatch')
      return {
        tgt: rte * 0.30 + rel * 0.17 + hnd * 0.17 + awr * 0.12 + bod * 0.10 + yac * 0.08 + spd * 0.06,
        catch: hnd * 0.55 + rte * 0.20 + awr * 0.15 + bod * 0.10,
        ypr: clamp(spd * 0.40 + yac * 0.25 + vrt * 0.15 + bod * 0.10 + rte * 0.10 - (sz - 0.5) * 0.10, 0, 1.1),
        deep: spd * 0.5 + vrt * 0.2 + rel * 0.15 + bod * 0.15,
        rz: sz * 0.35 + vrt * 0.30 + hnd * 0.20 + rte * 0.15,
        ret: spd * 0.5 + yac * 0.3 + bod * 0.2,
      }
    }
    case 'te': {
      const spd = N('speed'), blk = N('blocking'), vrt = N('vertical'), rte = N('routeRunning'), str = N('strength'), hnd = N('hands'), awr = N('awareness'), sz = N('size'), yac = N('afterCatch')
      return {
        tgt: clamp(rte * 0.32 + hnd * 0.24 + awr * 0.16 + spd * 0.14 + yac * 0.08 + sz * 0.06 - (blk - 0.5) * 0.06, 0, 1.1),
        catch: hnd * 0.55 + rte * 0.20 + awr * 0.15 + sz * 0.10,
        ypr: spd * 0.35 + yac * 0.30 + vrt * 0.15 + rte * 0.20,
        deep: spd * 0.6 + vrt * 0.4,
        rz: sz * 0.30 + hnd * 0.25 + vrt * 0.20 + rte * 0.15 + str * 0.10,
        block: blk * 0.7 + str * 0.3,
      }
    }
    case 'ol': {
      const sz = N('size'), len = N('length'), anc = N('anchor'), pp = N('passPro'), rb = N('runBlock'), mob = N('mobility'), blz = N('blitzPickup'), dis = N('discipline'), pnk = N('pancake')
      return { pass: pp * 0.38 + anc * 0.18 + len * 0.14 + blz * 0.12 + mob * 0.10 + sz * 0.08, run: rb * 0.40 + pnk * 0.18 + sz * 0.14 + anc * 0.12 + mob * 0.10 + len * 0.06, pnk: pnk * 0.60 + rb * 0.25 + sz * 0.15, disc: dis }
    }
    case 'dl': {
      const get = N('getOff'), spd = N('speed'), sz = N('size'), pwr = N('powerMoves'), fin = N('finesseMoves'), str = N('strength'), rec = N('playRecognition'), bnd = N('bend'), shd = N('blockShed')
      const edge = p.sub !== 'dt'
      return {
        rush: edge ? get * 0.26 + bnd * 0.22 + fin * 0.18 + pwr * 0.12 + spd * 0.12 + shd * 0.05 + rec * 0.03 + str * 0.02
          : pwr * 0.26 + get * 0.24 + fin * 0.14 + str * 0.10 + sz * 0.04 + shd * 0.10 + bnd * 0.06 + rec * 0.04 + spd * 0.02,
        run: edge ? shd * 0.28 + rec * 0.22 + spd * 0.18 + str * 0.10 + sz * 0.04 + get * 0.08 + bnd * 0.04 + pwr * 0.04 + fin * 0.02
          : shd * 0.30 + str * 0.18 + sz * 0.08 + rec * 0.22 + get * 0.08 + pwr * 0.08 + spd * 0.04 + bnd * 0.01 + fin * 0.01,
        tfl: get * 0.28 + shd * 0.24 + rec * 0.18 + pwr * 0.10 + str * 0.05 + sz * 0.03 + fin * 0.05 + spd * 0.04 + bnd * 0.03,
        ff: fin * 0.25 + get * 0.20 + spd * 0.20 + shd * 0.15 + bnd * 0.08 + rec * 0.05 + pwr * 0.05 + str * 0.02,
        cov: rec * 0.2, int: rec * 0.2,
      }
    }
    case 'lb': {
      const rng = N('range'), sz = N('size'), pwr = N('power'), tkl = N('tackling'), shd = N('blockShed'), zon = N('zoneInstincts'), rsh = N('passRush'), rec = N('playRecognition'), ldr = N('leadership')
      return {
        run: rng * 0.30 + tkl * 0.30 + rec * 0.14 + shd * 0.12 + pwr * 0.05 + sz * 0.05 + zon * 0.04,
        rush: rsh * 0.55 + rng * 0.12 + pwr * 0.12 + rec * 0.11 + shd * 0.10,
        tfl: shd * 0.30 + pwr * 0.22 + rec * 0.18 + rng * 0.12 + tkl * 0.10 + sz * 0.08,
        cov: zon * 0.48 + rng * 0.26 + rec * 0.20 + sz * 0.03 + ldr * 0.03,
        int: zon * 0.52 + rec * 0.26 + rng * 0.16 + ldr * 0.06,
        ff: tkl * 0.28 + pwr * 0.30 + rsh * 0.14 + rng * 0.14 + rec * 0.10 + sz * 0.04,
      }
    }
    case 'db': {
      const spd = N('speed'), sz = N('size'), flu = N('fluidity'), prs = N('press'), hnd = N('hands'), ziq = N('zoneIQ'), man = N('manCoverage'), prk = N('playRecognition'), rus = N('runSupport')
      return {
        cov: man * 0.35 + flu * 0.25 + ziq * 0.25 + spd * 0.15,
        int: hnd * 0.30 + ziq * 0.25 + prk * 0.20 + man * 0.12 + flu * 0.08 + prs * 0.03 + spd * 0.02,
        run: rus * 0.36 + prk * 0.18 + spd * 0.16 + sz * 0.10 + ziq * 0.09 + flu * 0.05 + prs * 0.03 + man * 0.03,
        tfl: rus * 0.35 + sz * 0.25 + prk * 0.25 + spd * 0.10 + prs * 0.05,
        ff: rus * 0.30 + hnd * 0.20 + prk * 0.15 + sz * 0.15 + spd * 0.10 + prs * 0.10,
        rush: spd * 0.4 + rus * 0.3 + sz * 0.3,
        ret: spd * 0.6 + flu * 0.4,
      }
    }
    default: return {}
  }
}

// Workload: a worn man plays a little under himself (nothing until 40, about 4% at 100)
export const wearFactor = p => (1 - Math.max(0, (p.wear ?? 0) - 40) * 0.0007) * (p.inj?.nag ? 0.93 : 1)
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const BACKUP = 0.36   // what an empty spot plays like

export function buildProfile(F, short, isUser) {
  const t = F.teams[short], L = lineupOf(F, t), pc = playcall(F, t)
  const sk = p => { const s = skillsOf(p), w = wearFactor(p); if (w < 1) for (const k in s) s[k] *= w; return s }
  const man = (p, role) => (p ? { p, id: p.id, s: sk(p), role, ln: lastName(p.name) } : null)
  const T = { short, L, pc, plan: short === F.team ? F.plan : t.plan, isUser: !!isUser }

  // offense
  T.qb = man(L.QB[0], 'QB') ?? man(L.RB[0], 'QB')
  if (T.qb && T.qb.p.pos !== 'qb') T.qb.s = { comp: 0.25, deep: 0.25, ypa: 0.25, td: 0.25, intAvoid: 0.25, sackAvoid: 0.4, legs: 0.6, sneak: 0.5, clutch: 0.3 }
  T.rbs = L.RB.slice(0, 3).map(p => man(p, 'RB'))
  if (!T.rbs.length) T.rbs = [man(L.WR[L.WR.length - 1] ?? L.TE[0], 'RB')].filter(Boolean).map(m => ({ ...m, s: { run: 0.35, brk: 0.4, tgt: 0.3, catch: 0.4, ypr: 0.4, rz: 0.3, gl: 0.3, hold: 0.4, ret: 0.4 } }))
  // carries: the starter most of them, the second back a real share, the third a few
  T.carry = [1, 0.62, 0.16].slice(0, T.rbs.length).map((w, i) => w * (0.6 + T.rbs[i].s.run * 0.7))
  const wrs = L.WR.slice(0, 5).map(p => man(p, 'WR')), tes = L.TE.slice(0, 2).map(p => man(p, 'TE'))
  // who the ball goes to: role first (WR1 to RB2), then how good he is at getting open
  const roleW = { WR: [0.86, 0.8, 0.62, 0.26, 0.1], TE: [0.66, 0.2], RB: [0.5, 0.22, 0.05] }
  T.recv = []
  wrs.forEach((m, i) => T.recv.push({ ...m, kind: 'wr', w: roleW.WR[i] * Math.pow(0.35 + m.s.tgt, 1.2) }))
  tes.forEach((m, i) => T.recv.push({ ...m, kind: 'te', w: roleW.TE[i] * Math.pow(0.35 + m.s.tgt, 1.2) }))
  T.rbs.forEach((m, i) => T.recv.push({ ...m, kind: 'rb', w: roleW.RB[i] * Math.pow(0.35 + m.s.tgt, 1.1) }))
  T.wr = wrs; T.te = tes
  // the same weights for the red zone (the big targets) and for long yardage (fewer checkdowns), ready to use
  const tgtW = (rz, long) => T.recv.map(r => r.w * (rz && r.kind !== 'rb' ? 0.6 + (r.s.rz ?? 0.5) * 0.8 : 1) * (long && r.kind === 'rb' ? 0.45 : 1))
  T.wTgt = [tgtW(false, false), tgtW(true, false), tgtW(false, true), tgtW(true, true)]
  T.ol = L.OL.map(o => (o.p ? { p: o.p, id: o.p.id, spot: o.spot, s: (() => { const s = sk(o.p), f = o.p.pos === 'ol' ? olFit(o.p.sub, o.spot) : 0.6; return { pass: (s.pass ?? 0.3) * f, run: (s.run ?? 0.3) * f, pnk: (s.pnk ?? 0.2) * f, disc: s.disc ?? 0.5 } })() } : null)).filter(Boolean)
  T.olPass = T.ol.length ? (T.ol.reduce((s, o) => s + o.s.pass, 0) + BACKUP * (5 - T.ol.length)) / 5 : BACKUP
  T.olRun = T.ol.length ? (T.ol.reduce((s, o) => s + o.s.run, 0) + BACKUP * (5 - T.ol.length)) / 5 : BACKUP
  T.teBlock = tes[0]?.s.block ?? 0.4
  T.olDisc = avg(T.ol.map(o => o.s.disc)) || 0.5
  T.wOlSack = T.ol.map(x => Math.pow(1.25 - x.s.pass, 2)); T.wOlPnk = T.ol.map(x => x.s.pnk)

  // defense: the front four, three linebackers, two corners, two safeties, the nickel; the rotation behind them
  const edges = L.EDGE.slice(0, 3).map(p => man(p, 'EDGE')), dts = L.DT.slice(0, 3).map(p => man(p, 'DT'))
  const lbs = L.LB.slice(0, 4).map(p => man(p, 'LB')), cbs = L.CB.slice(0, 3).map(p => man(p, 'CB')), ss = L.S.slice(0, 3).map(p => man(p, 'S'))
  const snapW = { EDGE: [1, 0.92, 0.42], DT: [1, 0.9, 0.42], LB: [1, 0.95, 0.62, 0.12], CB: [1, 1, 0.62], S: [1, 1, 0.22] }
  T.def = []
  const put = (list, key) => list.forEach((m, i) => T.def.push({ ...m, snap: snapW[key][i] ?? 0.1 }))
  put(edges, 'EDGE'); put(dts, 'DT'); put(lbs, 'LB'); put(cbs, 'CB'); put(ss, 'S')
  const g = (m, k) => m.s[k] ?? 0.3
  const unit = (list, k, n, w = null) => { let s = 0, ws = 0; for (let i = 0; i < n; i++) { const wi = w ? w[i] : 1; s += (list[i] ? g(list[i], k) : BACKUP) * wi; ws += wi } return s / ws }
  // pass rush: the two edges carry it, the tackles push the pocket, a blitzing linebacker adds a little
  T.passRush = unit(edges, 'rush', 2, [1.15, 0.95]) * 0.5 + unit(dts, 'rush', 2) * 0.32 + unit(lbs, 'rush', 2) * 0.18
  // the best rusher counts for more than his share: one great edge wrecks a game plan
  T.passRush += Math.max(0, Math.max(...edges.map(m => m.s.rush), ...dts.map(m => m.s.rush), 0) - 0.7) * 0.25
  T.cover = unit(cbs, 'cov', 2, [1.1, 0.95]) * 0.42 + (cbs[2] ? g(cbs[2], 'cov') : BACKUP) * 0.14 + unit(ss, 'cov', 2) * 0.26 + unit(lbs, 'cov', 2) * 0.18
  T.runD = unit(dts, 'run', 2) * 0.3 + unit(edges, 'run', 2) * 0.2 + unit(lbs, 'run', 3, [1.1, 1, 0.8]) * 0.36 + unit(ss, 'run', 2) * 0.14
  // who makes each kind of play (weights for the box score)
  const W = (k, roleMul, pow = 2) => T.def.map(m => Math.pow(0.2 + g(m, k), pow) * m.snap * (roleMul[m.role] ?? 1))
  T.wSack = W('rush', { EDGE: 1.15, DT: 0.8, LB: 0.52, CB: 0.07, S: 0.11 }, 0.9)
  T.wInt = W('int', { EDGE: 0.03, DT: 0.02, LB: 0.42, CB: 1.25, S: 1.1 })
  T.wPd = W('cov', { EDGE: 0.12, DT: 0.1, LB: 0.5, CB: 1.6, S: 0.85 })
  T.wTklRun = W('run', { EDGE: 0.6, DT: 0.66, LB: 1.3, CB: 0.5, S: 1.0 }, 1.3)
  T.wTklPass = W('run', { EDGE: 0.12, DT: 0.12, LB: 1.0, CB: 1.25, S: 1.15 }, 1.3)
  T.wTfl = W('tfl', { EDGE: 1.25, DT: 1.1, LB: 1, CB: 0.2, S: 0.35 })
  T.wFf = W('ff', { EDGE: 1.2, DT: 0.7, LB: 1, CB: 0.6, S: 0.8 })

  // special teams
  const k = L.K[0]
  T.k = k ? { p: k, id: k.id, v: k.pos === 'k' ? { power: k.a.power ?? 5, accuracy: k.a.accuracy ?? 5, clutch: k.a.clutch ?? 5 } : { power: 2, accuracy: 1, clutch: 3 } } : { p: null, id: null, v: { power: 2, accuracy: 1, clutch: 3 } }
  const kr = L.KR[0]
  T.kr = kr ? { p: kr, id: kr.id, ret: skillsOf(kr).ret ?? 0.5 } : null

  // the staff: the play-callers move their side of the ball a little on every snap, the head coach's feel for
  // the situation moves the close ones
  T.offCall = (pc.off - 5.5) / 5.5          // -1 … +1
  T.defCall = (pc.def - 5.5) / 5.5
  T.sit = (pc.sit - 5.5) / 5.5
  return T
}
