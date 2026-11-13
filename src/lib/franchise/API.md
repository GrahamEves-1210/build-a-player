# FRANCHISE engine API

`import * as FR from '../../lib/franchise'` (lazy-load it: `import('../../lib/franchise')`; Home must not pull it in).
Pure JS, seeded, no React, no DOM (only `save.js` touches `localStorage`, behind a guard).

Status marks: **STUB** works for real · **STUB** returns correctly shaped placeholder data, logic still to come.
The list at the bottom (`Status`) is the single place to look for what is real today.

## 0. How to hold it

- The whole league is ONE plain JSON-serializable object, `F`. Keep it in React state.
- Every **action** is `(F, ...args) => F2`. `F2` is a NEW top-level object (so `setState` re-renders) wrapped around
  the same league, which is changed in place. So: never keep the old `F` around expecting it to be unchanged, never
  keep references to nested objects across an action, and memo on `F` itself (or `F.rev`, which goes up by one on
  every action that changed something).
- `F2.flash` is the answer to the last action: `null`, or `{ ok: true, msg? , ...extra }`, or
  `{ ok: false, code, msg }` when the action was refused (the league is untouched; `msg` is a sentence fit for a
  toast, e.g. "That puts the Chiefs $4.2M over the cap.").
- Every **selector** is `(F, ...args) => data`, pure, cheap enough to call on render (memo the heavy tables on `F`).
- Never read `F.players` etc. directly in components when a selector exists; shapes inside `F` are compact and will
  change. The selectors are the contract.
- The user is the GENERAL MANAGER. He is `F.gm.name` everywhere; text never says "You", and never calls him coach.
- Money is in $M (`12.5` = $12.5M). `FR.moneyText(12.5)` → `"$12.5M"`.
- Ratings are the game's own 0-11 trait grades; `grade` fields are the letters (F … S); `ovr` is the position's own
  OVR formula (utils/simulation.js).

### Shapes used everywhere

```
TeamRef   { short, name, city, nick, color, color2, ink, logo, conf, div }      // ink: readable text colour on `color`
PlayerRow { id, name, short, pos, slot, num, age, exp, ovr, grade, arch,        // pos qb rb wr te ol dl lb db k · slot QB RB WR TE LT LG C RG RT EDGE DT LB CB S K
            dev, devName,                                                        // 0-3 / NORMAL STAR SUPERSTAR ELITE; null while hidden (a rookie who hasn't played)
            team, photo, initials, skin, built, real, gen,                       // photo: a headshot id for nflHeadshot(id), or null → show initials on `skin`
            salary, yrs, guar, rookie,                                           // contract: $M a year, years left, guaranteed left, rookie deal
            mood, moodWord, drives,                                              // 0-100, 'Happy' …, ['MONEY','RING']
            inj, wear,                                                           // inj: null | { wk, what, ir, status: 'OUT' | 'IR' | 'QUESTIONABLE' } · wear 0-100
            starter, depth,                                                      // depth: 1 = first at his slot
            line,                                                                // this season in one line: "3,412 yds, 24 TD, 9 INT"
            xp, pts, flags }                                                     // upgrade points to spend; flags: { hold, wantsOut, block, tag, questionable }
CoachRow  { id, name, role, roleName, team, age, real, placeholder, built, gen,  // role HC OC DC
            ratings: [{ key, label, short, val, grade }],                        // the five: talentDev offPlaycalling defPlaycalling culture situational
            ovr, grade, salary, yrs, record: 'W-L' | null, from }                // from (a built coach): { rating: { name, team } }
```

## 1. Creation, saves, settings

| function | what |
|---|---|
| `createFranchise({ team, builds, gmName, coach, settings, seed })` → `F` | **DONE** A new league. `team`: NFL short. `builds`: `[{ pos, build, name?, number?, spot?, photo? }]`, Squad Builder's slot format works as is (`build` = `{ trait: { val, photo, ... } }`; a DL/DB/OL build's spot comes from its Size chip's `subpos`, or `spot`). Capped by `BUILD_CAPS`. Builds are 22-year-old rookies on first-round rookie deals, STAR development, starting from day one. `coach` (optional): `{ name, build }`, a BUILT head coach; `build` is five slots keyed by rating (or an array of slots), each `{ type, val, qbFull, team }`. He replaces the team's real head coach, who goes to the coaching market. `settings`: any of `DEFAULT_SETTINGS`. `seed`: any string; same seed + same choices = same league. |
| `BUILD_CAPS` | **DONE** `{ qb:1, rb:2, wr:3, te:2, db:4, dl:4, lb:3, ol:5, k:1 }` (Squad Builder's caps, plus one kicker). |
| `saveFranchise(F, slot)` → `{ ok, bytes, error? }` | **DONE** slot 0-2, key `bap_franchise_v1_<slot>`. Packed and compressed. |
| `loadFranchise(slot)` → `F \| null` | **DONE** `null` for an empty slot. A save from a newer engine or a broken one comes back as `{ broken: true, reason }` (never throws). |
| `listSlots()` → `[{ slot, empty, team, gm, year, week, phase, record, rings, updatedAt, bytes }]` | **DONE** |
| `deleteSlot(slot)` | **DONE** |
| `packFranchise(F)` → string · `unpackFranchise(string)` → `F` | **DONE** what a save is made of (cloud save later). |
| `settingsOf(F)` → `{ moments, calls, injuries, cap, autoUpgrade, autoDepth, autoRoster, tradeAI, firing }` | **DONE** |
| `setSetting(F, key, value)` → `F` | **DONE** `moments` is the PLAY THE MOMENTS toggle (stored in the save). |
| `renamePlayer(F, pid, name)` · `setNumber(F, pid, n)` → `F` | **STUB** builds only. |
| `LIMITS` | **DONE** `{ ROSTER_MAX: 46, ROSTER_MIN: 40, CAMP_MAX: 62, MIN_AT: { QB:2, RB:3, WR:5, TE:2, OL:7, EDGE:3, DT:3, LB:4, CB:3, S:3, K:1 } }` |

## 2. Selectors

### Hub and the week
- `hub(F)` **STUB** →
  ```
  { phase: 'regular' | 'playoffs' | 'offseason', year, week, weekLabel: 'WEEK 7' | 'WILD CARD' | 'OFFSEASON',
    team: TeamRef, gm: { name, security, securityWord, record: '21-13', rings },
    record: { w, l, t, text: '5-2' }, standing: '2nd in the AFC West', seed: 5 | null,
    next: null | { week, label, opp: TeamRef, home: bool, oppRecord: '4-3', bye: false, kind: 'regular' | 'wc' | 'div' | 'conf' | 'sb', eliminated: false },
    bye: bool,                                   // this is the team's bye week: PLAY WEEK sims the league
    tasks: Task[],                               // THIS WEEK (same as weekTasks)
    primary: { action: 'play' | 'advance' | 'stage', label: 'PLAY WEEK 7' },
    lastGame: null | { week, opp: TeamRef, home, won, tied, us, them, ot },
    headlines: News[] (5), cap: { space, payroll, cap }, owner: OwnerView, stage: null | { id, name } }
  ```
- `weekTasks(F)` **STUB** → `Task[]`: `{ id, kind, title, detail, done, count? }`. kinds: `gameplan` `practice` `office`
  (one per open front-office item; `id` is the item id) `upgrades` (points to spend) `injury` (a starter is out: check
  the depth chart) `scout` (scouting points to spend) `trade` (an offer is waiting) `roster` (the roster is illegal:
  must be fixed or the staff fixes it). Every one is optional; whatever is open when the week is played is done by the
  staff. `title` is a label ("GAMEPLAN"), `detail` a fact ("vs DEN: 3rd pass D, 27th run D").
- `pregame(F)` **STUB** → the user's next game before it starts:
  ```
  { week, label, kind, home: TeamRef, away: TeamRef, userHome, records: { home, away }, venue, weather: { tag, word },
    units: { home: Units, away: Units },         // Units: { passOff, rushOff, passDef, rushDef, ptsFor, ptsAgainst }: each { rank, val } (val per game)
    injuries: { home: [{ id, name, slot, status, wk }], away: [...] },
    gameplan: { off: { id, label }, def: { id, label } }, moments: bool, calls: bool,
    keys: [string] (three lines of what to watch), line: '-3.5' (spread, home side), superBowl: bool }
  ```
- `scoutingReport(F, opp = next opponent)` **STUB** → what they do well and badly, for the gameplan:
  `{ opp: TeamRef, record, units: Units, strengths: [text], weaknesses: [text], stars: PlayerRow[] (3), staff: { hc, oc, dc } }`.
- `lastWeek(F)` **STUB** → the recap after a week is played (also at `F.last`):
  ```
  { week, label, user: null | { game: GameRow, box: BoxScore, potg: { player: PlayerRow, line }, xp: [{ id, name, xp, pts }], moments: [{ n, game, title, player, win, text }] },
    injuries: [{ id, name, team, slot, what, wk, user: bool }], scores: GameRow[], headlines: News[], awards: { off, def, st } | null (players of the week), standing }
  ```

### Team
- `roster(F, team = F.team)` **DONE** → `PlayerRow[]` (sorted by slot order, then depth).
- `depthChart(F, team = F.team)` **DONE** → `{ auto: bool, slots: [{ slot, name, side: 'off' | 'def' | 'st', starters: n, players: PlayerRow[] }] }`.
- `playerCard(F, pid)` **STUB** →
  ```
  { ...PlayerRow, ht, wt, bodyText: `6'3" · 225`, college, draft: '2027 · Round 1, Pick 9 (KC)' | 'Undrafted' | null,
    traits: [{ key, label, short, val, grade, cost: points to raise it | null, fading: bool }],
    devText, contract: { salary, yrs, guar, rookie, option: 'available' | 'exercised' | null, tag, capHit, cut: { dead, saves }, ask: { years, perYear } | null },
    moodFactors: [{ text, d }],                 // why he feels the way he does: "+ Starting", "- Paid $6.1M under his value"
    stats: { season: StatLine, career: StatLine, byYear: [{ year, team, ...StatLine }] },
    awards: [{ year, name }], value: trade value (points), canUpgrade, mine: bool, onBlock: bool }
  ```
  `StatLine`: only the keys his position has, already rounded: QB `g cmp att pct yds td int rtg sk rushYds rushTD` · RB `g att yds ypc td rec recYds recTD fum` · WR/TE `g tgt rec yds ypr td long` · OL `g gs sacksAllowed pancakes` · DL/LB/DB `g tkl sack tfl int pd ff dTD` · K `g fgm fga pct long xpm xpa pts`.
- `capSheet(F, team = F.team)` **DONE** → `{ cap, payroll, dead, space, rows: [{ ...PlayerRow, capHit, pctOfCap, cut: { dead, saves } }] (by cap hit), next: [{ year, committed, players }] (three seasons), on: bool }`.
- `teamNeeds(F, team = F.team)` **STUB** → `[{ slot, level: 0-3, word: 'SET' | 'DEPTH' | 'NEED' | 'URGENT', starter: PlayerRow | null, ovr, rank (league rank at the spot) }]`, most urgent first.
- `injuryReport(F, team = F.team)` **STUB** → `[{ ...PlayerRow, what, wk, status }]`.
- `teamInfo(F, short)` **STUB** → `{ ...TeamRef, record, standing, seed, ratings: { off, def, ovr, offRank, defRank }, units: Units, staff: StaffView, strategy: 'contend' | 'middle' | 'rebuild', capSpace, picks: Pick[], user: bool }`.
- `teams(F)` **DONE** → `TeamRef[]` + `{ record, user }`.
- `staff(F, team = F.team)` **DONE** → `StaffView`: `{ hc: CoachRow, oc: CoachRow, dc: CoachRow, scout: ScoutRow | null, budget: { total, used, left }, playcall: { off, def } (the play-caller's effective 0-11 on each side), effects: [text] }`.
- `coachCard(F, coachId)` **STUB** → `{ ...CoachRow, history: [{ year, team, role, w, l, note }], effects: [text], ask: { years, salary }, interest: 0-100 | null (in the user's job, when he is on the market) }`.

### League
- `schedule(F, team = F.team)` **DONE** → `[{ week, label, bye, opp: TeamRef | null, home, played, result: null | { won, tied, us, them, ot }, gameId }]` (18 rows, then any playoff games).
- `weekGames(F, week = F.week)` **DONE** → `GameRow[]`: `{ id, week, home: TeamRef, away: TeamRef, played, hs, as, ot, user: bool, top: [text] (three leaders, once played) }`.
- `boxScore(F, gameId)` **STUB** → `BoxScore | null` (kept for the latest week's games and every user game of the season).
  ```
  BoxScore { id, week, home: TeamBox, away: TeamBox, ot, scoring: [{ q, clock, team, text, hs, as }] }
  TeamBox  { team: TeamRef, score, quarters: [n, n, n, n, (ot)], totals: { plays, yds, passYds, rushYds, firstDowns, third: '5-13', fourth: '1-2', to, sacks, pen, penYds, top: '31:04' },
             passing: [{ id, name, built, cmp, att, yds, td, int, sk, rtg }], rushing: [{ id, name, built, att, yds, td, long }],
             receiving: [{ id, name, built, tgt, rec, yds, td, long }], defense: [{ id, name, built, tkl, sack, tfl, int, pd, ff }],
             kicking: [{ id, name, built, fgm, fga, long, xpm, xpa, pts }] }
  ```
- `standings(F)` **STUB** → `{ divisions: [{ name, conf, teams: StandRow[] }], conferences: { AFC: StandRow[], NFC: StandRow[] } }`,
  `StandRow`: `{ team: TeamRef, w, l, t, pct, pf, pa, diff, div: '3-1', conf: '6-3', home: '4-1', away: '2-2', streak: 'W3', last5: '4-1', seed: 1-7 | null, clinch: 'x' | 'y' | 'z' | 'e' | null, user }` (x playoffs, y division, z first seed, e eliminated).
- `playoffPicture(F)` **STUB** → `{ AFC: { seeds: StandRow[7], hunt: StandRow[] }, NFC: {...}, bracket: null | { rounds: [{ id, name, games: [{ id, home: TeamRef, away: TeamRef, hs, as, played, winner, seeds: [h, a] }] }], champion: TeamRef | null } }`.
- `leaders(F, n = 10)` **STUB** → `{ passYds, passTD, rating, rushYds, rushTD, rec, recYds, recTD, scrimmage, sacks, tackles, ints, tfl, ff, fgm, points }`, each `[{ rank, player: PlayerRow, val, text }]`.
- `teamStats(F)` **STUB** → `[{ team: TeamRef, g, ptsFor, ptsAgainst, yds, passYds, rushYds, ydsAllowed, passYdsAllowed, rushYdsAllowed, to, takeaways, sacks, ranks: { ... } }]` (per game).
- `awardRaces(F)` **STUB** → `{ MVP, OPOY, DPOY, OROY, DROY, COY, PROTECTOR }`, each `[{ rank, player: PlayerRow | null, coach: CoachRow | null, team: TeamRef, line, share: 0-1 }]` (top five).
- `news(F, n = 30)` **STUB** → `News[]`: `{ id, year, week, kind, head, body?, team?: TeamRef, pid? }`. kinds: `game award injury trade signing draft owner league milestone staff`.
- `transactions(F, n = 60, team = null)` **STUB** → `[{ id, year, week, type, team: TeamRef, text, pid? }]`. types: `sign release trade draft ir activate extend tag retire hire fire`.
- `powerRankings(F)` **STUB** → `[{ rank, prev, move, team: TeamRef, record, blurb, rating }]` (32).
- `history(F)` **STUB** →
  ```
  { seasons: [{ year, champion: TeamRef, runnerUp: TeamRef, score: '27-24', awards: { MVP: { name, team, line }, OPOY, DPOY, OROY, DROY, COY, PROTECTOR },
               allPro: [{ slot, name, team }], user: { team, record, finish: 'Lost Divisional Round', seed } }],
    records: { season: [{ key, label, val, name, team, year }], game: [...], team: [...] },
    gm: { name, seasons, record, playoffs: 'W-L', rings, titles: [year], security, legacy: 0-100, legacyWord, résumé: [text] },
    hall: [{ name, pos, years: '2026-2038', line, team }] }
  ```
- `ownerView(F)` **STUB** → `OwnerView`: `{ goals: [{ id, text, done: bool | null, progress: text, weight }], security: 0-100, word: 'SECURE' | 'STEADY' | 'WARM SEAT' | 'HOT SEAT', verdict: text | null, floor: 20 }`.

### Trades, free agents (in season and offseason)
- `tradeBlock(F)` **STUB** → `{ mine: PlayerRow[], league: [{ ...PlayerRow, asking: text }], offers: Offer[] (CPU offers waiting), open: bool (false after the deadline), deadlineWeek: 9 }`.
- `tradeAssets(F, team)` **STUB** → `{ players: [{ ...PlayerRow, value }], picks: [{ key, year, round, orig: TeamRef, value, text: '2027 Round 2 (DEN)' }] }`.
- `tradeVerdict(F, offer)` **STUB** → what the other GM says before anything is sent: `{ ok: bool, give, get (value both ways), gap, answer: text, capOk, rosterOk, counter: Offer | null }`.
  `Offer`: `{ id?, from: short, to: short, give: { players: [pid], picks: [key] }, get: { players: [pid], picks: [key] } }` (`give` leaves `from`).
- `freeAgents(F, { slot, n } = {})` **STUB** → `[{ ...PlayerRow, ask: { years, perYear, guaranteed }, interest: n teams, fit: 0-100 }]`.

## 3. In-season actions

- `setGameplan(F, { off, def })` **STUB** ids from `GAMEPLANS.off` / `GAMEPLANS.def`: each `{ id, label, text, good: 'against a weak pass rush' }`.
  Offense: `balanced` `air` (throw to win) `ground` (run to win) `quick` (quick game, beats the rush) `shots` (take the top off).
  Defense: `balanced` `stopRun` `rush` (bring pressure) `cover` (take away the pass) `ball` (go for the ball).
- `setPractice(F, { intensity, focus })` **STUB** `intensity`: `full` | `half` | `walk` (`PRACTICE` has the labels and the trade-off numbers); `focus`: up to three player ids.
- `setDepth(F, slot, [pid, ...])` **DONE** hands the chart to the user (turns `autoDepth` off). `autoDepthChart(F)` **DONE** staff re-sets it now. `setSetting(F, 'autoDepth', true)` hands it back for good.
- `officeItems(F)` **STUB** (selector) → `[{ id, kind, title, body, who: PlayerRow | CoachRow | null, options: [{ id, label, text (what it does, plainly) }], delegate: id of the option the staff would take }]`.
  kinds: `role` `contract` `trade-offer` `questionable` `press` `mentor` `holdout` `staff`.
- `resolveOffice(F, itemId, optionId | 'delegate')` **STUB**
- `upgradeTrait(F, pid, trait)` **STUB** spends his points (cost on `playerCard.traits[].cost`). `autoUpgrade(F, pid | null)` **STUB** staff spends for one man or everyone.
- `proposeTrade(F, offer)` **STUB** → `flash: { ok, accepted, answer }`. `answerOffer(F, offerId, accept)` **STUB**. `setBlock(F, pid, on)` **STUB**. `shopPlayer(F, pid)` **STUB** → `flash.offers: Offer[]` (what the league would give).
- `releasePlayer(F, pid)` **STUB** · `signFreeAgent(F, pid, { years, perYear } = his ask)` **STUB** · `moveToIR(F, pid)` / `activate(F, pid)` **STUB** · `extendPlayer(F, pid, { years, perYear, guaranteed })` **STUB** (in season: a contract-year player who asked to talk).
- `scoutProspect(F, prospectId, points = 1)` **STUB** in-season scouting points (see the draft).
- `delegateWeek(F)` **STUB** the staff does everything still open this week (not the game).

## 4. The game (the user's game day)

One live game at a time, in `F.game` (it is saved with the franchise, so a reload picks the game up where it stopped).

| function | what |
|---|---|
| `startGame(F, { mode })` → `F` | **STUB** `mode`: `'moments'` (stops at moments and coach's calls, per the save's toggles), `'watch'` (no stops: every moment rolled from ratings, but the play log is kept to play back), `'sim'` (straight to the final). Refused (`flash.code 'bye'`) on a bye or when eliminated. |
| `stepGame(F)` → `F` | **STUB** advances ONE play (for a screen that paces the game itself). Stops are raised exactly as in `nextStop`. |
| `nextStop(F)` → `F` | **STUB** runs the sim to the next stop. Read it at `gameView(F).stop`. The last stop is always `kind: 'final'`. |
| `resolveStop(F, result)` → `F` | **STUB** a moment: `{ win, score, raw? }` from the mini game (`hit` is accepted for `win`), or `'sim'` / `null` (SIM THIS ONE: rolled from the player's ratings by the same code that rolls it when moments are off). A call: the option id (`'go'`) or `{ choice }`, or `'sim'` (the staff's pick). The play is added to the log with its text written for the result; call `nextStop` / `stepGame` to carry on. |
| `skipGame(F)` → `F` | **STUB** the red SKIP bar: every stop left is rolled, straight to the final. |
| `finishGame(F)` → `F` | **STUB** books the game, plays the rest of the league's week, advances the week. The recap is `lastWeek(F)`. Only valid once the stop is `final`. |
| `gameView(F)` → `GameView \| null` | **STUB** (selector) |
| `gameCast(F)` | **STUB** → `null` for now: run MgStage with `cast = null`. |

```
GameView { id, week, label, kind, superBowl, mode, status: 'live' | 'stop' | 'final',
           home: TeamRef, away: TeamRef, userHome, us: short, them: short,
           score: { us, them, home, away }, quarters: { home: [..], away: [..] },
           q (1-4, 5 = OT), clock (seconds left in the quarter), clockText, poss: short, down, dist, spot (0-100 from the offense's own goal), spotText: 'KC 34',
           timeouts: { home, away }, weather: { tag, word },
           log: Play[], drives: [{ n, team, startText, plays, yds, time, result }],
           stop: Stop | null, stops: [{ n, game, title, player: { id, name }, win, text }], calls: [{ type, choice, worked, text }],
           box: BoxScore, winProb: 0-1 (the user's side) }
Play     { i, q, clock, team (short with the ball), down, dist, spot, kind, text, yds, pts, by (short that scored), drive, driveStart, moment: bool,
           score: [home, away] }
         // kind: run pass incomplete sack scramble int fumble punt fg fgmiss td xp xpmiss two kickoff return kneel spike penalty safety downs end
```

### The stop contract

```
Stop =
  { kind: 'moment', id, n,                    // n: 1-based, this game's nth stop
    game,                                     // a lib/minigames.js GAMES id
    title,                                    // GAMES[game].title
    side: 'off' | 'def' | 'st',
    player: { id, name, short, num, pos, slot, team, photo, initials, skin, built, ovr, grade,
              v,                              // the 0-11 value the mini game runs at (traitValue of his own ratings)
              traits: [{ key, label, short, val, grade }],   // the ratings that game reads
              build,                          // his ratings in build format ({ trait: { val } }) for traitValue / MgStage
              kick: { power, accuracy, clutch } | null, dist: yards (a kick) | null, arm },
    situation: { q, clock, clockText, down, dist, spot, spotText, us, them, usShort, themShort, poss,
                 text,                        // one broadcast sentence: "Chiefs down 4, 1:52 left in the fourth. 3rd and 8 at the Denver 42."
                 short },                     // "Q4 1:52 · 3RD & 8 · DEN 42"
    stakes,                                   // one short line: "Convert and the drive lives."
    win, loss,                                // what each result does, in plain words
    odds,                                     // the chance the rating roll makes it (what SIM THIS ONE uses)
    leverage,                                 // 0-1, how much of the game hangs on it
    mg }                                      // ready for <MgStage {...stop.mg} onDone=…>: { game, v, arm, kick, seed, sport: 'nfl', pos, team, opp, home: 'team' | 'opp', superBowl, situation, weather, cast: null }
| { kind: 'call', id, n, type: 'fourth-down' | 'two-point',
    situation, setup (one sentence),
    options: [{ id: 'go' | 'fg' | 'punt' | 'two' | 'one', label, odds (0-1 that it works), oddsText: '54%', note (what it is worth), staff: bool (what the staff would call) }] }
| { kind: 'final', result: { won, tied, us, them, ot, text }, potg: { player: PlayerRow, line } }
```

Rules the engine keeps (DESIGN §5): 4-6 moments in a game with moments on; never the same mini game twice in a game;
the game is always one the situation really calls for and is taken by the man at that spot on the depth chart; variety
from week to week (the engine remembers what it used lately); at most two coach's calls a game; a late moment in a
close game decides it. With `moments` off (or mode `watch` / `sim`) the same plays are rolled from ratings.

Which game fits which situation (the engine's table, `MOMENT_FITS`): 3rd and 7+ → `third-long` (QB) `pass-pro` (OL) `release` (WR) ·
3rd and 3-6 → `hot-read` `audible` (QB) `catch` (WR/TE) · a pass under pressure → `escape` (QB) · a shot play → `bomb` (QB) ·
4th/3rd and 1 → `sneak` (QB) `gap` (RB) `seal` (TE/OL) · 4th and goal → `goal-line` · red zone throw → `catch` ·
catch and run → `juke-wr` `juke-te` · a run into space → `juke` (RB) · trailing inside two minutes → `two-minute` (QB) ·
their 3rd and long → `pass-rush` (DL) `jump-route` (DB) `zone-drop` (LB) · their short yardage / goal line → `run-stuff` (DL) `hit-stick` (LB) ·
their back in the open → `tackle-angle` (DB) · a kickoff that matters → `kick-return` · a late kick to tie or win → `game-winner` (K) ·
behind late, no way to stop the clock → `onside` (K).

## 5. Advancing

- `advanceWeek(F)` **STUB** plays the week for the whole league with the user's game simmed from ratings (also the path on a bye, and when the team is out of the playoffs). Open tasks go to the staff.
- `simTo(F, { week } | 'playoffs' | 'offseason')` **STUB** repeats `advanceWeek`.
- After the Super Bowl `F.phase` is `'offseason'` and `F.stage` is `'review'`.

## 6. Offseason

`offseason(F)` **STUB** → `{ year (the season just played), stage: { id, name, n, of }, stages: [{ id, name, done, current }], view }` where `view` is that stage's selector result below.
`advanceStage(F)` **STUB** → the staff does whatever is still open in this stage, then the next one starts. After `cuts` the new season starts (`F.phase 'regular'`, week 1).

1. **review** `seasonReview(F)` **STUB** → `{ year, champion: TeamRef, user: { record, finish, seed }, awards: { MVP, OPOY, DPOY, OROY, DROY, COY, PROTECTOR }: { player | coach, team, line }, allPro: [{ slot, player: PlayerRow, team }], proBowl: { AFC: [...], NFC: [...] }, mine: { allPro: [...], proBowl: [...] }, retirements: [{ name, pos, age, team, line, mine }], hall: [{ name, line }], owner: { verdict, goals, security, delta, fired: bool }, gm: { pts (staff points earned) } }`.
   If fired: `jobOffers(F)` **STUB** → `[{ team: TeamRef, record, roster: { ovr, rank }, capSpace, pitch }]`, `takeJob(F, short)` **STUB** (the save continues with the new team).
2. **staff** `staff(F)` (above) · `coachMarket(F)` **STUB** → `{ coaches: CoachRow[] (+ ask, interest, wants: 'HC' | 'OC' | 'DC' | 'any'), openings: [{ team: TeamRef, role }], poached: [{ coach: CoachRow, to: TeamRef, role }] }` ·
   `hireCoach(F, role, coachId, { years } = his ask)` **STUB** · `fireCoach(F, role)` **STUB** · `hireBuiltCoach(F, { name, build })` **STUB** (a built head coach, any time the job is open or to replace the man there) ·
   `scoutPool(F)` **STUB** → `[{ id, name, specialty, text, salary }]`, `hireScout(F, id)` **STUB** ·
   `gmTree(F)` **STUB** → `{ pts, branches: [{ id, name, text, level, max, cost, effect }] }` (practice, negotiating, scouting, trading, medical, game day), `buyPerk(F, branchId)` **STUB**.
3. **resign** `expiring(F)` **STUB** → `[{ ...PlayerRow, ask: { years, perYear, guaranteed }, market, canTag, tagCost, option: null | { cost }, talks: Talks | null, decided: null | 'signed' | 'tagged' | 'walk' | 'option' }]`.
   `openTalks(F, pid)` **STUB** → `Talks` at `flash.talks` and on the row: `{ pid, patience: 0-100, interest: 0-100, ask, last: null | { offer, reaction: 'Insulted' | 'Not close' | 'Getting there' | 'Close' | 'Deal', text }, rounds, done: null | 'signed' | 'walked' }`.
   `makeOffer(F, pid, { years, perYear, guaranteed (share 0-1) })` **STUB** each offer moves interest by how it fits his ask and his drives and costs patience; interest ≥ 100 signs, patience 0 ends the talks.
   `tagPlayer(F, pid)` **STUB** (one a year) · `exerciseOption(F, pid)` **STUB** · `letWalk(F, pid)` **STUB**.
4. **fa** `freeAgency(F)` **STUB** → `{ round: 1-3, roundName: 'Day 1' | 'Day 2' | 'Week 2', players: [{ ...PlayerRow, ask, drives, suitors: n, fit: 0-100 (how the user's team fits his drives), bid: null | { years, perYear, guaranteed }, leader: bool }], capSpace, signed: [{ player, team, deal }] (this round) }`.
   `bidFreeAgent(F, pid, { years, perYear, guaranteed })` **STUB** · `withdrawBid(F, pid)` **STUB** · `advanceFA(F)` **STUB** resolves the round (best fit wins, not only the most money) and opens the next; after the third the stage ends.
5. **draft** `draftBoard(F)` **STUB** (also all season, for scouting) → `{ year, pts (scouting points to spend), prospects: [{ id, name, pos, slot, college, age, ht, wt, combine: { forty, bench, cone, vert } | null, range: { lo, hi, loGrade, hiGrade, text: 'B to A' }, scouted: 0-3, rank (consensus), proj: 'Round 1' …, traits: [{ key, label, lo, hi }] | null, real: bool, photo }], needs }`.
   `draftView(F)` **STUB** → `{ round, pick, overall, onClock: TeamRef, mine: bool, myPicks: [{ round, overall }], order: [{ overall, round, team: TeamRef, done: null | { name, pos, college } }], ticker: [{ overall, team, name, pos, college }], offers: Offer[] (trade up/down), board (draftBoard), done: bool }`.
   `draftPick(F, prospectId)` **STUB** · `simToMyPick(F)` **STUB** · `autoDraft(F)` **STUB** (the staff makes the user's picks to the end) · `answerOffer` / `proposeTrade` work on picks during the draft.
6. **udfa** `udfaPool(F)` **STUB** → `[{ ...prospect row, signed: bool }]`, `signUdfa(F, id)` **STUB** (up to the camp limit).
7. **camp** `campView(F)` **STUB** → `{ drills: [{ id, group: 'QB' | 'SKILL' | 'LINE' | 'FRONT' | 'SECONDARY' | 'K', title, game (a combine mini game id), player: (the stop's player shape), mg (MgStage props), done: null | { medal: 'gold' | 'silver' | 'bronze' | null, xp, text } }] (three), holdouts: [{ ...PlayerRow, wants: { perYear, years }, options: [{ id, label, text }] }], camp: { count, limit } }`.
   `resolveDrill(F, drillId, { score } | 'sim')` **STUB** gold ≥ 0.85, silver ≥ 0.65, bronze ≥ 0.45 → XP for that position group. `resolveHoldout(F, pid, optionId | 'delegate')` **STUB**.
8. **cuts** `cutsView(F)` **STUB** → `{ count, limit: 46, over, roster: PlayerRow[], suggested: [pid] (who the staff would cut), problems: [text] }`; `releasePlayer`, `autoCut(F)` **STUB**. Leaving the stage runs progression and regression for the league, sets the new schedule, goals and power rankings: `newSeason(F)` (selector, after the turn) → `{ year, goals, changes: [{ player: PlayerRow, d: ovr change, text }], schedule, rookies: PlayerRow[] }`.

## 7. The autopilot

`autopilot(F, { until } )` **STUB**: plays everything, making every user decision the way the staff would (it is what DELEGATE does, one decision at a time). `until`: `'week'` (one week), `'season'` (to the offseason), `'year'` (through the offseason to Week 1), or a number of seasons. The engine's own checks drive the league with it.

## 8. Constants worth importing

`GAMEPLANS`, `PRACTICE`, `DEV` (tier names), `DRIVES`, `DRIVE_TEXT`, `SLOTS` (depth chart slots in order), `STAGES`, `PLAYOFF_ROUNDS`, `COACH_TYPES`, `COACH_LABEL`, `ROLE_NAME`, `MOMENT_FITS`, `LIMITS`, `BUILD_CAPS`, `DEFAULT_SETTINGS`, `SAVE_VERSION`, `TRADE_DEADLINE`, `moneyText`, `gradeOf`, `ovrGrade`, `teamRef(short)`, `photoUrl(photo)` (→ a headshot URL or null).

## Notes for the screens

- Year one is the 2026 season and is labelled 2026 everywhere. A later year only ever appears once it has been played.
- Coaches: every team has its real head coach and coordinators once `src/data/nfl-coaches.js` is in the repo. Until
  then they are placeholders (`CoachRow.placeholder: true`, named by the job). Show them plainly; don't dress them up.
- A generated player has `gen: true`, no photo, a made-up name: show initials. A build has `built: true` and its face in `photo`.
- Headshots: `photo` is the id the rest of the app passes to `nflHeadshot` (`cfb_…` ids for the first draft class's real college players resolve through the college headshot path: use `FR.photoUrl(photo)`).
- Nothing in the engine reads the clock or `Math.random`; `saveFranchise` stamps `updatedAt` with `Date.now()`.

## Status

Everything above is exported from `index.js` today. What is real:

- STEP 0 (this commit): `createFranchise` (the real league: rosters, generated depth, ages, tiers, drives, contracts under the cap, coaches, schedule), `roster`, `depthChart`, `capSheet`, `schedule`, `weekGames`, `teams`, `teamInfo`, `staff`, `settingsOf`, `setSetting`, `setDepth`, `autoDepthChart`, `LIMITS`, the constants.
- Everything else is a STUB returning the shape documented here with placeholder values, until the lines above say DONE in the log below.

Log (newest first):
- step 0: API and league build.
