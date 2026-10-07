// What a season can say about itself: the moments a player decides, the
// milestones and real records a stat line can hit, league leaders to measure
// against, and the headlines a season writes. Pure data + small helpers; the
// director (seasonDirector.js) wires them to a running season.

import { seeded } from './rng'

// ── Records (real single-season marks) ───────────────────────────────────────
export const RECORDS = {
  nfl: {
    qb: [
      { id: 'passyds', label: 'Passing yards', stat: 'seasonPassYds', value: 5477, holder: 'Peyton Manning, 2013' },
      { id: 'passtd',  label: 'Passing TDs',   stat: 'seasonTDs',     value: 55,   holder: 'Peyton Manning, 2013' },
      { id: 'g-passyds', label: 'Passing yards in a game', game: 'passYds', value: 554, holder: 'Norm Van Brocklin, 1951' },
      { id: 'g-passtd',  label: 'TD passes in a game',     game: 'tds',     value: 7,   holder: 'eight players' },
    ],
    rb: [
      { id: 'rushyds', label: 'Rushing yards', stat: 'seasonRushYds', value: 2105, holder: 'Eric Dickerson, 1984' },
      { id: 'rushtd',  label: 'Rushing TDs',   stat: 'seasonRushTDs', value: 28,   holder: 'LaDainian Tomlinson, 2006' },
      { id: 'g-rush',  label: 'Rushing yards in a game', game: 'rushYds', value: 296, holder: 'Adrian Peterson, 2007' },
    ],
    wr: [
      { id: 'recyds', label: 'Receiving yards', stat: 'seasonRecYds', value: 1964, holder: 'Calvin Johnson, 2012' },
      { id: 'rectd',  label: 'Receiving TDs',   stat: 'seasonRecTDs', value: 23,   holder: 'Randy Moss, 2007' },
      { id: 'g-rec',  label: 'Receiving yards in a game', game: 'recYds', value: 336, holder: 'Flipper Anderson, 1989' },
    ],
    te: [
      { id: 'recyds', label: 'Receiving yards by a TE', stat: 'seasonRecYds', value: 1416, holder: 'Travis Kelce, 2020' },
      { id: 'rectd',  label: 'Receiving TDs by a TE',   stat: 'seasonRecTDs', value: 18,   holder: 'Rob Gronkowski, 2011' },
    ],
    db: [
      { id: 'ints', label: 'Interceptions', stat: 'seasonINTs', value: 14, holder: 'Dick "Night Train" Lane, 1952' },
      { id: 'g-ints', label: 'INTs in a game', game: 'ints', value: 4, holder: 'many' },
    ],
    ol: [],
    team: [{ id: 'wins', label: 'Perfect regular season', statFn: r => r.losses === 0 && r.wins >= 17, holder: '2007 Patriots (16-0)' }],
  },
  bucket: {
    guard: [
      { id: 'ppg', label: 'Points per game', stat: 'ppg', value: 50.4, holder: 'Wilt Chamberlain, 1962' },
      { id: 'apg', label: 'Assists per game', stat: 'apg', value: 14.5, holder: 'John Stockton, 1990' },
      { id: 'g-pts', label: 'Points in a game', game: 'pts', value: 100, holder: 'Wilt Chamberlain, 1962' },
    ],
    big: [
      { id: 'ppg', label: 'Points per game', stat: 'ppg', value: 50.4, holder: 'Wilt Chamberlain, 1962' },
      { id: 'rpg', label: 'Rebounds per game', stat: 'rpg', value: 27.2, holder: 'Wilt Chamberlain, 1961' },
      { id: 'g-pts', label: 'Points in a game', game: 'pts', value: 100, holder: 'Wilt Chamberlain, 1962' },
    ],
    team: [{ id: 'wins', label: 'Most wins in a season', statFn: r => r.wins >= 74, holder: '2016 Warriors (73-9)' }],
  },
}

// ── Milestones (fire once as the season reveals) ─────────────────────────────
// ctx: { games (revealed so far), totals, wins, losses, streak, last }
const sumOf = (games, k) => games.reduce((s, g) => s + (g[k] ?? 0), 0)
const steps = (id, label, k, marks, unit) => marks.map(m => ({ id: `${id}-${m}`, label: label.replace('{n}', m.toLocaleString()), test: c => sumOf(c.games, k) >= m, big: m >= marks[marks.length - 2], unit }))
export const MILESTONES = {
  nfl: {
    common: [
      { id: 'streak-4', label: '4 straight wins', test: c => c.streak >= 4 },
      { id: 'streak-7', label: 'Seven straight', test: c => c.streak >= 7, big: true },
      { id: 'start-5-0', label: '5-0 start', test: c => c.games.length === 5 && c.wins === 5, big: true },
      { id: 'wins-10', label: '10 wins', test: c => c.wins >= 10 },
      { id: 'wins-13', label: '13 wins', test: c => c.wins >= 13, big: true },
      { id: 'unbeaten-8', label: 'Unbeaten at the halfway mark', test: c => c.games.length >= 8 && c.losses === 0, big: true },
    ],
    qb: [...steps('yds', '{n} passing yards', 'passYds', [1000, 2000, 3000, 4000, 5000]), ...steps('td', '{n} TD passes', 'tds', [10, 20, 30, 40, 50]),
      { id: 'g-300', label: '300-yard game', test: c => c.last?.passYds >= 300 }, { id: 'g-400', label: '400-yard game', test: c => c.last?.passYds >= 400, big: true }, { id: 'g-5td', label: 'Five TD passes in a game', test: c => c.last?.tds >= 5, big: true }],
    rb: [...steps('rush', '{n} rushing yards', 'rushYds', [500, 1000, 1500, 2000]), ...steps('td', '{n} rushing TDs', 'rushTDs', [5, 10, 15, 20]),
      { id: 'g-100', label: '100-yard game', test: c => c.last?.rushYds >= 100 }, { id: 'g-200', label: '200-yard game', test: c => c.last?.rushYds >= 200, big: true }],
    wr: [...steps('rec', '{n} receiving yards', 'recYds', [500, 1000, 1500]), ...steps('td', '{n} receiving TDs', 'recTDs', [5, 10, 15]),
      { id: 'g-150', label: '150-yard game', test: c => c.last?.recYds >= 150 }, { id: 'g-200', label: '200-yard game', test: c => c.last?.recYds >= 200, big: true }],
    te: [...steps('rec', '{n} receiving yards', 'recYds', [500, 1000, 1250]), ...steps('td', '{n} receiving TDs', 'recTDs', [5, 10, 15]),
      { id: 'g-120', label: '120-yard game', test: c => c.last?.recYds >= 120 }],
    db: [...steps('int', '{n} interceptions', 'ints', [3, 6, 9, 12]), ...steps('pbu', '{n} passes defended', 'pbus', [10, 15, 20]),
      { id: 'pick6', label: 'Pick-six', test: c => c.last?.pickSixes >= 1, big: true }, { id: 'g-2int', label: 'Two-INT game', test: c => c.last?.ints >= 2 }],
    ol: [...steps('pnk', '{n} pancakes', 'pancakes', [20, 40, 60]),
      { id: 'clean-3', label: 'Three straight clean sheets', test: c => c.games.length >= 3 && c.games.slice(-3).every(g => g.sacks === 0) }],
  },
  bucket: {
    common: [
      { id: 'streak-6', label: 'Six straight wins', test: c => c.streak >= 6 },
      { id: 'streak-12', label: 'Twelve straight', test: c => c.streak >= 12, big: true },
      { id: 'wins-50', label: '50 wins', test: c => c.wins >= 50 }, { id: 'wins-60', label: '60 wins', test: c => c.wins >= 60, big: true }, { id: 'wins-70', label: '70 wins', test: c => c.wins >= 70, big: true },
      { id: 'g-40', label: '40-point game', test: c => c.last?.pts >= 40 }, { id: 'g-50', label: '50-point game', test: c => c.last?.pts >= 50, big: true }, { id: 'g-60', label: '60-POINT GAME', test: c => c.last?.pts >= 60, big: true },
      { id: 'trip-dbl', label: 'Triple-double', test: c => c.last && c.last.pts >= 10 && c.last.reb >= 10 && c.last.ast >= 10, big: true },
      { id: 'pts-1000', label: '1,000 points', test: c => sumOf(c.games, 'pts') >= 1000 }, { id: 'pts-2000', label: '2,000 points', test: c => sumOf(c.games, 'pts') >= 2000, big: true },
    ],
    guard: [], big: [],
  },
}

// ── League leaders (synthesised from the real pool around real-world scale) ─
const LEADER_STAT = {
  nfl: {
    qb: { key: 'seasonPassYds', label: 'PASS YDS', base: 3350, per: 330, noise: 240 },
    rb: { key: 'seasonRushYds', label: 'RUSH YDS', base: 880, per: 220, noise: 160 },
    wr: { key: 'seasonRecYds', label: 'REC YDS', base: 930, per: 210, noise: 150 },
    te: { key: 'seasonRecYds', label: 'REC YDS', base: 620, per: 160, noise: 120 },
    db: { key: 'seasonINTs', label: 'INT', base: 2.4, per: 1.1, noise: 1.2, int: true },
    ol: { key: 'seasonPancakes', label: 'PANCAKES', base: 34, per: 7, noise: 6, int: true },
  },
  bucket: {
    guard: { key: 'ppg', label: 'PPG', base: 21.5, per: 2.6, noise: 1.8, dec: 1 },
    big: { key: 'ppg', label: 'PPG', base: 20.5, per: 2.4, noise: 1.8, dec: 1 },
  },
}
const avgAttr = p => { const v = Object.values(p.attrs || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }
export function leaderBoard({ sport, pos, pool, seed, you }) {
  const def = LEADER_STAT[sport]?.[pos]
  if (!def) return null
  const r = seeded(`leaders-${seed}`)
  const rows = [...(pool || [])].filter(p => p.attrs).sort((a, b) => avgAttr(b) - avgAttr(a)).slice(0, 7).map(p => {
    let v = def.base + (avgAttr(p) - 5.2) * def.per + (r() - 0.5) * 2 * def.noise
    v = def.int ? Math.max(0, Math.round(v)) : def.dec ? +Math.max(0, v).toFixed(def.dec) : Math.max(0, Math.round(v))
    return { name: p.name, team: p.team, value: v }
  })
  const mine = { name: you.name, team: you.team, value: you.value, me: true }
  const all = [...rows, mine].sort((a, b) => b.value - a.value)
  return { label: def.label, key: def.key, rows: all.slice(0, 6), rank: all.indexOf(mine) + 1, of: all.length }
}
export const leaderStatKey = (sport, pos) => LEADER_STAT[sport]?.[pos]?.key ?? null

// ── Headlines ────────────────────────────────────────────────────────────────
const pick = (r, a) => a[Math.floor(r() * a.length)]
export function headlineFor(ev, r = Math.random) {
  const { name, team, opp, n, label } = ev
  switch (ev.type) {
    case 'streak': return pick(r, [`${team} make it ${n} straight`, `${n} in a row — ${team} are rolling`, `${name} has ${team} on a ${n}-game heater`])
    case 'skid': return pick(r, [`${team} drop ${n} straight`, `Pressure mounts: ${n}-game skid in ${team.split(' ').slice(-1)[0]} land`, `${team} searching for answers after ${n} losses`])
    case 'big': return pick(r, [`${name} torches ${opp}: ${label}`, `${label} — ${name} takes over vs ${opp}`, `${opp} had no answer for ${name} (${label})`])
    case 'bust': return pick(r, [`Rough night for ${name} in ${opp} loss`, `${opp} bottle up ${name}`, `${name}, ${team} stumble at ${opp}`])
    case 'milestone': return pick(r, [`${name} reaches ${label}`, `Milestone: ${label} for ${name}`, `${name} hits ${label} as ${team} keep pace`])
    case 'record': return `RECORD: ${name} sets the all-time mark — ${label}`
    case 'clinch': return pick(r, [`${team} clinch a playoff berth`, `Playoffs: ${team} are in`, `${name} leads ${team} to the postseason`])
    case 'out': return pick(r, [`${team} eliminated from playoff contention`, `Season slips away for ${team}`])
    case 'moment': return label
    case 'race': return pick(r, [`${name} in the ${label} conversation`, `${label} watch: ${name} climbing`, `Voters noticing ${name}'s season`])
    default: return label || ''
  }
}

// ── Moments (decisions) ──────────────────────────────────────────────────────
// A moment is picked for the state of the season when the reveal reaches its
// stop. Effects: attr {trait: ±1} (rest of season, or `window` games), team
// {off, def}, sit (games you miss), gamble { p, hit, miss } with its own effects.
const by = (attrMap, build, types, want) => {
  const vals = types.map(t => ({ t, v: build[t]?.val ?? 5, cat: attrMap?.[t]?.category }))
  if (want === 'best') return vals.sort((a, b) => b.v - a.v)[0]?.t
  if (want === 'worst') return vals.sort((a, b) => a.v - b.v)[0]?.t
  return vals.find(x => x.cat === want)?.t ?? vals[0]?.t
}
const L = (attrMap, t) => attrMap?.[t]?.label ?? t

export function momentFor({ sport, pos, stop, ctx, build, types, attrMap, seed, teamNick }) {
  const r = seeded(`moment-${seed}-${stop.at}`)
  const { wins, losses, streak, skid } = ctx
  const isBucket = sport === 'bucket'
  const best = by(attrMap, build, types, 'best'), worst = by(attrMap, build, types, 'worst')
  const physical = by(attrMap, build, types, isBucket ? 'athleticism' : 'physical')
  const mental = by(attrMap, build, types, isBucket ? 'iq' : 'mental')
  const defKey = isBucket ? (pos === 'big' ? 'interiorDefense' : 'perimeterDefense') : null
  const isDef = pos === 'db'
  const o = (id, label, sub, effect) => ({ id, label, sub, effect })

  if (stop.kind === 'playoffs') {
    return {
      id: 'playoffs', kicker: 'BEFORE THE PLAYOFFS', title: 'Win-or-go-home',
      body: isBucket ? 'The stage gets bigger. How do you want to play the postseason?' : 'Single elimination from here. How do you want to play it?',
      options: [
        o('takeover', 'Take over', `+1 ${L(attrMap, best)} for the playoffs, −1 ${L(attrMap, worst)}`, { attr: { [best]: 1, [worst]: -1 }, scope: 'playoffs' }),
        o('steady', 'Trust the system', `Team ${isDef ? 'offense' : 'defense'} +1 for the playoffs`, { team: isDef ? { off: 1 } : { def: 1 }, scope: 'playoffs' }),
      ],
    }
  }
  const stopIdx = stop.i
  if (stopIdx === 0) {
    if (losses === 0 || (wins - losses) >= 3 || (isBucket && wins >= 15)) return {
      id: 'hot-start', kicker: `${wins}–${losses} START`, title: 'Everyone\'s watching',
      body: `${teamNick} are the story of the early season and your name is in every segment. Ride it, or keep the noise out?`,
      options: [
        o('embrace', 'Embrace the spotlight', `Gamble: 60% you feed off it (+1 ${L(attrMap, best)}), 40% it gets in your head (−1 ${L(attrMap, mental)} for ${isBucket ? 15 : 3} games)`, { gamble: { p: .6, hit: { attr: { [best]: 1 }, line: 'You feed off it. The big games get bigger.' }, miss: { attr: { [mental]: -1 }, window: isBucket ? 15 : 3, line: 'The noise got in. A few quiet weeks follow.' } } }),
        o('quiet', 'Nothing\'s won yet', `+1 ${L(attrMap, worst)} — back to work on the weak spot`, { attr: { [worst]: 1 } }),
      ],
    }
    if (skid >= 3 || (losses - wins) >= 2) return {
      id: 'early-hole', kicker: `${wins}–${losses}`, title: 'Players-only meeting',
      body: 'The locker room is tight and the vets are looking at you. Call the meeting?',
      options: [
        o('meeting', 'Call it', `Gamble: 65% the room responds (team ${isDef ? 'offense' : 'defense'} +1), 35% it leaks (team −1 for ${isBucket ? 10 : 2} games)`, { gamble: { p: .65, hit: { team: isDef ? { off: 1 } : { def: 1 }, line: 'The room responded. Different energy from here.' }, miss: { team: { off: -1, def: -1 }, window: isBucket ? 10 : 2, line: 'It leaked to the media. Two ugly weeks.' } } }),
        o('process', 'Let the coaches handle it', `+1 ${L(attrMap, worst)} from extra work`, { attr: { [worst]: 1 } }),
      ],
    }
    return {
      id: 'film', kicker: 'BYE WEEK', title: 'Extra film or extra reps?',
      body: 'A week off and a choice about where the hours go.',
      options: [
        o('film', 'Film room', `+1 ${L(attrMap, mental)}`, { attr: { [mental]: 1 } }),
        o('reps', 'On the field', `+1 ${L(attrMap, physical)}`, { attr: { [physical]: 1 } }),
      ],
    }
  }
  if (stopIdx === 1) {
    if (isBucket) return {
      id: 'allstar', kicker: 'ALL-STAR BREAK', title: 'The break',
      body: wins >= 25 ? 'You made the All-Star team. Play the weekend, or rest the legs?' : 'Four days off at the break. Rest, or get in the gym?',
      options: [
        o('play', wins >= 25 ? 'Play the All-Star game' : 'Pick-up runs all week', `+1 ${L(attrMap, best)} · the legs pay for it: −1 ${L(attrMap, physical)} for 8 games`, { attr: { [best]: 1 }, then: { attr: { [physical]: -1 }, window: 8 }, xp: 30 }),
        o('rest', 'Rest and reset', `+1 ${L(attrMap, worst)}`, { attr: { [worst]: 1 } }),
      ],
    }
    return {
      id: 'deadline', kicker: 'TRADE DEADLINE', title: 'The front office calls',
      body: `${teamNick} can rent a star for the stretch run, or add depth on the other side of the ball.`,
      options: [
        o('rental', isDef ? 'Add a playmaker on offense' : 'Rent a star', `Team ${isDef ? 'offense' : 'offense'} +2 the rest of the way · chemistry: team −1 for 2 games`, { team: { off: 2 }, then: { team: { off: -1, def: -1 }, window: 2 } }),
        o('depth', 'Shore up the defense', 'Team defense +1 the rest of the way', { team: { def: 1 } }),
        o('pat', 'Stand pat', 'Keep the picks. Nothing changes.', {}),
      ],
    }
  }
  if (stopIdx === 2) {
    if (isBucket) return {
      id: 'deadline', kicker: 'TRADE DEADLINE', title: 'The front office calls',
      body: `${teamNick} can rent a star for the stretch run, or hold the roster.`,
      options: [
        o('rental', 'Rent a star', 'Team offense +2 the rest of the way · chemistry: team −1 for 6 games', { team: { off: 2 }, then: { team: { off: -1, def: -1 }, window: 6 } }),
        o('depth', 'Add a defender', 'Team defense +1 the rest of the way', { team: { def: 1 } }),
        o('pat', 'Stand pat', 'Keep the picks. Nothing changes.', {}),
      ],
    }
    const hurt = r() < .55
    if (hurt) return {
      id: 'injury', kicker: `WEEK ${stop.at}`, title: 'Nagging injury',
      body: 'Nothing structural, but it\'s there every snap. The trainers leave it to you.',
      options: [
        o('through', 'Play through it', `−1 ${L(attrMap, physical)} for the last ${stop.total - stop.at} games`, { attr: { [physical]: -1 }, window: stop.total - stop.at }),
        o('sit', 'Sit one out', 'Miss next week — the team plays without you. Full strength after.', { sit: 1 }),
      ],
    }
    return {
      id: 'push', kicker: 'PLAYOFF PUSH', title: 'How do you finish?',
      body: `${wins}–${losses} with ${stop.total - stop.at} to play.`,
      options: [
        o('moon', 'Shoot for the moon', `+1 ${L(attrMap, best)}, −1 ${L(attrMap, worst)}`, { attr: { [best]: 1, [worst]: -1 } }),
        o('ball', 'Protect the ball', `+1 ${L(attrMap, mental)}, −1 ${L(attrMap, physical)}`, { attr: { [mental]: 1, [physical]: -1 } }),
      ],
    }
  }
  return null
}
