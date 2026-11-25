# NBA Franchise: the league state (F) and the seams between the three parts

Owner of this file: core (branch `frnba`). Cap (branch `frnba-cap`, agent B) and sim (branch `frnba-sim`, agent C)
merge `frnba` to stay in line. If you need a field or a signature changed, add it to your branch under a
`## Proposed` heading at the bottom and say so in your report; core folds it in.

Rules for every part: pure JS, seeded (`rngOf` from `../rng`, never Math.random), F is plain JSON (it is saved to
localStorage), keep it small (a league ~1 MB unpacked at most, ~450 men). Everything lives in
`src/lib/franchise2/nba/`. Shared helpers come from `src/lib/franchise2/` (`rng.js` rngOf/clamp/r1,
`copy.js`, `names.js` for made-up names, `faces.js` for build faces). Do not fork football files; import them.

## Files

| file | owner | what |
|---|---|---|
| `nba/league.js` | core | teams, conferences, divisions, real rosters to men, `teamOvr`, `rotationOf` default, `FIRST_YEAR` |
| `nba/schedule.js` | core | the 82-game schedule, days, back-to-backs, All-Star break, deadline day |
| `nba/season.js` | core | `playDay`, standings, tiebreaks, play-in, playoffs (best of 7, 2-2-1-1-1), phases |
| `nba/draft.js` | core | the class, scouting, lottery (2019 odds), two rounds, `F.picks` |
| `nba/moments.js` | core | clutch possessions inside the sim's game (uses C's game seam below) |
| `nba/index.js` | core | `createNbaFranchise`, saves (own keys), upgrades, `NBA` re-exports |
| `nba/cap.js` `nba/contracts.js` `nba/market.js` `nba/trades.js` | B | cap, tax, aprons, Bird rights, exceptions, max/min, rookie scale, options, FA + RFA, cuts/waivers, trades |
| `nba/game.js` `nba/stats.js` `nba/aging.js` `nba/awards.js` `nba/injury.js` | C | game sim + box, rotations/minutes, stats/leaders, injuries/rest, aging/development/retirement, awards |
| `nba/stubs.js` | core | stand-ins for B and C until their branches land; deleted at the merge |

Core imports B and C only through `nba/seams.js`, which re-exports from their files (stubs until then). Keep the
names below exactly so the merge is a one-file change.

## Years

`F.year` is the year the season starts: 2026 = the 2026-27 season (`seasonText(2026)` = "2026-27"). The draft at
the end of that season is the **2027 draft** (`F.year + 1`), and contracts signed that summer start in season
`F.year + 1`. Cap numbers are by season start year (`capOf(2026)` = the 2026-27 cap).

## F (the franchise)

```
F = {
  v: NBA_SAVE_V, sport: 'nba', seed: 'string', slot: 0..2, owner: 'username or Guest', sandbox: bool,
  team: 'BOS',                      // the GM's team (short)
  year: 2026,                       // season start year
  nid: 1,                           // next man id
  noCap: 1?, noInj: 1?,             // the rules switches (franchise2/rules.js meaning; noCap = no cap AND no tax)
  builds: [{ pos: 'guard'|'big', spot: 'PG'..'C', build, types, name, num, face, age, rk, car: [], i, done? }], // done: the year he retired (aging.js)
  teams: { [short]: Team },
  fa: [Man],                        // free agents / the street
  dc: [Prospect],                   // this year's draft class (core)
  picks: [Pick],                    // every pick for the next 7 drafts (core makes them, B trades them)
  sched: Game[],                    // the season's 1,230 games, in day order (core)
  day: 0,                           // index of the next day to play (core)
  days: N,                          // number of regular season days; see schedule.js for asb/deadline days
  asb: dayIndex, ddl: dayIndex,     // All-Star break starts / trade deadline (last day trades allowed)
  phase: 'season' | 'playin' | 'playoffs' | 'off',
  off: { step: 'awards'|'lottery'|'draft'|'resign'|'fa'|'camp'|'done', ... }, // offseason progress (core drives, B fills fa)
  po: Playoffs | null,              // play-in + bracket (core)
  ss: { [manId]: SeasonLine },      // this season's stats per man (C writes, core reads)
  ps: { [manId]: SeasonLine },      // this postseason's stats (C writes)
  hist: [SeasonRecord],             // one per finished season (core writes, awards from C)
                                    //   hist[].aw winners also carry p (position) and l (their line, stored at closeSeason:
                                    //   season awards [gp, pts, reb, ast, stl, blk, gs, cp] totals; FMVP/ECF/WCF the series
                                    //   [gp, pts, reb, ast]); saves from before 2026-11-23 have neither
  retired: [RetiredRow],            // C's retirements land here; offseason.js retiredRow/keepRetired pack them (below)
  news: [{ d, y, t, k, tag, s, text, i?, g? }], // the wire (addNews from nba/news.js): t the calendar day (days since
                                    //   1970, news.js wireTime), i the man, g games out (an injury: newsWorthy reads it)
  log: [ResultSummary],             // the GM's team's results this season (core); a row whose game had a moment keeps
                                    //   mo { side, hit, by, vs, kind, pts, them, tov, at, left, per, lead, sealed } (season.js finishMoment)
  rings: 0, moments: 'adv'|'simple'|'off',
}
```

Fields the 2026-11 fix round added to F (all optional: an older save loads with none):

```
  pend: { d, h, a, n, po, us, them, left, per, ot?, spot: 'off'|'def'|'ft', G } // a moment up (season.js): per the period,
                                    //   ot the overtime number (per - 4), spot the kind of moment (momentSpot)
  fao: { [manId]: deal },           // the GM's offers standing for the next FA day (market.js placeOffer / pullOffer)
  fan: { y, d, r: [{ i, n, k: 'signed'|'lost'|..., s, d, why }] } // what came of the GM's offers in the last FA round
  rfq: [{ i, s, d }],               // offer sheets the GM's restricted free agents signed with team s: his to match (matchSheet)
  thin: { [short]: day },           // a league team under 14 men, and the day it fell under (season.js; deleted when empty)
  lot: { y, sys: '2019'|'321', order, r2, lottery: [{ s, from, to, odds, balls?, rel? }], balls, drawn }
                                    //   the draft order (draft.js runLottery): sys '321' from the 2027 draft (16 teams,
                                    //   37 balls, all 16 drawn, rel = "draft relegated", no lower than 12); '2019' before
                                    //   (14 teams, balls 1000 = combinations, drawn 4)
  lotH: { [short]: [[draftYear, slot]] }, // each team's own pick's slot, the last three drafts (the 3-2-1's repeat rules)
  as: { E: { st, res }, W, g?: { E, W, mvp, s } } | null, // the All-Star teams (5 starters, 7 reserves) and the game
  asDone: 0..3,                     // All-Star progress: 1 starters named, 2 reserves named, 3 the game played
  off.dev: { y, m, up, dn, rt },    // the summer's development report (NbaOffseason devOf): rows [id, OVR before, after]
                                    //   for the GM's men (m), the league's risers (up) and fallers (dn); rt retired ids
  off.wire: [[day, id, team, $, years]], // free agency's signings, day by day (the screen's Around the league)
  off.fres: [[id, team | null]],    // what became of the GM's offers on the last day played (null: still deciding)
  off.ret: [{ i, n, ag, yrs, o, b? }], // the GM's men (his builds first) who retired this summer, for the re-sign stop
```

RetiredRow (offseason.js retiredRow): `{ i, n, ag, s, yrs, o, y (last season), t: [gp, pts, reb, ast], aw?: ['2027MVP'...],
as? (All-Star count), ch? (titles), b?, gm?, k? }`. `k` 1 = a notable career, kept forever (the big awards, two
All-Stars, 15,000 points, 16 seasons, the GM's own); `gm` 1 = retired off the GM's roster or played three seasons
for him. The rest: the last 120 (RETIRED_REST). A raw row from ageLeague (`car`, `aw` objects) is packed on the next
keepRetired.

## Team

```
Team = {
  s: 'BOS', conf: 'E'|'W', div: 'Atlantic'|...,
  r: [Man],                         // everyone under contract: 15 standard + up to 3 two-way (Man.tw = 1)
  rot: [manId] | null,              // GM's rotation order override (starters first five); null = auto (C's rotationOf)
  min: { [manId]: minutes } | null, // GM's minutes targets, optional (C honours if set)
  exc: { yr, mk, mle, bae, baeY, hc, room } // B: exceptions used this league year and the hard cap triggered (hc 'a1'|'a2')
  tpe: [{ $, n, until }],           // trade exceptions: $ left, n the man whose salary made it, until a calDay (trades.js tpesOf)
  dead: [{ n, $, y, from, to, st? }], // waived salary still on the books: $ a season in every season from..to, y the
                                    //   seasons left from the books' season through `to` (newSeason resets it from `to`
                                    //   each new season, so it ages once a league year), st 1 = stretched (contracts.js cutMan)
  txh: [year],                      // seasons it paid the tax (the repeater rule)
  w: 0, l: 0                        // NOT stored: records are computed from sched (season.js records)
}
```

## Man (a player, kept short: ~450 in a league)

```
i   id                    n   name                 p   spot 'PG'|'SG'|'SF'|'PF'|'C'
g   'guard'|'big'         o   OVR (40..99)         pk  potential OVR (his ceiling, hidden on screen as a grade)
a   attrs: the build's ten ratings 0..11 for his group (GUARD_TYPES / BIG_TYPES in data/nba-*.js)
ag  age this season       ht  inches             wt  lbs           h  photo key (real men: name -> nba-headshots.json)
num jersey                b   index in F.builds (the GM's own build) or absent
rk  rookie season year    dr  [draftYear, round, pick, teamShort] or absent (undrafted)
c   college or country    ys  years of NBA service (before this season)

-- contract (B owns the meaning, core only displays) --
$   salary this season, $M          y   seasons left incl. this one       sc  [$M next seasons...] (length y-1)
opt { k: 'P'|'T', yr: seasonYear }  (a player or team option on that season)
rs  1 = on a rookie-scale deal      rfa 1 = restricted at expiry          tw  1 = two-way
bird yrs with this team for Bird rights (0..3+, resets on change of team except by trade)
ntc 1 (no-trade)                    sgn  year signed (for the Dec 15 / 3-month trade restriction)

-- added in the 2026-11 fix round (all optional) --
txd  calDay he was traded (two months before his salary can be combined in another trade: trades.js aggLocked)
osm  { s, y }: his team matched team s's offer sheet in league year y: no trade that league year, and none to s until
     the next summer's free agency is over (trades.js sheetLockTo)
osh  { s, d }: an offer sheet the GM's team (s) signed him to, waiting on his old team's answer (market.js)
qot  1 = his team tendered his qualifying offer (the re-sign stop's Tender QO: he stays restricted)
dco  $M: his team declined his rookie-scale team option, so it can re-sign him for no more than that salary
wvb  { s, t, to }: waived by team s at time t (contracts.js timeOf): s can't sign him again for a year (or past `to`)
ask  { yr, b, $, y, d }: a free agent's ask this league year: b the first day's, $ today's, falling with the days unsigned
twa  [season, games]: a two-way man's games active this season (the 50-game limit, rotation.js twGames)
fl   1 = a filler: the end of the bench a team carries because it must (league.js makeFiller; made up: gn)
real 1 = his real contract from the data (contracts.js dealOnLoad)    rt  the team that drafted or traded for him on his rookie deal (the supermax)
ext  league year he signed an extension          ud  the draft he went undrafted in (the street after closeDraft)
nt   the team his number (num) is for (numbers.js fixNumbers: a man who joins keeps his number only if it's free there)
qtw  1 = his qualifying offer is a two-way deal (a two-way man's RFA: contracts.js seasonEndDeals)

-- health (C) --
inj { g: games out, k: 'sprained left ankle' }    rest 1 = sitting tonight (load management)

-- career (C) --
car [{ y, s: teamShort, gp, gs, min, pts, reb, ast, stl, blk, tov, fgm, fga, tpm, tpa, ftm, fta }]
aw  [{ y, k: 'MVP'|'ROY'|'DPOY'|'6MOY'|'MIP'|'FMVP'|'ALL1'|'ALL2'|'ALL3'|'AS'|'CHAMP' }]
```

## SeasonLine (C)

`{ gp, gs, min, pts, reb, oreb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, pm }` totals, per man id.

Box lines (Res.box, game.js toRes): every man on the roster has one. A man who didn't play has `min: 0`, zeros and
`dnp: 'cd'` (coach's decision) | `'inj'` | `'rest'` | `'tw'` (a two-way man not with the team), with `k` the reason
in words (the injury; 'G League', '50-game limit', 'not eligible for the playoffs'). `Res.ff`: the team that
forfeited (no one to play: 2-0; rosters are kept at 13+, so it shouldn't happen).

## Game (core)

```
{ d: dayIndex, h: 'BOS', a: 'NYK', k: 'div'|'conf'|'other',
  hs?: 112, as?: 104, ot?: 0..n,        // set once played
  bx?: boxIndex }                       // only the GM's team's games keep a box (F.box[bx]), last ~20
```

## Pick (core creates, B trades)

`{ y: draftYear, r: 1|2, o: originalTeam, t: ownerNow, n?: 1..60, pr: null | { top: N, rl?: 1 } , sw: null | { with: team } | { by: team } }`
`n` is set at the lottery (the overall pick). A protected pick that rolls over carries `rl: 1` (it rolls once, then
conveys). A swap: the holder's own first carries `sw.with` (the team it may swap with), the giver's `sw.by`.
A protected pick that conveys nothing rolls to the next year unprotected-by-one-step (core resolves at the lottery).
Stepien rule (B checks): a team may not be without a first in two consecutive future drafts.

## Playoffs (core)

```
po = { pi: { E: [...], W: [...] },   // play-in games: 7v8, 9v10, loser78 v winner910
       seeds: { E: [s1..s8], W: [...] },
       rounds: [[Series...], ...],    // round 0..3
       champ, fmvp }
Series = { hi: 'BOS', lo: 'MIA', g: [{ h, hs, as, ot }], wh: 0, wl: 0, done: winnerShort|null }
```
Home court 2-2-1-1-1: games 1, 2, 5, 7 at the higher seed.

## Seams: the functions core calls (names fixed; signatures fixed)

### C: sim (`nba/game.js`, `stats.js`, `injury.js`, `aging.js`, `awards.js`)

```
rotationOf(F, short) -> [{ i, st: bool, min: targetMinutes }]   // 8..10 men with minutes, starters first; honours team.rot/min, inj, rest
simGame(F, home, away, { seed, playoff?: bool, b2b?: { h: bool, a: bool } }) -> Res
Res = { hs, as, ot, box: { [short]: [{ i, min, pts, reb, oreb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, pm, st }] },
        q: [[h1,a1],[h2,a2],[h3,a3],[h4,a4],...OTs] }           // quarter scores
recordGame(F, game, res, { playoff?: bool })   // adds box lines to F.ss (or F.ps), and car on season end
rollInjuries(F, game, res)                     // honours F.noInj; returns [{ i, s, k, g }] for the wire
tickInjuries(F, days)                          // games-out countdown
restFor(F, short, game, b2b) -> [manId]        // load management sitting tonight (stars on the 2nd of a b2b, older men)
leaders(F, stat, n=10, { playoff }) -> [{ i, s, v }]   // per-game, qualified (58+ games as the NBA's 65-game rule scaled)
seasonAwards(F) -> { MVP, ROY, DPOY, '6MOY', MIP, ALL: [[5 ids],[5],[5]], ALLDEF?: [[5],[5]], ROOKIE?: [[5],[5]] }
finalsMvp(F, series) -> manId
ageLeague(F) -> { retired: [Man], news: [...] }    // offseason: ag+1, o toward pk, decline by group, retirements
// Moments seam (core moments.js uses it):
startGame(F, home, away, opts) -> G       // a game state that can stop; G is plain JSON (saved in F.pend while the moment is up), small, no F inside; G.hs / G.as = the score so far
playTo(G, secondsLeftInQ4, when?)         // sim until that much of the 4th (or OT) is left; when(G): stop only at a whistle where it's true (season.js momentSpot)
possession(G, short, outcome)             // apply one possession result: { pts: 0..4, by: manId, ast?: manId, kind: 'pnr'|'iso'|'read'|... , tov?: bool, t?: seconds } (a man with 6 fouls never takes it)
momentEnd(G, short, { sealed })           // the seconds after a moment: sealed (his team landed it and is ahead) = the other side's last look misses and the clock runs out; else a trip with <=5 s is a desperation shot; returns the trip
finishGame(G) -> Res                      // sim the rest, give the same Res as simGame
```

### B: cap (`nba/cap.js`, `contracts.js`, `market.js`, `trades.js`)

```
capOf(year), taxOf(year), apron1Of(year), apron2Of(year), minOf(ys, year), maxOf(ys, year), rookieScale(pick, year)
payroll(F, short, year = F.year) -> $M                 // incl. dead money and cap holds where they count
capSheet(F, short) -> { pay, cap, tax, a1, a2, room, over: 'under'|'cap'|'tax'|'a1'|'a2', bill }
dealOnLoad(F, man, short)                              // at setup, for every man on a roster: his real deal (or an estimate)
canSign(F, short, man, deal) -> { ok, via: 'room'|'mle'|'tmle'|'bae'|'min'|'bird'|'rookie', why }
signMan(F, short, man, deal)
rookieDeal(F, man, pick)                               // a drafted man's scale deal (1st) / 2nd-rounder deal; pick.n = overall pick 1..60, pick.r = round; deal starts season F.year + 1
seasonEndDeals(F)    // options decisions, years tick, expiring men to F.fa with Bird/RFA flags (start of 'resign')
resignOffer(F, man) -> deal | null                     // what he asks the GM's team for (his own team, Bird rights)
askOf(F, man) -> deal                                  // what a free agent asks on the open market { $, y, opt? }
cpuOffseason(F)      // the other 29 teams re-sign, sign FAs, fill to 13+ and cut to 15 (called at 'fa' end)
faDay(F, n)          // one free-agency round; returns news
offerSheet(F, man, deal) / matchSheet(F, short, man, yes)
cutMan(F, short, manId, { stretch }) -> dead money
legalRoster(F, short) -> { ok, why }                   // 15 standard max (13 min in season), 3 two-way
// trades
tradeValue(F, man | pick, forTeam)
checkTrade(F, deal) -> { ok, why }                     // deal = { a: 'BOS', b: 'NYK', ga: [ids], gb: [ids], pa: [pickIdx], pb: [pickIdx] }
cpuAnswer(F, deal) -> { yes, counter? }
doTrade(F, deal)
cpuDeadline(F, day) -> [news]                          // CPU-CPU deals before the deadline
```

## When core calls what (the order a season runs in)

- Setup: `buildTeams` -> `dealOnLoad(F, man, short)` for every rostered man. Two-way men too (B decides their pay).
- Each night (`season.js playDay`): for each game `restFor` (regular season only) -> `simGame` (or, for the GM's game with
  moments on, `startGame` -> `playTo(G, 24, momentSpot)` -> maybe a moment (F.pend: { ..., left: the real clock, per, spot:
  'off'|'def'|'ft', G }) -> `possession` -> `momentEnd` -> `finishGame`; the log row keeps row.mo for the final's line) -> `recordGame` ->
  `rollInjuries`. After the night: `tickInjuries(F, short)` for every team, then `cpuDeadline(F, day)` (B: return
  [] after `F.ddl`).
- Postseason nights: the same with `playoff: true`, no `restFor`.
- Finals over: `finalsMvp(F, series)`.
- `closeSeason`: `seasonAwards(F)`; then **core** writes each man's season line onto `man.car` (from F.ss / F.ps:
  `{ y, s, ...SeasonLine, po?: SeasonLine }`) and awards onto `man.aw`. C does not write `car`.
- Summer `resign` stop: `ageLeague(F)` first (it ages every man on a roster and in F.fa by one, the just-drafted
  included: core stores a drafted man a year younger so he comes out at his rookie-season age), then
  `seasonEndDeals(F)` (returns the men whose deals ended; core shows the GM's own with `resignOffer`).
- `fa` stop: GM signs with `askOf` + `canSign` + `signMan`; each "next day" is `faDay(F, n)`; leaving the stop runs
  `cpuOffseason(F)` (the other 29 teams' summer: re-sign, sign, trade if you like, fill to 13-15).
- `camp` -> new season: core cuts CPU rosters past 15 with `cutMan` and fills short ones with made-up men, then calls
  `dealOnLoad` for any man with no `$`. The GM's roster must pass `legalRoster(F, F.team, { season: true })`.
- `F.year++` happens in `newSeason`, after all of the above. `dead` money years are ticked by core at that point
  (`{ n, $, y }`, y-1, dropped at 0): B may instead own that; say so.

## Proposed

### Core, 2026-11-19 (for B)

- `canSign`: the offseason roster limit is 21 (standard + Exhibit 10 men together), 15 standard from opening night; the
  draft lands first-rounders on the roster before free agency, so a full 15 in July must still be able to sign.
- The street: core keeps the best 55 unsigned men at each new season (offseason.js pruneStreet) and drops the rest;
  B's market should treat F.fa as the whole pool.
- Career rows are core's (offseason.js carRow, CAR_K): `{ y, s, gp, min, pts, reb, ast, stl, blk, fgm, fga, tpm, po? }`,
  the oldest folded into one `{ y, y2, s: '' }` row past six seasons. Saves pack men as rows (index.js).

(B and C: add requests here)

### From B (cap, branch `frnba-cap`)

**seams.js, B's half** (every name below is exported as named; signatures as in the table above unless noted):
```
export { capOf, taxOf, apron1Of, apron2Of, minOf, maxOf, rookieScale, payroll, capSheet, assessTax } from './cap'
export { dealOnLoad, canSign, signMan, rookieDeal, seasonEndDeals, resignOffer, cutMan, legalRoster } from './contracts'
export { askOf, cpuOffseason, faDay, offerSheet, matchSheet } from './market'
export { tradeValue, checkTrade, cpuAnswer, doTrade, cpuDeadline } from './trades'
```
- `rookieScale(pick, year)` returns the four seasons' salaries `[y1, y2, y3, y4]` (the stub returned one number).
- `rookieDeal(F, man, { n, r })` also decides a second-rounder's deal (two-way when the roster's full). Please call it
  for every pick, including the two-way branch in `closeDraft` (it sets `$`, `y`, `sc`, `tw` itself). It sets the
  draftee's `ys` to -1 on draft night, so the sim's `ageLeague` (which adds a year of service) brings him to 0 for his
  rookie season; a man core makes a two-way deal for by hand would start his rookie season at 1.
- `seasonEndDeals(F)` returns the men whose deals ended (each in F.fa with `was` = `fr` = his team) and the array
  carries `.news` (declined player options) for the wire.
- `faDay(F, day)`: core's day number (1, 2, 3...); each call plays the rounds up to that day. Free agency is 6
  days (`FA_DAYS`); `cpuOffseason` plays any left, then the summer's trades, the late signings, camp fills and
  extensions. Both return news items and never write F.news themselves.
- `doTrade(F, deal)` returns `{ line, news: [item] }` and does not write F.news (the screen's addNews is right).
  `cpuDeadline` and `cpuOffseason` return their trades' items. `cpuAnswer` returns `{ yes, text, why, counter? }`;
  a counter is a deal of the same shape, ready for `checkTrade` / `cpuAnswer` / `doTrade`.
- `legalRoster(F, s, { season: true })` holds the GM to the CBA's 14-man minimum (the stub said 13).

**New calls core should make**
- `assessTax(F)` once, when the regular season ends (before the play-in): each team over the tax line pays its bill
  and the year goes on `team.txh` (the repeater rule reads it); `F.taxl = { y, paid: [{ s, pay, over, bill,
  repeater }], share, floor: [{ s, $ }] }` for a wire item or the history screen (`floor`: teams under the 90%
  salary floor, who pay the shortfall to their players).
- `cpuFill(F)` (market.js) after `cpuDeadline` each night is optional: a league team a trade left at 13 signs a man
  off the street.

**Dead money**: entries are `{ n, $, y, from, to }`; `$` counts in every season from `from` through `to`, and `y`
is the seasons left through `to`, so core's `y - 1` at `newSeason` agrees with it. Keep that tick; B prunes spent
entries at `seasonEndDeals`.

**Fields B adds** (all small; a save from before them loads with none)
- Man: `bird` (Bird years), `sgn`/`sgd` (league year and day he signed), `rt` (the team that drafted or traded for
  him on his rookie deal, for the supermax), `mh` (one-year veteran minimum), `ng` (non-guaranteed), `ext` (year he
  extended), `tx` ([from team, league year, day, paid] after a trade); while a free agent: `fr`/`was`, `hy` (hold
  year), `$l` (last salary), `rsl`, `qo`, `rn` (renounced), `ask`, `wv` (waived that year).
- Team: `exc` (`{ yr, mk, mle, bae, baeY, hc, room }`: exceptions used and hard caps), `txh` (years it paid tax).
- F: `sed` (the season whose deals have ticked over: `capYear(F)` is F.year + 1 from then), `fad`/`fay` (free
  agency's day and league year), `fao` (the GM's offers for the next FA day: `placeOffer`), `rfq` (offer sheets the
  GM's restricted free agents signed: answer with `matchSheet`; an unanswered one is matched next day), `trl`
  (trade log), `trc` (calls the GM has made, for `proposeTrade`), `trn` (trades made), `dlo`, `taxl`.

**For the screens (optional, all in B's files)**
- `capYear(F)`: the season the books are on (next season's from `seasonEndDeals` on). Show the sheet for it.
- Options: `optionsDue(F, F.team)` before the `resign` stop; set `man.optd = 1 | 0` for each team option the GM
  decides (the AI decides any left; player options are the player's call).
- Renounce a cap hold: `renounce(F, F.team, id)`. Extensions: `extensionOk` / `extensionAsk` / `extendMan`.
- Cuts: `cutCost(F, man, { stretch })` before `cutMan(F, s, id, { stretch: true })`.
- Trades: `proposeTrade(F, deal)` (counts the GM's turned-down calls and offers a counter), `gauge(F, deal)` for the
  value meter, `whyNot(F, s, man)` for a man who can't be traded now, `tradeWindow(F)`. A deal's picks may carry a
  protection (`{ i, top: N }`) or be a swap (`{ swap: year }`); core's draft settles both as it does now.
- Labels: `OVER_TEXT` (cap.js), `RIGHTS_TEXT`, `SIT_TEXT` (contracts.js), `EXC_TEXT` (cap.js).

### Money (round 6, 2026-11-24)

- `payroll(F, s, year)` is salaries and dead money: what the tax, the aprons, the hard caps and the owner's ceiling
  read. Cap holds and the empty-roster charges count against cap room only: `capPayroll(F, s, year)` (cap.js), and
  on the sheet `capSheet().capPay` / `.hold` (`.pay` is salaries; `.room` counts the holds; `.over` reads salaries,
  'cap' when only the holds take the team over the cap).
- `spendLines(F, s, year) -> { sit, keep, add }` (contracts.js): the payroll an AI front office runs to, by its
  situation and its ownership (`ownerTier`); `strengthRank(F, s)`. `taxTolerance` / `lineOf` are kept for old callers.
- Team: `a2h: [year]` the seasons it finished past the second apron (cap.js assessTax).
- trades.js: `sellDown(F)` is the league's sell-down pass (the first day of free agency, the end of the
  summer, the deadline's last two days; `salaryDumps` is no longer called); `shedTo(F, s, target)`; a league team's unused non-taxpayer mid-level can
  take a contract in by trade (sideRules `mle`); cap room in a trade counts the summer's holds, the aprons don't.
- market.js: `lateOffer` (the GM) and the league's late signings follow one rule (lateDeal / lateBest); the wire has
  a `SIGN-AND-TRADE` tag (k 'sign').
- contracts.js: `marketChanged()` bumps the market cache's version (call it if a man's rating changes inside one
  offseason stop without a man joining or leaving the league); `marketOf` no longer reads the clock.

### C (sim), 2026-11-19

1. **seams.js:** the C half can be one line, `export { ...the ten names..., startGame, playTo, possession, finishGame } from './sim'`. `nba/sim.js` re-exports every C seam (plus extras: `allStars`, `seriesMvp`, `updateRecords`, `outText`, `prospect`, `planRotation`, `clutchTime`). Checked on this branch: `scripts/franchise2/nba-sim.mjs` runs 3 seasons clean with it.
2. **Series MVPs:** pass the series to `recordGame(F, g, res, { playoff: true, series: g.ser })`. It then keeps that series' own lines in `series.st`, so `finalsMvp(F, S)` and `seriesMvp(F, S)` (the Bird and Magic trophies for the conference finals) read the series itself, not the whole postseason.
3. **Defensive moments:** `finishMoment` calls `possession(G, F.team, { pts: 0 })` before the opponent's possession when `out.pts` is 0 on a stop. That plays an extra missed shot by the GM's team. On defense, call only `possession(G, opp, { pts: out.them, by? })`.
4. **Moment kinds:** a 2-point moment with kind `clutch-shot`, `iso`, `half-court` or `read` is booked as a jumper. Kind `pnr`, `post-up` or anything else is booked at the rim. 3 or 4 points is a three (4 is an and-one).
5. **SeasonLine extras:** C adds `cp` (clutch points), `hi hr ha h3 hs hb` (season highs), `dd td g40`, and `g20 g15` (games of 20+ and 15-19 minutes, which the 65-game rule counts). Core can copy them onto `car` or leave them out.
6. **Awards:** `seasonAwards` returns `CLUTCH` too, plus `votes` (the top 5 for each award). Core writes `aw`. C never does, so the award keys come from core: suggested `CLUTCH`, `DEF1`/`DEF2`, `RK1`/`RK2`, `ECF`/`WCF`.
7. **Records:** `updateRecords(F)` at `closeSeason` writes F.rec (single game, season and career marks since the save began) and returns news. `REAL_RECORDS` holds the NBA's own marks for copy.
8. **Injuries:** `tickInjuries(F, short)` heals only a man who missed a game that night (`rollInjuries` marks him `inj.m`), so `inj.g` counts games. Call `tickInjuries(F, days)` with a number over the summer (130 is about right): an ACL torn in March then runs into the next season.
9. **Ceilings:** `league.js peakFor` (room x 1.1-2.7 a year) inflated the league in C's 10-season runs (88+ men went 29 to 47). `aging.js seedPotential` (room x 0.6-2.0) and `prospect(R, { rank })` for the class hold it level (88+ men: 29 at the start, 27-31 on average). Please use them, or match their numbers.
10. **Playoffs:** pass `{ playoff: true }` to `rotationOf` for the screen too. Playoff rotations shorten to eight, and stars play 38-40.
