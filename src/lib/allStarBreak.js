// ALL-STAR SATURDAY's hooks into the season (lib/career.js): when the break is, who's invited, the stop at the break,
// a night left open, what the season keeps. Light on purpose: no engine and no contest (those are lib/allStar.js, which
// the screen loads), so the season code never carries a canvas game in its bundle.
import { seeded } from './rng.js'

const gradeVal = (c, t) => Math.round(c.build?.[t]?.val ?? 0)
export const THREE_GRADE = 9          // A
export const DUNK_SUM = 18            // Finishing + Bounce, 0-11 each
export const aswOpen = c => !!c?.active?.asw && !c.active.asw.done

// ── When: mid-February, the same weekend for the whole league (seeded by the season, like the bye table) ──
// The NBA's break falls after a team's 53rd to 56th game; the trade deadline (lib/career.js deadlineGame) is a week before
export function allStarGame(c) {
  const total = c?.active?.base?.games?.length ?? 82
  const at = 53 + Math.floor(seeded(`nba-asw-${c?.season ?? 2026}`)() * 3)
  return Math.round(at * total / 82)
}

// ── Who gets asked ──
export function invitesFor(c) {
  const js = gradeVal(c, 'jumpShot'), fin = gradeVal(c, 'finishing'), bo = gradeVal(c, 'bounce')
  return { three: js >= THREE_GRADE, dunk: fin + bo >= DUNK_SUM, js, fin, bounce: bo }
}

// ── The hooks lib/career.js calls ──
// At the break (advanceWeek, game by game): an invitation stops the run there. Hurt (out for the season, or sitting
// the next game): he's asked and can't go, a line in the feed. No invitation: nothing.
export function allStarBeat(c, D, k) {
  const a = c.active
  if (a.asw || a.po || k !== allStarGame(c)) return null
  const inv = invitesFor(c)
  if (!inv.three && !inv.dunk) return null
  const what = inv.three && inv.dunk ? 'the 3-Point Contest and the Slam Dunk Contest' : inv.three ? 'the 3-Point Contest' : 'the Slam Dunk Contest'
  const inj = a.out || a.injury || D.sat?.includes(k) ? ([...(c.injuries ?? [])].reverse().find(i => i.year === c.year + 1)?.kind ?? 'injury') : null
  if (inj) return { set: { asw: { at: k, inv: { three: inv.three, dunk: inv.dunk }, hurt: inj, done: true, res: {} } }, notes: [{ note: `${c.name} is invited to ${what} at All-Star Saturday, but the ${inj} keeps him out of it.`, noteKind: 'ALL-STAR SATURDAY' }] }
  return { set: { asw: { at: k, inv: { three: inv.three, dunk: inv.dunk }, done: false } }, stop: true }
}
// a night left open when the season moves on (the checks; the screen always settles it first): he passed
export const allStarSkip = c => (aswOpen(c) ? { ...c, active: { ...c.active, asw: { ...c.active.asw, done: true, skipped: true, res: {} } } } : c)
// hurt between the invitation and the night (an injury in that last game): he can't take part
export const aswHurt = (c, D) => !!(c?.active?.out || c?.active?.injury || D?.sat?.includes(c?.active?.k))
// what the season keeps (bookSeason): the results, small
export function allStarSeason(c) {
  const w = c.active?.asw
  if (!w || (!w.res?.three && !w.res?.dunk)) return null
  return { ...(w.res.three ? { three: w.res.three } : {}), ...(w.res.dunk ? { dunk: w.res.dunk } : {}) }
}

// Practice's All-Star Saturday games (MiniGameLab) open once he has taken part in the night in a Career, on this device
const UNLOCK = 'bap_allstar_unlocked'
export const allStarUnlocked = () => { try { return localStorage.getItem(UNLOCK) === '1' } catch { return false } }
export const unlockAllStar = () => { try { localStorage.setItem(UNLOCK, '1') } catch {} }
