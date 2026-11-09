// TEST FIXTURE (career agent, scripts/baseball/career-fixture): a stand-in for src/utils/baseballSimulation.js until the sim agent's file lands, so a
// career can be played in node. Rates per plate appearance from the grades, centred on the 2025 league (K 22.2%,
// BB 8.4%, HR 3.0% of PA, BABIP .291; Baseball-Reference league totals). Career passes team.career with its own
// 1-10 off/def and team.usage (how much he plays). Only used while the real sim is missing.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
function seededRandom(seed) { let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const W_BAT = { contact: 0.18, power: 0.17, eye: 0.12, avoidK: 0.1, gap: 0.08, speed: 0.08, baserunning: 0.05, fielding: 0.1, arm: 0.04, clutch: 0.08 }
const W_PIT = { velocity: 0.15, movement: 0.12, breaking: 0.14, changeup: 0.09, control: 0.12, command: 0.12, stamina: 0.08, groundball: 0.06, composure: 0.06, pitchIQ: 0.06 }
export function calcBaseballOVR(build, types, position = 'bat') {
  const W = position === 'pit' ? W_PIT : W_BAT
  let s = 0, w = 0
  for (const [k, x] of Object.entries(W)) { s += (build?.[k]?.val ?? 5) * x; w += x }
  return Math.round(52 + (s / w) * 4.3)
}
const pois = (r, mu) => { let L = Math.exp(-mu), k = 0, p = 1; do { k++; p *= r() } while (p > L && k < 25); return k - 1 }
export function runBaseballSimulation(build, types, team = {}, position = 'bat', mode = 'current', rngSeed = null, gameMode = 'classic', script = null) {
  const r = rngSeed != null ? seededRandom(rngSeed) : Math.random
  const v = k => build?.[k]?.val ?? 5
  const ovr = calcBaseballOVR(build, types, position)
  const off = team.off ?? 5.5, def = team.def ?? 5.5, u = team.usage ?? {}
  const pit = position === 'pit'
  const games = []
  let wins = 0
  // batter rates per PA
  const kp = clamp(0.222 - (v('avoidK') - 5.5) * 0.017 - (v('contact') - 5.5) * 0.005, 0.07, 0.4)
  const bbp = clamp(0.084 + (v('eye') - 5.5) * 0.01 + (v('power') - 5.5) * 0.002, 0.03, 0.2)
  const hrp = clamp(0.03 + (v('power') - 5.5) * 0.0075 + (v('contact') - 5.5) * 0.0008, 0.002, 0.09)
  const babip = clamp(0.291 + (v('contact') - 5.5) * 0.0065 + (v('speed') - 5.5) * 0.0025 + (v('gap') - 5.5) * 0.0015, 0.22, 0.37)
  const d2 = clamp(0.21 + (v('gap') - 5.5) * 0.014 + (v('power') - 5.5) * 0.004, 0.08, 0.36), t3 = clamp(0.017 + (v('speed') - 5.5) * 0.004 + (v('gap') - 5.5) * 0.002, 0, 0.06)
  const sbA = Math.max(0, (v('speed') - 5) * 0.035 + (v('baserunning') - 5.5) * 0.015), sbOk = clamp(0.75 + (v('baserunning') - 5.5) * 0.025, 0.55, 0.92)
  // pitcher rates per batter faced
  const pk = clamp(0.222 + (v('velocity') - 5.5) * 0.011 + (v('breaking') - 5.5) * 0.011 + (v('changeup') - 5.5) * 0.005 + (v('movement') - 5.5) * 0.004, 0.1, 0.42)
  const pbb = clamp(0.082 - (v('control') - 5.5) * 0.009 - (v('command') - 5.5) * 0.003, 0.03, 0.15)
  const phr = clamp(0.03 - (v('movement') - 5.5) * 0.0018 - (v('groundball') - 5.5) * 0.0018 - (v('command') - 5.5) * 0.0018, 0.012, 0.05)
  const pbabip = clamp(0.291 - (v('groundball') - 5.5) * 0.002 - (v('pitchIQ') - 5.5) * 0.002 - (def - 5.5) * 0.004, 0.25, 0.33)
  const role = team.role ?? (pit ? (v('stamina') >= 5 ? 'SP' : 'RP') : 'bat')
  const ipStart = clamp(5.2 + (v('stamina') - 5.5) * 0.25, 3.6, 7)
  const share = u.share ?? (pit ? 1 : 0.95), paG = u.pa ?? 4.2, gsN = u.gs ?? (role === 'SP' ? 32 : 0), apps = u.apps ?? (role === 'CL' ? 64 : role === 'RP' ? 58 : 0)
  // what he's worth to a game: a batter's runs above an average regular, a starter's in his starts
  const batRuns = pit ? 0 : ((0.69 * bbp + 0.89 * (babip * (1 - kp - bbp - hrp)) * (1 - d2 - t3) + 1.27 * (babip * (1 - kp - bbp - hrp)) * d2 + 2.05 * hrp) / 0.32 - 1) * 0.6
  const base = clamp(0.5 + (off + def - 11) * 0.028 + batRuns * share * 0.11, 0.28, 0.72)
  const pitOuts = pk * 3 + (1 - pk - pbb - phr) * (1 - pbabip)
  const raPer9 = 9 * ((1 - pitOuts) * 0.9 + phr * 1.4) / Math.max(0.5, pitOuts) * 0.62
  const oppsL = ['NYY', 'BOS', 'LAD', 'HOU', 'ATL', 'SEA', 'CHC', 'PHI', 'SD', 'TOR', 'MIL', 'DET', 'KC', 'TEX']
  for (let i = 0; i < 162; i++) {
    const g = { g: i + 1, wk: i + 1, opponent: oppsL[Math.floor(r() * oppsL.length)], home: r() < 0.5 }
    let p = base
    let started = false, appeared = false
    if (pit) {
      started = role === 'SP' && gsN > 0 && i % 5 === 0 && Math.floor(i / 5) < gsN
      appeared = !started && role !== 'SP' && r() < apps / 162
      if (started) p = clamp(p + (4.3 - raPer9) * 0.05, 0.2, 0.8)
    } else appeared = r() < share
    const won = r() < p
    if (won) wins++
    const lose = 1 + Math.floor(r() * 5 * (1 - r() * 0.5)), margin = 1 + pois(r, 2.2)
    g.won = won; g.mySc = won ? lose + margin : lose; g.oppSc = won ? lose : lose + margin
    if (!pit) {
      g.app = appeared ? 1 : 0; g.gs = appeared ? 1 : 0
      if (appeared) {
        const pa = Math.max(1, Math.round(paG + (r() - 0.5) * 1.6))
        let ab = 0, h = 0, d = 0, t = 0, hr = 0, bb = 0, k = 0, hbp = 0, sf = 0
        for (let j = 0; j < pa; j++) {
          const x = r()
          if (x < kp) { k++; ab++ } else if (x < kp + bbp) { bb++ } else if (x < kp + bbp + 0.011) { hbp++ } else if (x < kp + bbp + 0.011 + hrp) { hr++; h++; ab++ } else if (x < kp + bbp + 0.011 + hrp + 0.008) { sf++ } else { ab++; if (r() < babip) { h++; const y = r(); if (y < t3) t++; else if (y < t3 + d2) d++ } }
        }
        const sb = r() < sbA ? (r() < sbOk ? 1 : 0) : 0
        Object.assign(g, { pa, ab, h, d, t, hr, bb, k, hbp, sf, sb, cs: 0, r: Math.min(g.mySc, hr + Math.floor((h - hr + bb) * 0.32 + r() * 0.6)), rbi: Math.min(g.mySc, hr + Math.floor((h - hr) * 0.3 + sf + r() * 0.5)) })
      }
    } else {
      g.app = started || appeared ? 1 : 0; g.gs = started ? 1 : 0
      if (g.app) {
        let outs = started ? Math.max(6, Math.round((ipStart + (r() - 0.5) * 2.4) * 3)) : 3
        let bf = 0, h = 0, bb = 0, k = 0, hr = 0, hbp = 0, o = 0
        while (o < outs && bf < 45) {
          bf++
          const x = r()
          if (x < pk) { k++; o++ } else if (x < pk + pbb) { bb++ } else if (x < pk + pbb + 0.009) { hbp++ } else if (x < pk + pbb + 0.009 + phr) { hr++; h++ } else if (r() < pbabip) { h++ } else { o++ }
        }
        const er = Math.max(0, Math.round(hr * 1.4 + (h - hr + bb + hbp) * 0.24 + (r() - 0.5) * 1.2))
        Object.assign(g, { outs: o, h, er, bb, k, hr, hbp, bf, w: 0, l: 0, sv: 0, hld: 0 })
        if (started) { if (won && er <= 4 && o >= 15 && r() < 0.78) g.w = 1; else if (!won && er >= 3 && r() < 0.7) g.l = 1 }
        else if (role === 'CL') { if (won && margin <= 3) { if (er === 0) g.sv = 1; else if (r() < 0.5) g.sv = 1 } else if (!won && er > 0 && r() < 0.3) g.l = 1 }
        else { if (won && r() < 0.35) g.hld = 1; else if (won && r() < 0.08) g.w = 1; else if (!won && er > 0 && r() < 0.15) g.l = 1 }
      }
    }
    games.push(g)
  }
  return { ovr, position, wins, losses: 162 - wins, games, team }
}
export function scriptBaseballSeason() { return null }
