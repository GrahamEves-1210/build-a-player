// NBA FRANCHISE: an award winner's line (the Awards stop, History): his season, every team he played for, or the line
// his award record kept (offseason.js closeSeason, F.hist[].aw[k].l) once his rows fold or he retires
import { manOf } from '../../../lib/franchise2/nba'

export const per = (x, k) => (x?.gp ? (x[k] ?? 0) / x.gp : 0)
export const f1 = v => v.toFixed(1)
// his line for that season: this season's from the box scores (until the new season clears them), else his career
// rows (a season split by a trade: every team's row together, the last team's name, the playoffs from its row)
export function seasonOf(F, i, y) {
  if (y === F.year && F.ss?.[i]?.gp) return F.ss[i]
  const rows = (manOf(F, i)?.car ?? []).filter(c => c.y === y && !c.y2 && c.gp)
  if (rows.length < 2) return rows[0] ?? null
  const t = { y, s: rows[rows.length - 1].s }
  for (const c of rows) for (const [key, v] of Object.entries(c)) if (typeof v === 'number' && key !== 'y') t[key] = (t[key] ?? 0) + v
  const po = rows.find(c => c.po)?.po
  if (po) t.po = po
  return t
}
// the line an award winner's record kept (offseason.js closeSeason: w.l, the season's totals or the series)
const RS_K = ['gp', 'pts', 'reb', 'ast', 'stl', 'blk', 'gs', 'cp']
const keptLine = w => (Array.isArray(w?.l) && w.l[0] ? Object.fromEntries(RS_K.map((key, j) => [key, w.l[j]]).filter(([, v]) => v != null)) : null)
export function statLine(F, i, y, k, w = null) {
  const kept = keptLine(w)
  if (k === 'FMVP' || k === 'ECF' || k === 'WCF') {
    if (kept) return `${f1(per(kept, 'pts'))} PTS · ${f1(per(kept, 'reb'))} REB · ${f1(per(kept, 'ast'))} AST IN THE ${k === 'FMVP' ? 'FINALS' : 'SERIES'}`
    // (the series itself while the bracket is still up; his whole postseason from his career row after)
    const S = y === F.year ? (k === 'FMVP' ? F.po?.all?.[3]?.[0] : (F.po?.all?.[2] ?? []).find(C => C.c === (k === 'ECF' ? 'E' : 'W'))) : null
    const x = S?.st?.[i]
    if (x?.gp) return `${f1(per(x, 'pts'))} PTS · ${f1(per(x, 'reb'))} REB · ${f1(per(x, 'ast'))} AST IN THE ${k === 'FMVP' ? 'FINALS' : 'SERIES'}`
    const po = y === F.year ? F.ps?.[i] : null
    if (po?.gp) return `${f1(per(po, 'pts'))} PTS · ${f1(per(po, 'reb'))} REB · ${f1(per(po, 'ast'))} AST IN THE PLAYOFFS`
    const c = seasonOf(F, i, y)?.po
    return c?.[0] ? `${f1(c[1] / c[0])} PTS · ${f1(c[2] / c[0])} REB · ${f1(c[3] / c[0])} AST IN THE PLAYOFFS` : ''
  }
  const x = kept ?? seasonOf(F, i, y)
  if (!x?.gp) return ''
  if (k === 'DPOY' || k === 'DEF') return `${f1(per(x, 'reb'))} REB · ${f1(per(x, 'stl'))} STL · ${f1(per(x, 'blk'))} BLK`
  const base = `${f1(per(x, 'pts'))} PTS · ${f1(per(x, 'reb'))} REB · ${f1(per(x, 'ast'))} AST`
  if (k === 'CLUTCH' && x.cp) return `${base} · ${x.cp} CLUTCH PTS`
  if (k === '6MOY' && x.gs != null) return `${base} · ${x.gp - x.gs} GAMES OFF THE BENCH`
  return base
}
