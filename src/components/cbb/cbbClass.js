// College Basketball: class years, shared by the one-off mode (CBBMode.jsx) and Career's Start in College
// (CareerCollegeHoops.jsx). College Football's rules (components/cfb/cfbClass.js) with basketball's own where the
// sports differ: a player starts as a freshman, sophomore, junior or senior and plays from that class on, a
// freshman up to four seasons, a senior one. A PLAYER MAY ENTER THE NBA DRAFT AFTER ANY SEASON (one-and-done is
// real: no three-year wait); a senior is out of eligibility. Each season played earns upgrade points
// (upgradePoints: one to three, by the season he had), spent on his traits before the next one (CBBOffseason.jsx).
// An underclassman who signs where the man at his spot grades out better comes off the bench that year (the
// engine's role 'bench': sixth-man minutes, not a year on the sideline).
export { CLASSES, CLASS_NAME, classAt, classIdx, seasonsFrom, canComeBack, isUnder, classAge, draftAge } from '../cfb/cfbClass'

export const canDeclare = () => true   // basketball's rule: after any season

// ── Upgrade points: what a season earns (1 to 3) ─────────────────────────────
// 3: national honors. He won the Wooden or was a finalist, made an All-America team (first, second or third), or
//    won the Naismith, his position's national award, national Defensive Player of the Year, the freshman award or
//    his conference's Player of the Year.
// 2: a starter's good year. He hit his position's mark (a guard 18 points or 6 assists a game, a big 16 points or
//    9 rebounds a game), or his team won 25 games, its conference (the regular season or the tournament) or
//    reached the Sweet 16.
// 1: any other season, a year off the bench included.
const HONORS = ['naismith', 'posAward', 'dpoy', 'freshman', 'confPOY']
export const POINT_MARKS = { guard: '18 points or 6 assists a game', big: '16 points or 9 rebounds a game' }
export function upgradePoints(r, pos) {
  const c = r?.cbb ?? {}
  const a = c.awards ?? {}
  const t = c.totals?.full ?? {}
  const bench = r?.role === 'bench'
  const wins = +String(c.record?.final ?? `${r?.wins ?? 0}-0`).split('-')[0] || 0
  if (!bench) {
    const won = HONORS.find(k => a[k]?.userWon)
    const honor = a.wooden?.userWon ? 'Wooden Award winner' : a.wooden?.userFinalist ? 'Wooden Award finalist'
      : a.allAmerica?.user ? `${a.allAmerica.user.charAt(0).toUpperCase() + a.allAmerica.user.slice(1)}-team All-American`
      : won ? `${a[won].award ?? 'A national award'} winner` : null
    if (honor) return { pts: 3, why: honor }
    const mark = pos === 'big'
      ? ((t.ppg ?? 0) >= 16 ? `${t.ppg.toFixed(1)} points a game` : (t.rpg ?? 0) >= 9 ? `${t.rpg.toFixed(1)} rebounds a game` : null)
      : ((t.ppg ?? 0) >= 18 ? `${t.ppg.toFixed(1)} points a game` : (t.apg ?? 0) >= 6 ? `${t.apg.toFixed(1)} assists a game` : null)
    const deep = ['Sweet 16', 'Elite Eight', 'Final Four', 'National Championship'].includes(c.ncaa?.exit)
    const team = r?.champion ? 'National champions' : deep ? (c.ncaa.exit === 'National Championship' ? 'National runner-up' : `A run to the ${c.ncaa.exit}`) : c.confChamp || c.confRegChamp ? 'Conference champions' : wins >= 25 ? `${wins} wins` : null
    if (mark || team) return { pts: 2, why: mark ?? team }
  }
  return { pts: 1, why: bench ? 'A year off the bench' : 'A season as a starter' }
}
