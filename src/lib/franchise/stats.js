// FRANCHISE: stat lines. One flat object of counts per player per game, added into his season (p.s) and
// career (p.car). Keys (kept short: every player carries them):
//   g games · gs starts
//   pa pc py ptd pi   pass attempts, completions, yards, touchdowns, interceptions thrown   sk sky  sacks taken, yards lost
//   ra ry rtd rl      rushing attempts, yards, touchdowns, long        fum  fumbles lost
//   tg rc cy ctd cl   targets, catches, receiving yards, touchdowns, long
//   tk sa tfl di pd ff fr dtd   tackles, sacks, tackles for loss, interceptions, passes defensed, forced fumbles, recoveries, defensive TDs
//   sal pk            (linemen) sacks allowed, pancakes
//   fgm fga fgl xpm xpa f5m f5a   field goals, long, extra points, 50+
//   kr kry krtd       kick returns
import { r1 } from './consts'

export const STAT_KEYS = ['g', 'gs', 'pa', 'pc', 'py', 'ptd', 'pi', 'sk', 'sky', 'ra', 'ry', 'rtd', 'rl', 'fum', 'tg', 'rc', 'cy', 'ctd', 'cl', 'tk', 'sa', 'tfl', 'di', 'pd', 'ff', 'fr', 'dtd', 'sal', 'pk', 'fgm', 'fga', 'fgl', 'xpm', 'xpa', 'f5m', 'f5a', 'kr', 'kry', 'krtd']
const MAX_KEYS = new Set(['rl', 'cl', 'fgl'])   // a long is the best, not the sum
export function addStats(into, g) {
  for (const k in g) {
    const v = g[k]
    if (!v) continue
    if (MAX_KEYS.has(k)) { if (!(into[k] >= v)) into[k] = v } else into[k] = (into[k] ?? 0) + v
  }
  return into
}
const n = v => v ?? 0
// 4,312 (by hand: toLocaleString is slow, and every table row calls this)
export const num = v => { const x = Math.round(n(v)), s = String(Math.abs(x)); return (x < 0 ? '-' : '') + (s.length > 3 ? `${s.slice(0, -3)},${s.slice(-3)}` : s) }
// the NFL passer rating
export function passerRating(s) {
  const att = n(s.pa)
  if (!att) return 0
  const c = v => Math.max(0, Math.min(2.375, v))
  const a = c((n(s.pc) / att - 0.3) * 5), b = c((n(s.py) / att - 3) * 0.25), t = c(n(s.ptd) / att * 20), i = c(2.375 - n(s.pi) / att * 25)
  return r1((a + b + t + i) / 6 * 100)
}
export const kPoints = s => n(s.fgm) * 3 + n(s.xpm)
// touchdowns he scored himself (not thrown)
export const tdsOf = s => n(s.rtd) + n(s.ctd) + n(s.krtd) + n(s.dtd)

// one line for a table: this season at a glance
export function statLine(pos, s) {
  if (!s || !n(s.g)) return ''
  if (pos === 'qb') return n(s.pa) ? `${num(s.py)} yds, ${n(s.ptd)} TD, ${n(s.pi)} INT` : ''
  if (pos === 'rb') return n(s.ra) || n(s.rc) ? `${num(s.ry)} ${n(s.ry) === 1 ? 'yd' : 'yds'}, ${n(s.rtd)} TD${n(s.rc) ? `, ${n(s.rc)} rec` : ''}` : ''
  if (pos === 'wr' || pos === 'te') return n(s.tg) ? `${n(s.rc)} rec, ${num(s.cy)} yds, ${n(s.ctd)} TD` : ''
  if (pos === 'ol') return `${n(s.gs)} start${n(s.gs) === 1 ? '' : 's'}, ${n(s.sal)} sack${n(s.sal) === 1 ? '' : 's'} allowed`
  if (pos === 'k') return n(s.fga) || n(s.xpa) ? `${n(s.fgm)}/${n(s.fga)} FG, long ${n(s.fgl)}` : ''
  const parts = [`${n(s.tk)} tkl`]
  if (pos === 'db') { parts.push(`${n(s.di)} INT`, `${n(s.pd)} PD`) } else { parts.push(`${n(s.sa)} sack${n(s.sa) === 1 ? '' : 's'}`); if (n(s.di)) parts.push(`${n(s.di)} INT`); else parts.push(`${n(s.tfl)} TFL`) }
  return parts.join(', ')
}
// the stat block on a player card (API.md StatLine): only what his position has
export function statView(pos, s0) {
  const s = s0 ?? {}
  if (pos === 'qb') return { g: n(s.g), cmp: n(s.pc), att: n(s.pa), pct: n(s.pa) ? r1(n(s.pc) / s.pa * 100) : 0, yds: n(s.py), td: n(s.ptd), int: n(s.pi), rtg: passerRating(s), sk: n(s.sk), rushYds: n(s.ry), rushTD: n(s.rtd) }
  if (pos === 'rb') return { g: n(s.g), att: n(s.ra), yds: n(s.ry), ypc: n(s.ra) ? r1(n(s.ry) / s.ra) : 0, td: n(s.rtd), rec: n(s.rc), recYds: n(s.cy), recTD: n(s.ctd), fum: n(s.fum) }
  if (pos === 'wr' || pos === 'te') return { g: n(s.g), tgt: n(s.tg), rec: n(s.rc), yds: n(s.cy), ypr: n(s.rc) ? r1(n(s.cy) / s.rc) : 0, td: n(s.ctd), long: n(s.cl) }
  if (pos === 'ol') return { g: n(s.g), gs: n(s.gs), sacksAllowed: n(s.sal), pancakes: n(s.pk) }
  if (pos === 'k') return { g: n(s.g), fgm: n(s.fgm), fga: n(s.fga), pct: n(s.fga) ? r1(n(s.fgm) / s.fga * 100) : 0, long: n(s.fgl), xpm: n(s.xpm), xpa: n(s.xpa), pts: kPoints(s) }
  return { g: n(s.g), tkl: n(s.tk), sack: n(s.sa), tfl: n(s.tfl), int: n(s.di), pd: n(s.pd), ff: n(s.ff), dTD: n(s.dtd) }
}
// a season kept in a player's history: [year, team, ...the position's own columns]. Small on purpose.
const HIST_KEYS = {
  qb: ['g', 'pc', 'pa', 'py', 'ptd', 'pi', 'sk', 'ry', 'rtd'], rb: ['g', 'ra', 'ry', 'rtd', 'rc', 'cy', 'ctd', 'fum'], wr: ['g', 'tg', 'rc', 'cy', 'ctd', 'cl'], te: ['g', 'tg', 'rc', 'cy', 'ctd', 'cl'],
  ol: ['g', 'gs', 'sal', 'pk'], dl: ['g', 'tk', 'sa', 'tfl', 'di', 'pd', 'ff', 'dtd'], lb: ['g', 'tk', 'sa', 'tfl', 'di', 'pd', 'ff', 'dtd'], db: ['g', 'tk', 'sa', 'tfl', 'di', 'pd', 'ff', 'dtd'],
  k: ['g', 'fgm', 'fga', 'fgl', 'xpm', 'xpa'],
}
export const histLine = (p, year, team) => [year, team, ...HIST_KEYS[p.pos].map(k => n(p.s[k]))]
export function histStats(pos, line) { const s = {}; HIST_KEYS[pos].forEach((k, i) => { if (line[i + 2]) s[k] = line[i + 2] }); return s }

// ── Leaders ──────────────────────────────────────────────────────────────────
// category → [value of a season line, label, minimum to qualify(s) or null, text]
export const LEADER_CATS = {
  passYds: { v: s => n(s.py), label: 'PASSING YARDS', pos: ['qb'] },
  passTD: { v: s => n(s.ptd), label: 'PASSING TOUCHDOWNS', pos: ['qb'] },
  rating: { v: s => passerRating(s), label: 'PASSER RATING', pos: ['qb'], min: (s, g) => n(s.pa) >= 14 * Math.max(1, g) },
  rushYds: { v: s => n(s.ry), label: 'RUSHING YARDS', pos: ['rb', 'qb', 'wr'] },
  rushTD: { v: s => n(s.rtd), label: 'RUSHING TOUCHDOWNS', pos: ['rb', 'qb', 'wr'] },
  rec: { v: s => n(s.rc), label: 'RECEPTIONS', pos: ['wr', 'te', 'rb'] },
  recYds: { v: s => n(s.cy), label: 'RECEIVING YARDS', pos: ['wr', 'te', 'rb'] },
  recTD: { v: s => n(s.ctd), label: 'RECEIVING TOUCHDOWNS', pos: ['wr', 'te', 'rb'] },
  scrimmage: { v: s => n(s.ry) + n(s.cy), label: 'YARDS FROM SCRIMMAGE', pos: ['rb', 'wr', 'te'] },
  sacks: { v: s => n(s.sa), label: 'SACKS', pos: ['dl', 'lb', 'db'] },
  tackles: { v: s => n(s.tk), label: 'TACKLES', pos: ['dl', 'lb', 'db'] },
  ints: { v: s => n(s.di), label: 'INTERCEPTIONS', pos: ['dl', 'lb', 'db'] },
  tfl: { v: s => n(s.tfl), label: 'TACKLES FOR LOSS', pos: ['dl', 'lb', 'db'] },
  ff: { v: s => n(s.ff), label: 'FORCED FUMBLES', pos: ['dl', 'lb', 'db'] },
  fgm: { v: s => n(s.fgm), label: 'FIELD GOALS MADE', pos: ['k'] },
  points: { v: s => kPoints(s) + tdsOf(s) * 6, label: 'POINTS' },
}
