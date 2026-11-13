// FRANCHISE: the row shapes every selector hands the screens (API.md "Shapes used everywhere").
import { readableTextColor, nflHeadshot } from '../../utils/simulation'
import { DEV, SLOTS, OL_SPOTS, XP_PER_POINT, slotOf, ovrGrade, gradeOf, clamp, r2 } from './consts'
import { TEAM_INFO, city, nick } from './core'
import { archOf, lastName, initials } from './players'
import { COACH_TYPES, COACH_LABEL, COACH_SHORT, ROLE_NAME, coachOvr as coachOvrOf } from './coachData'
import { statLine } from './stats'

const REFS = {}
export function teamRef(short) {
  if (REFS[short]) return REFS[short]
  const t = TEAM_INFO[short]
  if (!t) return null
  return (REFS[short] = { short, name: t.name, city: city(short), nick: nick(short), color: t.color, color2: t.color2, ink: readableTextColor(t.color), logo: t.logo, conf: t.conf, div: t.div })
}
// a headshot id as a URL (college ids live under the same base), or null
export const photoUrl = photo => (photo ? nflHeadshot(String(photo)) : null)

export const MOOD_WORDS = [[80, 'Thrilled'], [65, 'Happy'], [50, 'Content'], [35, 'Restless'], [20, 'Unhappy'], [0, 'Wants out']]
export const moodWord = m => MOOD_WORDS.find(([lo]) => m >= lo)[1]
const SLOT_ORDER = Object.fromEntries(SLOTS.map((s, i) => [s.slot, i]))
export const slotOrder = slot => SLOT_ORDER[slot] ?? 99

export function injView(p) {
  if (!p.inj) return null
  const out = p.inj.wk > 0
  return { wk: p.inj.wk, what: p.inj.what, ir: !!p.inj.ir, status: p.inj.ir ? 'IR' : out ? 'OUT' : 'QUESTIONABLE' }
}
// depth: { pid: [order at his slot (1-based), starter] } for a team
export function depthMap(F, t) {
  const m = {}
  if (!t?.depth) return m
  for (const s of SLOTS) {
    if (s.slot === 'KR') continue
    const list = t.depth[s.slot] ?? []
    list.forEach((id, i) => {
      const own = F.players[id] && slotOf(F.players[id]) === s.slot
      // a lineman is listed at several spots: his row shows the best of them, his own spot first
      if (m[id] && !(OL_SPOTS.includes(s.slot) && (i < m[id][0] - 1 || (own && i <= m[id][0] - 1)))) return
      m[id] = [i + 1, i < s.n, s.slot]
    })
  }
  return m
}
export function playerRow(F, p, dm = null) {
  if (!p) return null
  const d = dm ? dm[p.id] : p.team && F.teams[p.team] ? depthMap(F, F.teams[p.team])[p.id] : null
  return {
    id: p.id, name: p.name, short: lastName(p.name), pos: p.pos, slot: slotOf(p), num: p.num ?? null, age: p.age, exp: p.exp, ovr: p.ovr, grade: ovrGrade(p.ovr), arch: archOf(p),
    dev: p.devKnown ? p.dev : null, devName: p.devKnown ? DEV[p.dev] : null,
    team: p.team, photo: p.photo ?? null, initials: initials(p.name), skin: p.skin ?? '#7a5030', built: !!p.built, real: !!p.real, gen: !!p.gen,
    salary: p.con?.sal ?? 0, yrs: p.con?.yrs ?? 0, guar: p.con?.guar ?? 0, rookie: !!p.con?.rookie,
    mood: p.mood, moodWord: moodWord(p.mood), drives: p.drives ?? [],
    inj: injView(p), wear: Math.round(p.wear ?? 0),
    starter: !!d?.[1] && !(p.inj && p.inj.wk > 0), depth: d?.[0] ?? null, at: d?.[2] ?? slotOf(p),
    line: statLine(p.pos, p.s),
    xp: Math.round(p.xp ?? 0), xpNext: XP_PER_POINT, pts: p.pts ?? 0,
    brk: p.brk ?? null, tierUp: p.brk != null && p.brkW != null && F.last?.year === p.brk && F.last?.week === p.brkW,
    flags: { hold: !!p.hold, wantsOut: !!p.want, block: !!p.block, tag: !!p.con?.tag, questionable: !!(p.inj && p.inj.q) },
  }
}
export function teamRows(F, short) {
  const t = F.teams[short], dm = depthMap(F, t)
  return t.roster.map(id => playerRow(F, F.players[id], dm)).filter(Boolean)
    .sort((a, b) => slotOrder(a.at) - slotOrder(b.at) || (a.depth ?? 99) - (b.depth ?? 99) || b.ovr - a.ovr)
}

// ── Coaches ──────────────────────────────────────────────────────────────────
// a coach's overall for a job (the data file's formula: coachData.js)
export const coachOvr = (c, role = c.role) => coachOvrOf(c.a, role)
export function coachRow(F, c, role = null) {
  if (!c) return null
  const r = role ?? c.role
  return {
    id: c.id, name: c.name, role: r, roleName: ROLE_NAME[r], team: c.team, age: c.age, real: !!c.real, placeholder: !!c.placeholder, built: !!c.built, gen: !!c.gen,
    ratings: COACH_TYPES.map(k => ({ key: k, label: COACH_LABEL[k], short: COACH_SHORT[k], val: c.a[k], grade: gradeOf(c.a[k]) })),
    ovr: coachOvr(c, r), grade: ovrGrade(coachOvr(c, r)), salary: c.con?.sal ?? 0, yrs: c.con?.yrs ?? 0,
    record: c.w + c.l > 0 ? `${c.w}-${c.l}` : null, from: c.from ?? null,
    calls: c.calls ?? null, side: c.side ?? null, interim: !!c.interim, title: c.title ?? null, since: c.since ?? null, identity: c.identity ?? null,
  }
}
// The play-caller's rating on a side of the ball. Who calls it is real (the data's `calls`): the head coach when
// he calls that side himself, otherwise the coordinator. The other man's rating lifts it when it is the better one.
export function playcall(F, t) {
  const hc = F.coaches[t.staff.hc], oc = F.coaches[t.staff.oc], dc = F.coaches[t.staff.dc]
  const side = (co, k, tag) => {
    const h = hc?.a[k] ?? 4, c = co?.a[k] ?? h
    const caller = hc && hc.calls === tag ? h : c, other = hc && hc.calls === tag ? c : h
    return clamp(caller + Math.max(0, other - caller) * 0.5 + (hc && hc.calls !== tag && h >= 8 ? 0.3 : 0), 0, 11)
  }
  return { off: r2(side(oc, 'offPlaycalling', 'off')), def: r2(side(dc, 'defPlaycalling', 'def')), sit: (hc?.a.situational ?? 5) + ((F.gm.tree?.gameday ?? 0) && t.short === F.team ? F.gm.tree.gameday * 0.5 : 0), dev: hc?.a.talentDev ?? 5, culture: hc?.a.culture ?? 5,
    offCaller: hc && hc.calls === 'off' ? hc.id : oc?.id ?? null, defCaller: hc && hc.calls === 'def' ? hc.id : dc?.id ?? null }
}
