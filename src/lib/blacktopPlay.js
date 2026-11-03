// A Blacktop game from the server's inputs: the builds and seed at the tip-off and the
// calls as they lock. Every phone in the game, anyone watching it, and the live server
// (to book the result and the ratings: live/src/index.js) play this same game. Pure.
import { seededShuffle } from './rng'
import { simStreetball } from './hoops'
import { BOT_NAMES, teamName, autoBuild, buildOk } from './blacktopCore'

export function playOut({ final, match, locks, pools, types }) {
  if (!final || !match) return null
  const out = new Set(final.afk ?? [])
  const cpu = seededShuffle(BOT_NAMES, `${final.seed}-afk`)
  let ci = 0
  const poolOf = pos => (pos === 'big' ? pools?.big : pools?.guard) ?? []
  const mk = p => {
    const t = p.pos === 'big' ? types.big : types.guard
    const sent = final.builds?.[p.vid]
    // a build that isn't real is treated as empty: the same answer on every phone
    const b = autoBuild(sent && buildOk(sent, poolOf(p.pos)) ? sent : null, t, poolOf(p.pos), `${final.seed}-${p.vid}`)
    return out.has(p.vid)
      ? { id: p.vid, name: cpu[ci++ % cpu.length], pos: p.pos, role: 'balanced', build: b, bot: true, uid: null, cos: null }
      : { id: p.vid, name: p.name, pos: p.pos, role: final.roles?.[p.vid] ?? 'balanced', build: b, bot: p.bot, mimic: !!p.mimic, uid: p.uid, cos: p.cos ?? null }
  }
  const teams = [match.players.filter(p => p.team === 0).map(mk), match.players.filter(p => p.team === 1).map(mk)]
  return { ...simStreetball({ teams, seed: final.seed, goal: 11, winBy: 2, cap: 15, names: [teamName(match, 0), teamName(match, 1)], calls: locks }), teams }
}

