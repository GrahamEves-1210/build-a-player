// Game-sim calibration: plays N regular seasons of league games (no roster moves between weeks) and prints the
// league's numbers against real NFL targets. bash scripts/franchise/run.sh scripts/franchise/calib.mjs [seasons]
import { buildLeague } from '../../src/lib/franchise/league'
import { prepWeek, makeGame, bookGame } from '../../src/lib/franchise/week'
import { playGame } from '../../src/lib/franchise/game'
import { standing } from '../../src/lib/franchise/standings'
import { makeSchedule } from '../../src/lib/franchise/schedule'
import { passerRating } from '../../src/lib/franchise/stats'

const N = Number(process.argv[2] ?? 3)
const agg = { games: 0, pts: 0, py: 0, ry: 0, pa: 0, pc: 0, sk: 0, int: 0, fum: 0, fga: 0, fgm: 0, plays: 0, ra: 0, d3a: 0, d3c: 0, d4a: 0, d4c: 0, pen: 0, td: 0, ot: 0, ties: 0, xpa: 0, xpm: 0, two: 0, saf: 0, home: 0, margin: 0, top: 0, pu: 0, drives: 0, m3: 0, m7: 0, m0: 0, late: {} }
const counts = { p4000: 0, r1000: 0, c1000: 0, s10: 0, p5000: 0, r1500: 0, td40: 0, int20: 0 }
let ms = 0, bad = 0
const tops = []
for (let k = 0; k < N; k++) {
  const F = buildLeague({ team: 'KC', gmName: 'Calib', seed: `calib-${k}` })
  for (let w = 1; w <= 18; w++) {
    const t0 = performance.now()
    const P = prepWeek(F)
    F.sched.weeks[w - 1].forEach((g, i) => {
      const G = playGame(F, makeGame(F, w, i, false, P))
      // the box score adds up
      for (let s = 0; s < 2; s++) {
        const box = Object.values(G.box[s]), sum = key => box.reduce((a, b) => a + (b[key] ?? 0), 0), tot = G.tot[s]
        const tds = sum('rtd') + sum('ctd') + sum('krtd') + sum('dtd')
        const pts = tds * 6 + sum('xpm') + tot.two * 2 + sum('fgm') * 3 + tot.saf * 2
        if (pts !== G.sc[s] || sum('py') !== sum('cy') || sum('ptd') !== sum('ctd') || sum('pc') !== sum('rc') || sum('pa') !== sum('tg') || !Number.isFinite(G.sc[s])) { bad++; if (bad < 5) console.log('BOX MISMATCH', G.id, G.sc, pts, tds, sum('py'), sum('cy')) }
        agg.pts += G.sc[s]; agg.py += tot.py; agg.ry += tot.ry; agg.pa += sum('pa'); agg.pc += sum('pc'); agg.sk += sum('sk'); agg.int += sum('pi'); agg.fum += sum('fum'); agg.fga += sum('fga'); agg.fgm += sum('fgm')
        agg.plays += tot.plays; agg.ra += tot.ra; agg.d3a += tot.d3a; agg.d3c += tot.d3c; agg.d4a += tot.d4a; agg.d4c += tot.d4c; agg.pen += tot.pen; agg.td += tot.td; agg.xpa += sum('xpa'); agg.xpm += sum('xpm'); agg.two += tot.two; agg.saf += tot.saf; agg.top += tot.top
      }
      agg.pu += G.tot[0].pu + G.tot[1].pu; agg.drives += G.drive
      { const reg = [0, 1].map(s => G.qs[s].slice(0, 4).reduce((a, b) => a + b, 0)), m = Math.abs(reg[0] - reg[1]); if (m === 0) agg.m0++; if (m <= 3) agg.m3++; if (m <= 8) agg.m7++ }
      agg.games++; if (G.ot) agg.ot++; if (G.sc[0] === G.sc[1]) agg.ties++; if (G.sc[0] > G.sc[1]) agg.home++
      agg.margin += Math.abs(G.sc[0] - G.sc[1])
      bookGame(F, G, w, i)
    })
    ms += performance.now() - t0
  }
  const P = Object.values(F.players)
  counts.p4000 += P.filter(p => (p.s.py ?? 0) >= 4000).length; counts.p5000 += P.filter(p => (p.s.py ?? 0) >= 5000).length
  counts.r1000 += P.filter(p => (p.s.ry ?? 0) >= 1000).length; counts.r1500 += P.filter(p => (p.s.ry ?? 0) >= 1500).length
  counts.c1000 += P.filter(p => (p.s.cy ?? 0) >= 1000).length; counts.s10 += P.filter(p => (p.s.sa ?? 0) >= 10).length
  counts.td40 += P.filter(p => (p.s.ptd ?? 0) >= 40).length; counts.int20 += P.filter(p => (p.s.pi ?? 0) >= 18).length
  if (k === 0) {
    const by = (key, n = 6) => P.filter(p => p.s[key]).sort((a, b) => b.s[key] - a.s[key]).slice(0, n)
    console.log('PASS ', by('py').map(p => `${p.name} ${p.ovr} ${p.s.pc}/${p.s.pa} ${p.s.py} ${p.s.ptd}TD ${p.s.pi}INT ${passerRating(p.s)} sk${p.s.sk}`).join(' | '))
    console.log('RUSH ', by('ry').map(p => `${p.name} ${p.ovr} ${p.s.ra}-${p.s.ry} ${p.s.rtd}TD`).join(' | '))
    console.log('REC  ', by('cy').map(p => `${p.name} ${p.ovr} ${p.s.rc}/${p.s.tg} ${p.s.cy} ${p.s.ctd}TD`).join(' | '))
    console.log('SACK ', by('sa').map(p => `${p.name} ${p.ovr} ${p.s.sa}`).join(' | '))
    console.log('INT  ', by('di').map(p => `${p.name} ${p.ovr} ${p.s.di}`).join(' | '))
    console.log('TKL  ', by('tk').map(p => `${p.name} ${p.ovr} ${p.s.tk}`).join(' | '))
    console.log('FG   ', by('fgm').map(p => `${p.name} ${p.ovr} ${p.s.fgm}/${p.s.fga} long ${p.s.fgl}`).join(' | '))
    console.log('worst QB', P.filter(p => (p.s.pa ?? 0) > 300).sort((a, b) => passerRating(a.s) - passerRating(b.s)).slice(0, 3).map(p => `${p.name} ${p.ovr} ${p.s.pc}/${p.s.pa} ${p.s.py} ${p.s.ptd}TD ${p.s.pi}INT ${passerRating(p.s)}`).join(' | '))
    const S = standing(F)
    console.log('records', Object.entries(S.R).sort((a, b) => b[1].w - a[1].w).map(([s, r]) => `${s} ${r.w}-${r.l}${r.t ? '-' + r.t : ''}`).join(' '))
  }
}
const tg = agg.games * 2
const row = (label, v, target) => console.log(label.padEnd(34), String(v).padStart(8), '   target', target)
console.log(`\n${N} seasons, ${agg.games} games; ${(ms / (N * 18)).toFixed(1)} ms a week; box mismatches ${bad}`)
row('points / team game', (agg.pts / tg).toFixed(2), '22-23')
row('pass yds (net) / team game', (agg.py / tg).toFixed(1), '215-225')
row('rush yds / team game', (agg.ry / tg).toFixed(1), '113-122')
row('pass att / team game', (agg.pa / tg).toFixed(1), '33-35')
row('rush att / team game', (agg.ra / tg).toFixed(1), '26-28')
row('plays / team game', (agg.plays / tg).toFixed(1), '62-64')
row('completion %', (agg.pc / agg.pa * 100).toFixed(1), '64.5-65.5')
row('yards / carry', (agg.ry / agg.ra).toFixed(2), '4.2-4.4')
row('sacks / team game', (agg.sk / tg).toFixed(2), '2.3-2.6')
row('INT / team game', (agg.int / tg).toFixed(2), '0.72-0.82')
row('fumbles lost / team game', (agg.fum / tg).toFixed(2), '0.45-0.55')
row('FG %', (agg.fgm / agg.fga * 100).toFixed(1), '84-86')
row('FG att / team game', (agg.fga / tg).toFixed(2), '1.9-2.1')
row('XP %', (agg.xpm / agg.xpa * 100).toFixed(1), '95')
row('TD / team game', (agg.td / tg).toFixed(2), '2.4-2.6')
row('3rd down %', (agg.d3c / agg.d3a * 100).toFixed(1), '38-40')
row('4th down att / team game', (agg.d4a / tg).toFixed(2), '1.1-1.3')
row('4th down %', (agg.d4c / agg.d4a * 100).toFixed(1), '50-55')
row('penalties / team game', (agg.pen / tg).toFixed(2), '(model: ~2.6 accepted that matter)')
row('punts / team game', (agg.pu / tg).toFixed(2), '3.7-4.2')
row('drives / team game', (agg.drives / tg).toFixed(2), '10.6-11.2')
row('regulation margin 0 / <=3 / <=8 %', `${(agg.m0 / agg.games * 100).toFixed(1)} / ${(agg.m3 / agg.games * 100).toFixed(1)} / ${(agg.m7 / agg.games * 100).toFixed(1)}`, '5.5 / 23 / 52')
row('home win %', (agg.home / agg.games * 100).toFixed(1), '53-56')
row('avg margin', (agg.margin / agg.games).toFixed(1), '10.5-11.5')
row('overtime games / season', (agg.ot / N).toFixed(1), '13-18')
row('ties / season', (agg.ties / N).toFixed(2), '0-1')
row('2-pt made / season', (agg.two / N).toFixed(1), '55-65 made of ~125')
row('safeties / season', (agg.saf / N).toFixed(1), '10-15')
row('4,000-yard passers', (counts.p4000 / N).toFixed(1), '8-11')
row('5,000-yard passers', (counts.p5000 / N).toFixed(2), '0-1')
row('40-TD passers', (counts.td40 / N).toFixed(2), '0-2')
row('1,000-yard rushers', (counts.r1000 / N).toFixed(1), '12-16')
row('1,500-yard rushers', (counts.r1500 / N).toFixed(2), '0-2')
row('1,000-yard receivers', (counts.c1000 / N).toFixed(1), '22-28')
row('double-digit sacks', (counts.s10 / N).toFixed(1), '15-22')
