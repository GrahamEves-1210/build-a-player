// Game day, headless (agent C's checks): two seasons with moments, every game's scoring summary, headline, events and
// the moment's cast checked against the rosters and the box score.
//   bash scripts/franchise2/run.sh scripts/franchise2/gameday.mjs [seasons=2] [team=DEN]
import * as FR from '../../src/lib/franchise2/index'
import { momentCast } from '../../src/lib/franchise2/cast'
import { fxList, leagueWire, lineOf } from '../../src/lib/franchise2/season'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'
import { DBS } from '../../src/data/dbs'
import { seeded } from '../../src/lib/rng'

const N = Number(process.argv[2] ?? 2), team = process.argv[3] ?? 'DEN'
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua') ?? WRS.find(p => p.attrs), db = DBS.find(p => p.attrs && p.subpos === 'cb')
const F = FR.createFranchise({ seed: 'gd-' + team, team, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb) }, { pos: 'wr', build: asBuild(wr) }, { pos: 'db', build: asBuild(db) }], coach: { name: 'Coach', scheme: 'air', style: 'developer' } })
const problems = []
const bad = m => { problems.push(m); if (problems.length < 40) console.log('  !! ' + m) }
const H = seeded('gd-hits')
const BANNED = /drive of the year|clutch|statement|dominant|epic|huge|massive|unbelievable|!|\bundefined\b|\bnull\b|\bNaN\b/i
const names = s => new Set(F.teams[s].r.map(p => p.n))
let games = 0, moments = 0, evs = 0, ms = 0, longest = 0
const samples = []
function checkRow(row) {
  games++
  const kp = row.kp ?? []
  const us = kp.filter(x => x[1]).reduce((a, x) => a + x[2], 0), them = kp.filter(x => !x[1]).reduce((a, x) => a + x[2], 0)
  if (us !== row.us || them !== row.them) bad(`${F.year} wk ${row.wk ?? 'po' + row.rd}: summary ${us}-${them} vs final ${row.us}-${row.them}`)
  const mine = names(F.team), theirs = names(row.opp)
  for (const [t, m, p, txt] of kp) {
    if (!txt || BANNED.test(txt)) bad(`play text "${txt}"`)
    const fg = txt.match(/ (\d+)-yd field goal/)
    if (fg && (+fg[1] < 18 || +fg[1] > 66)) bad(`field goal of ${fg[1]}`)
    const pass = txt.match(/^(.+?) \d+-yd pass to (.+?)( \(| on |$)/), runm = txt.match(/^(.+?) \d+-yd run/)
    const who = pass ? [pass[1], pass[2]] : runm ? [runm[1]] : []
    for (const n of who) if (!(m ? mine : theirs).has(n)) bad(`${n} isn't on the ${m ? F.team : row.opp} roster ("${txt}")`)
    if (t < 0 || t > 5400) bad(`play at ${t}`)
  }
  if (!row.hl || BANNED.test(row.hl) || BANNED.test(row.sub ?? '')) bad(`headline "${row.hl}" / "${row.sub}"`)
  if (samples.length < 14 && (row.mo || games % 4 === 0)) samples.push(`${row.hl} | ${row.sub} | ${kp.map(x => `${FR.whenOf(x[0])} ${x[3]}`).slice(-3).join(' · ')}`)
}
function moment() {
  const v = FR.momentView(F)
  const cast = momentCast(F, v.opp, v.pid)
  const ours = names(F.team), opp = names(v.opp)
  const lastOf = n => String(n).replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').trim().split(/\s+/).pop().toUpperCase()
  const okUs = new Set([...ours].map(lastOf)), okThem = new Set([...opp].map(lastOf))
  for (const [side, ok] of [['us', okUs], ['them', okThem]]) {
    const xi = cast[side].xi
    for (const m of [...xi.off, ...xi.def]) if (m && !ok.has(m.name) && !ok.has(m.name.split(' ').pop())) bad(`cast ${side} ${m.name} isn't on the roster`)
    if (xi.off.filter(Boolean).length < 10 || xi.def.filter(Boolean).length < 10) bad(`cast ${side} short: ${xi.off.filter(Boolean).length} on offense, ${xi.def.filter(Boolean).length} on defense`)
  }
  if (!cast.me?.me || cast.me.number == null) bad('cast without the build')
  moments++
  FR.finishMoment(F, H() < FR.normalRate(F.teams[F.team].r.find(p => p.i === v.pid).o))
}
for (let y = 0; y < N; y++) {
  while (F.phase === 'season') {
    if (F.ev) {
      evs++
      for (const i of [0, 1]) { const fx = fxList(F, F.ev, i); if (!fx.length || fx.some(([t]) => BANNED.test(t))) bad(`event ${F.ev.id} fx ${JSON.stringify(fx)}`) }
      if (BANNED.test(F.ev.title)) bad(`event title ${F.ev.title}`)
      if (samples.length < 20) samples.push(`EVENT ${F.ev.title} → [${F.ev.a[0]}: ${fxList(F, F.ev, 0).map(x => x[0]).join(', ')}] [${F.ev.b[0]}: ${fxList(F, F.ev, 1).map(x => x[0]).join(', ')}]`)
      FR.chooseEvent(F, H() < 0.5 ? 0 : 1)
    }
    const wk = FR.mySchedule(F)[F.wk]
    if (wk && !wk.bye) { const l = lineOf(F, wk.home ? wk.opp : F.team, wk.home ? F.team : wk.opp); if (!/^[A-Z]{2,3} -\d+(\.5)?$|^PICK$/.test(l.text) || l.total < 30 || l.total > 60) bad(`line ${l.text} ${l.total}`) }
    const t0 = performance.now()
    const r = FR.playWeek(F, { moments: true })
    if (r.pending) moment()
    const dt = performance.now() - t0; ms += dt; longest = Math.max(longest, dt)
    const row = F.log[F.log.length - 1]
    if (row && row !== checkRow.last) { checkRow.last = row; checkRow(row) }
    for (const x of leagueWire(F)) if (x.k === 'news' && BANNED.test(x.text)) bad(`wire ${x.text}`)
  }
  // touchdowns: the box score's and the summary's agree
  const tds = F.log.reduce((a, r) => a + (r.kp ?? []).filter(x => x[1] && x[2] >= 6).length, 0)
  const boxTd = Object.values(F.ss).reduce((a, x) => a + (x.rctd ?? 0) + (x.rtd ?? 0), 0)
  if (tds !== boxTd) bad(`${F.year}: ${tds} touchdowns in the summaries, ${boxTd} in the box score`)
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') {
    const r = FR.playWeek(F, { moments: true })
    if (r.pending) moment()
    const row = F.log[F.log.length - 1]
    if (row && row !== checkRow.last) { checkRow.last = row; checkRow(row) }
  }
  console.log(`${F.year} ${team} ${FR.recText(FR.records(F)[team])} · champ ${F.po.champ} · ${games} games, ${moments} moments, ${evs} events · ${(ms / Math.max(1, games)).toFixed(0)} ms a week (longest ${longest.toFixed(0)})`)
  FR.closeSeason(F)
  if (y < N - 1) {
    FR.ageLeague(F); FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true)
    FR.openFA(F); for (let d = 0; d < 3; d++) FR.nextFADay(F)
    FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
    FR.newSeason(F)
  }
}
console.log(samples.join('\n'))
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
