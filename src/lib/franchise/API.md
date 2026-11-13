# FRANCHISE engine API

`import * as FR from '../../lib/franchise'` (lazy-load it: `import('../../lib/franchise')`; Home must not pull it in).
Pure JS, seeded, no React, no DOM (only `save.js` touches `localStorage`, behind a guard). No `Math.random`.

**Status: every function in this file is DONE (real) and exported from `index.js`.** Nothing is a stub any more.
The log at the bottom says what changed and when; the section "Limits" says what is thinner than it sounds.

## 0. How to hold it

- The whole league is ONE plain JSON-serializable object, `F`. Keep it in React state.
- Every **action** is `(F, ...args) => F2`. `F2` is a NEW top-level object (so `setState` re-renders) wrapped around
  the same league, which is changed in place. So: never keep the old `F` expecting it to be unchanged, never keep
  references to nested objects across an action, and memo on `F` itself (or `F.rev`, which goes up by one on every
  action that changed something).
- `F2.flash` is the answer to the last action: `null`, or `{ ok: true, msg?, ...extra }`, or
  `{ ok: false, code, msg }` when the action was refused (the league is untouched; `msg` is a sentence fit for a
  toast, e.g. "That puts the Chiefs $4.2M over the cap.").
- Every **selector** is `(F, ...args) => data`, pure. Most are cheap; `leaders`, `awardRaces`, `leagueStates`,
  `teamNeeds`, `standings` walk the league (5-30 ms on a slow machine): memo them on `F`.
- Never read `F.players` etc. directly in components when a selector exists; the selectors are the contract.
- The user is the GENERAL MANAGER: `F.gm.name` everywhere. Text never says "You", and never calls him coach.
- Money is in $M (`12.5` = $12.5M). `FR.moneyText(12.5)` → `"$12.5M"`.
- Ratings are the game's own 0-11 trait grades; `grade` fields are the letters (F … S); `ovr` is the position's own
  OVR formula (utils/simulation.js).
- **No text the engine writes names a year that has not been played.** Picks read "Round 2, the next draft"; the cap
  sheet's later seasons carry `label: 'NEXT SEASON'`. Numeric `year` fields exist for sorting only: don't print them
  for anything in the future.

### Shapes used everywhere

```
TeamRef   { short, name, city, nick, color, color2, ink, logo, conf, div }      // ink: readable text colour on `color`
PlayerRow { id, name, short, pos, slot, num, age, exp, ovr, grade, arch,        // pos qb rb wr te ol dl lb db k · slot QB RB WR TE LT LG C RG RT EDGE DT LB CB S K
            dev, devName,                                                        // 0-3 / NORMAL STAR SUPERSTAR ELITE; null while hidden (a rookie who hasn't played four games)
            team, photo, initials, skin, built, real, gen,                       // photo: a headshot id for FR.photoUrl(photo), or null → show initials on `skin`
            salary, yrs, guar, rookie,                                           // contract: $M a year, years left, guaranteed left, rookie deal
            mood, moodWord, drives,                                              // 0-100, 'Happy' …, ['MONEY','RING']
            inj, wear,                                                           // inj: null | { wk, what ('Sprained ankle'), ir, status: 'OUT' | 'IR' | 'QUESTIONABLE' } · wear 0-100
            starter, depth, at,                                                  // depth: 1 = first at his slot; at: the slot he is listed at
            line,                                                                // this season in one line: "3,412 yds, 24 TD, 9 INT"
            xp, xpNext, pts, flags,                                              // xp: XP toward the next upgrade point, which comes at xpNext (600); pts: points to spend; flags: { hold, wantsOut, block, tag, questionable }
            brk, tierUp }                                                        // brk: the season he broke out (moved up a development tier) or null; tierUp: true in the week it happened
CoachRow  { id, name, role, roleName, team, age, real, placeholder, built, gen,  // role HC OC DC
            ratings: [{ key, label, short, val, grade }],                        // the five: talentDev offPlaycalling defPlaycalling culture situational
            ovr, grade, salary, yrs, record: 'W-L' | null, from,                 // ovr: the data file's formula for his job (FR.coachOvr); from (a built coach): { rating: { name, team } }
            calls, side, interim, title, since, identity }                       // calls: a head coach 'off' | 'def' | null (the side he calls himself), a coordinator true when he calls the plays
Units     { passOff, rushOff, passDef, rushDef, ptsFor, ptsAgainst }             // each { rank (1-32), val (per game), projected: bool }
                                                                                 // projected: true before any game is played (read off the rosters, each unit its own number)
State     'contend' | 'retool' | 'rebuild'                                       // labels: FR.STATE_LABEL → CONTENDING / RETOOLING / REBUILDING
```

## 1. Before a franchise exists, creation, saves, settings

| function | what |
|---|---|
| `teamPreviews(seed)` → `TeamJob[]` (32) | Team select. The same numbers a league created with this seed will show (differences: 0, checked). About 90 ms once, then cached for that seed. `TeamJob`: `{ ...TeamRef, state, label, stateText, window: { years, text }, ratings: { off, def, ovr, rank, offRank, defRank }, groups: [{ slot: 'QB' 'RB' 'WR' 'TE' 'OL' 'DL' 'LB' 'DB' 'K', ovr, grade, starter }], capSpace, capText, draft: { picks, firsts, value, text }, qb: { id, name, age, ovr, grade, yrs, rookie, text }, coreAge, hardest (one sentence), upside (one sentence), difficulty: { level 1-5, word: 'FAVORABLE' 'FAIR' 'DEMANDING' 'HARD' 'VERY HARD', text }, staff: { hc, oc, dc: CoachRow } }`. Browse by `state`; RANDOM within a state is the screen's to do. |
| `createFranchise({ team, builds, gmName, coach, direction, settings, seed })` → `F` | A new league. `team`: NFL short. `builds`: `[{ pos, build, name?, number?, spot?, photo?, types? }]`: the build screen's object works as it is (`build` = `{ trait: { val, photo, … } }`; a DL/DB/OL build's spot comes from its Size chip's `subpos`, or `spot`). Capped by `BUILD_CAPS`. Builds are 22-year-old rookies on first-round rookie deals, STAR development, starting from day one. `coach` (optional): `{ name, build, identity?, ovr? }`, a BUILT head coach; `build` is five slots keyed by rating (or an array of slots), each `{ type, val, qbFull, team, role }` (`ovr` is ignored: the engine works it out with `coachOvr`; `identity` is kept and comes back on his `CoachRow`). He replaces the team's real head coach, who goes to the coaching market. `direction` (optional): the GM's `State`; left out, it is the engine's read of the roster. `settings`: any of `DEFAULT_SETTINGS`. `seed`: any string; same seed + same choices = same league, and the league is the same whichever team is taken. (`coachName` is still read as `gmName`.) |
| `BUILD_CAPS` | `{ qb:1, rb:2, wr:3, te:2, db:4, dl:4, lb:3, ol:5, k:1 }` (Squad Builder's caps, plus one kicker). |
| `saveFranchise(F, slot)` → `{ ok, bytes, error? }` | slot 0-2, key `bap_franchise_v1_<slot>`. Packed and compressed (about 110 KB new, 200-290 KB after years). Takes 60-130 ms: save at stops and week ends, not on every play. |
| `loadFranchise(slot)` → `F \| null \| { broken: true, reason }` | `null` for an empty slot. A save from a newer engine or a damaged one comes back `{ broken: true, reason }` (never throws). |
| `listSlots()` → `[{ slot, empty, broken, reason?, team, gm, year, week, phase, record, rings, updatedAt, bytes }]` | Always three rows. A slot whose save cannot be opened is `broken: true` with `reason`: show it and offer DELETE. |
| `deleteSlot(slot)` | |
| `packFranchise(F)` → string · `unpackFranchise(string)` → `F` | what a save is made of (cloud save later). |
| `settingsOf(F)` → `{ moments, calls, injuries, cap, autoUpgrade, autoDepth, autoRoster, tradeAI, firing }` | |
| `setSetting(F, key, value)` → `F` | `moments` is the PLAY THE MOMENTS toggle (stored in the save); `calls` the coach's calls (only asked when moments are on). |
| `renamePlayer(F, pid, name)` · `setNumber(F, pid, n)` → `F` | builds only. |
| `LIMITS` | `{ ROSTER_MAX: 46, ROSTER_MIN: 40, CAMP_MAX: 62, MIN_AT: { QB:2, RB:3, WR:5, TE:2, OL:7, EDGE:3, DT:3, LB:4, CB:3, S:3, K:1 } }`. In season a team dresses 40-46 (injured reserve does not count); 62 from the end of the season to the cut. |

## 2. Selectors

### Hub and the week
- `hub(F)` →
  ```
  { phase: 'regular' | 'playoffs' | 'offseason', year, week, weekLabel: 'WEEK 7' | 'WILD CARD' | 'OFFSEASON',
    team: TeamRef, gm: { name, security, securityWord, record: '21-13', rings },
    record: { w, l, t, text: '5-2' }, standing: '2nd in the AFC West', seed: 5 | null,
    next: null | { week, label, opp: TeamRef | null, home, oppRecord, bye, kind: 'regular' | 'wc' | 'div' | 'conf' | 'sb', eliminated, neutral },
    bye: bool,                                   // the team's bye week: the main button advances the league
    tasks: Task[],                               // THIS WEEK (same as weekTasks)
    primary: { action: 'play' | 'advance' | 'stage', label: 'PLAY WEEK 7' },
    lastGame: null | { week, opp: TeamRef, home, won, tied, us, them, ot },
    headlines: News[] (5), cap: { space, payroll, cap }, owner: OwnerView, stage: null | { id, name },
    eliminated: null | 'Lost the Divisional Round', champion: bool,
    state, stateLabel, direction, directionLabel, advice: [text] }   // the team's state, the GM's declared direction, the staff's advice for it
  ```
  (`record.text`, `weekLabel` and `next` are stable names: the Home card reads them.)
- `weekTasks(F)` → `Task[]`: `{ id, kind, title, detail, done, count? }`. kinds: `gameplan` `practice` `office` (one per
  open front-office item; `id` is the item id) `upgrades` `injury` `scout` `direction` (the declared direction and that
  it can still be changed before the deadline) `advice` (the staff's first line of advice for that direction: "Three
  veterans on short deals would fetch picks before the deadline: …") `roster` (the roster is illegal). Every one is
  optional; whatever is open when the week is played is done by the staff.
- `pregame(F)` → the user's next game before it starts (null on a bye / when eliminated):
  ```
  { week, label, kind, home: TeamRef, away: TeamRef, userHome, records: { home, away }, venue, weather: null,
    units: { home: Units, away: Units }, injuries: { home: [{ id, name, slot, status, wk }], away: [...] },
    gameplan: { off: { id, label }, def: { id, label } }, moments, calls, keys: [text] (up to three), line: 'KC -3.5' | 'EVEN', superBowl }
  ```
  (the weather is rolled when the game starts: `gameView(F).weather`.)
- `scoutingReport(F, opp = next opponent)` → `{ opp: TeamRef, record, units: Units, strengths: [text], weaknesses: [text], stars: PlayerRow[] (3), staff: { hc, oc, dc } }`.
- `lastWeek(F)` → the recap after a week is played:
  ```
  { week, year, label,
    user: null | { game: GameRow, box: BoxScore, won, tied, us, them, ot, opp: TeamRef, home,
                   potg: { player: PlayerRow, line }, xp: [{ id, name, slot, built, xp, pts }], moments: StopLine[], calls: CallLine[] },
    injuries: [{ id, name, team, slot, what, wk, user, ovr, practice? }], scores: GameRow[], headlines: News[],
    awards: null | { off, def, st: { id, name, team, slot, line } } (players of the week), moves: [text] (what the staff did to the roster), standing }
  ```

### Team
- `roster(F, team = F.team)` → `PlayerRow[]` (slot order, then depth).
- `depthChart(F, team = F.team)` → `{ auto, slots: [{ slot, name, side: 'off' | 'def' | 'st', starters: n, players: PlayerRow[] }] }` (slots: `FR.SLOTS`; a backup lineman is listed at more than one line spot; `KR` is the returner).
- `playerCard(F, pid)` →
  ```
  { ...PlayerRow, ht, wt, bodyText: `6'3" · 225`, college, draft: '2027 · Round 1, Pick 9 (KC)' | 'Undrafted' | null,
    traits: [{ key, label, short, val, grade, cost: points to raise it | null (not his team / maxed), fading: bool }],
    devText, contract: { salary, yrs, guar, rookie, option: 'available' | 'exercised' | null, tag, capHit, cut: { dead, deadNow, deadNext, saves }, ask: { years, perYear, guaranteed } | null, extAsk: { years, perYear, guaranteed } | null, extension: { years, perYear } | null },
    moodFactors: [{ text, d }],                 // "Starting" +7, "Paid well under his value" -13, "Did not come here for a rebuild" -11
    stats: { season: StatLine, career: StatLine, byYear: [{ year, team, ...StatLine }] },
    awards: [{ year, name }], value (trade points), canUpgrade, mine, onBlock }
  ```
  `StatLine` (only his position's keys): QB `g cmp att pct yds td int rtg sk rushYds rushTD` · RB `g att yds ypc td rec recYds recTD fum` · WR/TE `g tgt rec yds ypr td long` · OL `g gs sacksAllowed pancakes` · DL/LB/DB `g tkl sack tfl int pd ff dTD` · K `g fgm fga pct long xpm xpa pts`.
- `capSheet(F, team = F.team)` → `{ cap, payroll, dead, relief (pushed into next year by restructures), deadNext (already on next year's books), restructureRoom, space, rows: [{ ...PlayerRow, capHit, pctOfCap, cut }] (by cap hit), next: [{ year, label: 'NEXT SEASON' | 'IN TWO SEASONS' | 'IN THREE SEASONS', committed, players }], on }`.
- `teamNeeds(F, team = F.team)` → `[{ slot, level: 0-3, word: 'SET' | 'DEPTH' | 'NEED' | 'URGENT', starter: PlayerRow | null, ovr, rank }]`, most urgent first.
- `injuryReport(F, team = F.team)` → `[{ ...PlayerRow, what, wk, status }]`.
- `teamInfo(F, short)` → `{ ...TeamRef, record, standing, seed, ratings: { off, def, ovr, offRank, defRank }, units: Units, staff: StaffView, state, stateLabel, window, capSpace, picks: Pick[], user }`. `Pick`: `{ key, year, round, orig: TeamRef, own, value, when: 'the next draft', overall, text: 'Round 2, the next draft (via DEN)' }`. `overall` is the pick's number in the draft that is on (null before the draft starts and for later drafts); `text` and `when` do not change while a draft is on (its picks stay 'the next draft' until it is over; the ones after it are 'the draft after next' and 'the draft in two years'); sentences the engine writes say "pick No. 30 (Round 1) in this draft".
- `teams(F)` → `[{ ...TeamRef, record, user, state, rank (roster rank 1-32), ovr, capSpace, qb: { id, name, ovr, age } | null }]` (cheap: the LEAGUE table can use it instead of `leagueStates`).
- `staff(F, team = F.team)` → `StaffView`: `{ hc, oc, dc: CoachRow, scout: { id, name, specialty, text, pts, salary } | null, budget: { total, used, left }, playcall: { off, def } (the play-caller's effective 0-11: the head coach's when he calls that side himself, else the coordinator's; lifted by the other man when he is the stronger one), effects: [text] }`.
- `coachCard(F, coachId)` → `{ ...CoachRow, history: [{ year, team, role, w, l, note }], effects: [text], ask: { years, salary }, interest: 0-100 | null (in the user's job, when he is on the market) }`.

### Rebuilding, retooling, contending
- `teamState(F, short = F.team)` → a `TeamJob` (see `teamPreviews`) for a team as it stands now, plus `record`, `user`; for the
  user's team also `{ direction, directionLabel, agree (the GM's direction matches the engine's read), ownerSays (what the owner thinks of it), canChange, advice: [text] }`.
- `leagueStates(F)` → `{ contend: TeamJob[], retool: TeamJob[], rebuild: TeamJob[], all: TeamJob[] }` (each list best roster first).
- `setDirection(F, state)` → `F`: any time in the offseason; once in season, up to the trade deadline (Week 9). `flash: { ok, msg (the owner's
  answer), agree }`. It rewrites the owner's goals, tells the locker room (ring-chasing veterans sour on a rebuild; young
  players like the snaps), puts veterans on short deals on the block in a rebuild, and changes who calls: a rebuilding GM
  is offered picks for veterans, a contending one is offered veterans for picks.
- States are worked out from the roster's strength, the quarterback, the core's age and contracts, and the record (more
  of it as the season goes). They are read again every offseason and at the checkpoints of a season (Weeks 6-9 and 13):
  a team changes course at most once in a season, and only when its record says so. A change is a headline ("The Jets
  are open for business"); for the user's team it is also a front office item (`kind: 'direction'`: SELL / HOLD / PUSH).
- What a team's state does: contenders buy veterans at the deadline and spend in free agency; rebuilding teams sell
  veterans, stay young in free agency, trade down near the top of the draft, and play their young players once a
  season is lost; ring-chasing free agents lean to contenders, players after a role or money to rebuilds.

### League
- `schedule(F, team = F.team)` → `[{ week, label, bye, opp: TeamRef | null, home, played, result: null | { won, tied, us, them, ot }, gameId }]` (18 rows, then any playoff games).
- `weekGames(F, week = F.week)` → `GameRow[]`: `{ id, week, home: TeamRef, away: TeamRef, played, hs, as, ot, user, top: [text] (the game's best passer, runner, receiver), round? }`.
- `boxScore(F, gameId)` → `BoxScore | null` (kept for the latest week's games and every user game of the season).
  ```
  BoxScore { id, week, home: TeamBox, away: TeamBox, ot, scoring: [{ q, clock, team, text, hs, as }] (the user's games) }
  TeamBox  { team: TeamRef, score, quarters: [n, n, n, n, (ot)],
             totals: { plays, yds, passYds, rushYds, firstDowns, third: '5-13', fourth: '1-2', to (turnovers), sacks (made by this team's defense), pen, penYds, top: '31:04' },
             passing: [{ id, name, slot, built, cmp, att, yds, td, int, sk, rtg }], rushing: [{ id, name, slot, built, att, yds, td, long }],
             receiving: [{ id, name, slot, built, tgt, rec, yds, td, long }], defense: [{ id, name, slot, built, tkl, sack, tfl, int, pd, ff }],
             kicking: [{ id, name, slot, built, fgm, fga, long, xpm, xpa, pts }] }
  ```
  A box score adds up: the points are the touchdowns, kicks, two-point tries and safeties in it; a passer's yards are his receivers' yards.
- `standings(F)` → `{ divisions: [{ name, conf, teams: StandRow[] }], conferences: { AFC: StandRow[], NFC: StandRow[] } }`,
  `StandRow`: `{ team: TeamRef, w, l, t, pct, pf, pa, diff, div: '3-1', conf: '6-3', home, away, streak: 'W3', last5: '4-1', seed: 1-7 | null, clinch: 'x' | 'y' | 'z' | 'e' | null, user }` (x playoffs, y division, z first seed, e eliminated).
- `playoffPicture(F)` → `{ AFC: { seeds: StandRow[7], hunt: StandRow[] }, NFC: {…}, bracket: null | { rounds: [{ id, name, games: [{ id, home, away, hs, as, played, winner, seeds: [h, a], conf }] }], champion: TeamRef | null } }`.
- `leaders(F, n = 10)` → `{ passYds, passTD, rating, rushYds, rushTD, rec, recYds, recTD, scrimmage, sacks, tackles, ints, tfl, ff, fgm, points }`, each `[{ rank, player: PlayerRow, val, text }]`. Labels: `FR.LEADER_LABELS`.
- `teamStats(F)` → `[{ team: TeamRef, g, ptsFor, ptsAgainst, yds, passYds, rushYds, ydsAllowed, passYdsAllowed, rushYdsAllowed, to, takeaways, sacks, sacksAllowed, ranks }]` (per game).
- `awardRaces(F)` → `{ MVP, OPOY, DPOY, OROY, DROY, COY, PROTECTOR }`, each `[{ rank, player: PlayerRow | null, coach: CoachRow | null, team: TeamRef, line, share }]` (top five).
- `news(F, n = 30)` → `News[]`: `{ id, year, week, kind, head, body?, team?: TeamRef, pid? }`. kinds: `game award injury trade signing draft owner league milestone staff`.
- `transactions(F, n = 60, team = null)` → `[{ id, year, week, type, team: TeamRef, text, pid? }]`. types: `sign release trade draft ir activate extend tag retire hire fire`.
- `powerRankings(F)` → `[{ rank, prev, move, team: TeamRef, record, blurb, rating, state, stateLabel }]` (32).
- `history(F)` → `{ seasons: [{ year, champion, runnerUp, score, awards: { MVP: { name, team, line, pos }, … }, allPro: [{ slot, name, team }], user: { team, record, finish, seed, security (after the verdict), delta, verdict (the owner's sentence), direction, directionLabel, goals: [{ text, done }], fired } (the owner's fields are null / [] for seasons saved before they were kept) }], records: { season, game, team: [{ key, label, val, name, team, year }] }, gm: { name, seasons, record, playoffs, rings, titles, security, legacy, legacyWord, résumé: [text] (also at `resume`), teams }, hall: [{ name, pos, years, line, team, year, mine }] }`.
- `ownerView(F)` → `{ goals: [{ id, text, weight, done: bool | null, progress }], security, word: 'SECURE' | 'STEADY' | 'WARM SEAT' | 'HOT SEAT', verdict: text | null, floor: 20 }`. The goals follow the GM's direction: contending = the playoffs and a run in them; retooling = a winning record, in the race, a step forward; rebuilding = develop the young core, win more than last year, a rookie who starts. The verdict reads the season against it (losing is forgiven in a rebuild, standing still is not; a contender that misses pays extra).

### Trades, free agents
- `tradeBlock(F)` → `{ mine: PlayerRow[], league: [{ ...PlayerRow, teamState, asking: text, value }], offers: Offer[] (waiting on the user), open, deadlineWeek: 9 }`.
- `tradeAssets(F, team)` → `{ players: [{ ...PlayerRow, value }], picks: Pick[] }`.
- `tradeVerdict(F, offer)` → what the other GM says before anything is sent: `{ ok, give, get (value both ways, as he sees it), gap, answer: text, capOk, rosterOk, counter: Offer | null }`. When the money or the rosters stop it, `answer` names the club and the reason ("The Bears would have 47 on a 46-man roster.", "The Raiders would be down to two edge rushers: a roster needs three.", "The money does not work: the Jets would be $3.20M over the cap.").
  `Offer`: `{ id?, from: short, to: short, give: { players: [pid], picks: [key] }, get: { players: [pid], picks: [key] }, text?, draft? }` (`give` leaves `from`; a pick's key is on its `Pick` row).
- `freeAgents(F, { slot, n } = {})` → `[{ ...PlayerRow, ask: { years, perYear, guaranteed }, interest, fit }]`.

## 3. In-season actions

- `setGameplan(F, { off, def })`: ids from `GAMEPLANS.off` / `GAMEPLANS.def` (`{ id, label, text, good }`). Offense `balanced` `air` `ground` `quick` `shots`; defense `balanced` `stopRun` `rush` `cover` `ball`. Each moves the sim a little (pass rate, sacks, depth of target, takeaways) and a little more when it attacks what the opponent is bad at; never decisive. Resets to balanced each week.
- `setPractice(F, { intensity, focus })`: `full` | `half` | `walk` (`PRACTICE` has labels and numbers: XP against wear, and full pads can hurt a man); `focus`: up to three player ids (extra XP).
- `setDepth(F, slot, [pid, …])` hands the chart to the user (turns `autoDepth` off). `autoDepthChart(F)`: the staff re-sets it now. `setSetting(F, 'autoDepth', true)` hands it back.
- `officeItems(F)` (selector) → `[{ id, kind, title, body, who: { id, name, slot, ovr, photo, built, team, role, roleName, kind: 'player' } | null, options: [{ id, label, text }], delegate: option id }]`. kinds: `role` `contract` `trade-offer` `questionable` `press` `mentor` `wants-out` `direction`.
- `resolveOffice(F, itemId, optionId | 'delegate')`.
- `upgradeTrait(F, pid, trait)` (cost on `playerCard.traits[].cost`: 1 point up to an A, 2 for an A+, 3 for an S). `autoUpgrade(F, pid | null)`: the staff spends for one man or everyone.
- `proposeTrade(F, offer)` → `flash: { ok, accepted, answer, counter? }`. `answerOffer(F, offerId, accept)`. `setBlock(F, pid, on)`. `shopPlayer(F, pid)` → `flash.offers` (real offers, left on the table).
- `releasePlayer(F, pid)` · `signFreeAgent(F, pid, { years, perYear } = his ask)` · `moveToIR(F, pid)` / `activate(F, pid)` · `extendPlayer(F, pid, { years, perYear, guaranteed })` (a man in the last year of his deal; it starts next season).
- `restructureCap(F, amount?)`: moves cap charges into next season (it is dead money then; at most 12% of the cap can be carried this way: `capSheet().restructureRoom`). A team over the cap when a week or the new season starts is put right by the staff: overpaid men are released first, then a restructure, then the worst deals left (never a build); what it did is in `lastWeek().moves` or the news.
- `scoutProspect(F, prospectId, points = 1)` (see the draft). `delegateWeek(F)`: the staff does everything still open this week except the game.

## 4. The game (the user's game day)

One live game at a time, in `F.game` (saved with the franchise: a reload picks it up where it stopped).

| function | what |
|---|---|
| `startGame(F, { mode })` → `F` | `mode`: `'moments'` (stops at moments and coach's calls, per the save's toggles), `'watch'` (no stops, the play log is there to play back), `'sim'` (straight to the final). Refused (`flash.code 'bye'`) on a bye or when eliminated. |
| `stepGame(F)` → `F` | advances ONE play (for a screen that paces the game itself). Stops are raised exactly as in `nextStop`. |
| `nextStop(F)` → `F` | runs the sim to the next stop: `gameView(F).stop`. The last stop is always `kind: 'final'`. |
| `resolveStop(F, result)` → `F` | a moment: `{ win, score, raw? }` from the mini game (`hit` is read as `win`), or `'sim'` / `null` (SIM THIS ONE: rolled from the same odds the stop shows). A call: the option id (`'go'`) or `{ choice }`, or `'sim'` (the staff's pick). The play goes into the log with its text written for the result. |
| `skipGame(F)` → `F` | the red SKIP bar: every stop left is rolled, straight to the final. |
| `finishGame(F)` → `F` | books the game, plays the rest of the league's week, advances the week. Only once the stop is `final`. After it `gameView(F)` is `null` and the recap is `lastWeek(F)`. |
| `gameView(F)` → `GameView \| null` | non-null from `startGame` until `finishGame`. |
| `gameCast(F, playerId?)` → `{ us, them, me } \| null` | MgStage's `cast`, Career's shape (lib/career.js `gameCast`): both teams' real depth charts by name and number, the eleven a side (`xi`), and `me`, the man taking the stop that is up (or `playerId`). `stop.mg.cast` is `null`: pass `FR.gameCast(F)` yourself (it is not kept in the save). `campCast(F, playerId)` does the same for a camp drill. |

```
GameView { id, week, label, kind, superBowl, roundName, mode, status: 'live' | 'stop' | 'final', booked,
           home: TeamRef, away: TeamRef, userHome, us: short, them: short,
           score: { us, them, home, away }, quarters: { home: [..], away: [..] },
           q (1-4, 5+ = OT), clock (seconds left in the quarter), clockText, poss: short | null, down, dist, spot (0-100 from the offense's own goal), spotText: 'KC 34',
           timeouts: { home, away }, weather: { tag: 'dome' | 'altitude' | 'wind' | 'rain' | 'snow' | 'cold' | 'clear', word },
           log: Play[], drives: [{ n, team, startText, plays, yds, time, result }],
           stop: Stop | null, stops: StopLine[], calls: CallLine[], box: BoxScore, winProb: 0-1 (the user's side) }
Play     { i, q, clock, team (short with the ball), down, dist, spot, kind, text, yds, pts, by (short that scored), drive, driveStart,
           moment: null | 'played' | 'sim', call: bool (the play a coach's call led to), score: [home, away] }
         // kind: run pass incomplete sack scramble int fumble punt fg fgmiss td xp xpmiss two kickoff kneel penalty safety
StopLine { n, game, title, player: { id, name }, win, sim, score, text, q, clockText }
CallLine { type, choice, label, odds, worked: bool | null, text, q, clock }
```

### The stop contract

```
Stop =
  { kind: 'moment', id, n,                    // n: 1-based, this game's nth moment
    game, title,                              // a lib/minigames.js GAMES id and its title
    side: 'off' | 'def' | 'st',
    player: { id, name, short, num, pos, slot, team, photo, initials, skin, built, ovr, grade,
              v,                              // the 0-11 value the mini game runs at (traitValue of his own ratings)
              traits: [{ key, label, short, val, grade }],   // the ratings that game reads
              build,                          // his ratings in build format ({ trait: { type, val } })
              kick: { power, accuracy, clutch } | null, dist: yards (a kick) | null, arm },
    situation: { q, clock, clockText, down, dist, spot, spotText, us, them, usShort, themShort, poss,
                 text,                        // "Chiefs trail 20-17, 1:52 left in the fourth. 3rd and 8 at the DEN 42. Mahomes drops back needing 8."
                 short },                     // "Q4 1:52 · 3RD & 8 · DEN 42"
    stakes,                                   // "Convert and the drive lives."
    win, loss,                                // what each result does, in plain words
    odds,                                     // the chance the rating roll makes it (what SIM THIS ONE uses)
    leverage,                                 // 0-1
    mg: { game, v, arm, kick, seed, sport: 'nfl', pos, team: { short, color, color2 }, opp: { short, color, color2 }, home: 'team' | 'opp',
          superBowl: year | null, situation: { us, them (shorts), mine, opp (scores), hoops: false, clock, clockText, period: '4TH', line, tail, dist? (a kick's real distance) },
          weather: 'snow' | 'rain' | null, cast: null } }      // spread into <MgStage … cast={FR.gameCast(F)} />
| { kind: 'call', id, n, type: 'fourth-down' | 'two-point', situation, setup (one sentence),
    options: [{ id: 'go' | 'fg' | 'punt' | 'two' | 'one', label, odds (0-1, null for a punt), oddsText: '54%' | 'NET 41', note, staff: bool (what the staff would call) }] }
| { kind: 'final', result: { won, tied, us, them, ot, text }, potg: { player: PlayerRow, line } }
```

What the engine keeps to (DESIGN §5; all of it checked by `scripts/franchise/moments-check.mjs`): 4 to 6 moments in every
game with moments on (the first four are paced through the game; the finish can add two more when the game is on the
line); never the same mini game twice in a game; the game offered is one the situation really calls for and is taken by
the man at that spot on the depth chart (a build first when one plays there); a mini game used last week is unlikely
this week; at most two coach's calls a game, with the real odds; a late moment in a close game decides it. With
`moments` off (or mode `watch` / `sim`) the same plays are simply played by the sim.

Which game fits which situation is `MOMENT_FITS` (game id → one line): 3rd and 7+ → `third-long` `pass-pro` `release`
`escape` · 3rd and 3-6 → `hot-read` `audible` `catch` `release` · 3rd/4th and short → `sneak` `gap` `seal` · 4th and goal →
`goal-line` · red zone → `catch` · a shot play → `bomb` · first and second down → `juke` `juke-wr` `juke-te` `audible`
`tackle-angle` · behind by a score inside two minutes → `two-minute` (the whole drive) · their 3rd down → `pass-rush`
`jump-route` `zone-drop` · their short yardage / goal line → `run-stuff` `hit-stick` · a kickoff that matters →
`kick-return` · a late kick to tie or win → `game-winner` at the real distance · behind late → `onside`. (`deep-kick` is
four kicks in a row, so it is a camp drill, not a game moment.)

## 5. Advancing

- `advanceWeek(F)`: the week for the whole league with the user's game simmed (also the path on a bye, and when the team is out of the playoffs). Open tasks go to the staff.
- `simTo(F, { week } | 'playoffs' | 'offseason')` repeats it.
- After the Super Bowl `F.phase` is `'offseason'` and the stage is `review`.

## 6. Offseason

`offseason(F)` → `{ year (the season just played), stage: { id, name, n, of }, stages: [{ id, name, done, current }], fired, direction: (teamState(F): declare it here), view }`; `view` is that stage's selector result.
`advanceStage(F, { auto, once })` → the staff does whatever is still open in this stage, then the next one starts. `auto: true` also has the staff make the GM's own choices (free-agent offers, undrafted signings, the camp roster and the cap) and stays on for the rest of the offseason: it is the autopilot. `{ auto: true, once: true }` hands over THIS stage only: the next stage is the GM's again. A direction the GM declared (`setDirection`) is never overwritten at the rollover, delegated or not; only a GM who has never declared one follows the roster's read. After `cuts` the new season starts (`F.phase 'regular'`, week 1). The new league year (the cap, a year off every contract) starts when the review ends.

1. **review** `seasonReview(F)` → `{ year, champion, user: { record, finish, seed }, awards: { MVP, OPOY, DPOY, OROY, DROY, COY, PROTECTOR: { player | coach, name, team, line } }, allPro: [{ slot, player, team }], proBowl: { AFC, NFC }, mine: { allPro, proBowl }, retirements: [{ name, pos, age, team, line, mine, ovr }], hall: [{ name, pos, years, line }], owner: { verdict, goals, security, delta, fired }, gm: { pts, total } }`.
   Fired: `jobOffers(F)` → `[{ team: TeamRef, record, roster: { ovr, rank }, capSpace, pitch }]`, `takeJob(F, short)` (the save continues with the new team; left alone, the best offer is taken).
   `overturnFiring(F)` → `{ ok, msg }`: the owner keeps the GM on instead (the app offers it to Pro players only; the
   engine does not check). Job security rises to at least `KEPT_SECURITY` (35), `seasonReview().owner.kept` is true,
   the season's history line gets `user.kept: true` (with `fired: true` kept), the résumé counts it (`gm.kept`).
2. **staff** view: `{ staff, market, scouts, tree }`. `coachMarket(F)` → `{ coaches: [{ ...CoachRow, ask: { years, salary, asHC, asOC, asDC }, interest, wants: 'HC' | 'any', best, ovrAs: { HC, OC, DC } }], openings: [{ team, role, expired }], poached: [{ coach, from, to, role, mine }] }` · `hireCoach(F, role, coachId, { years })` (also re-signs the man in the job when his deal is up) · `fireCoach(F, role)` · `hireBuiltCoach(F, { name, build })` · `scoutPool(F)` → `[{ id, name, spec, specialty, text, pts, salary, hired }]`, `hireScout(F, id)` · `gmTree(F)` → `{ pts, branches: [{ id, name, text, level, max: 3, cost, effect }] }` (practice, negotiating, scouting, trading, medical, gameday), `buyPerk(F, branchId)`.
   Coaches: head coaches are fired after bad years, winning teams' coordinators are hired away as head coaches (the user's too: `poached[].mine`), deals run out (`openings[].expired`: re-sign him with `hireCoach` or let the staff). A coaching budget (`staff().budget`) caps the three salaries. `fireCoach` and `hireCoach` also work in season; a job left open is filled by the staff when the week is played.
3. **resign** `expiring(F)` → `[{ ...PlayerRow, ask, market, canTag, tagCost, option: null | { cost }, optionOnly, talks: Talks | null, decided: null | 'signed' | 'tagged' | 'walk' | 'option' }]`.
   `openTalks(F, pid)` → `flash.talks`: `{ pid, patience: 0-100, interest: 0-100, ask, last: null | { offer, reaction: 'Insulted' | 'Not close' | 'Getting there' | 'Close' | 'Deal', text }, rounds, done: null | 'signed' | 'walked' }`.
   `makeOffer(F, pid, { years, perYear, guaranteed (share 0-1) })`: each offer moves interest by how it fits his ask and his drives (money, a winner for a ring-chaser, a starting job, home) and costs patience; a full ask or interest 100 signs, patience 0 ends the talks. `tagPlayer(F, pid)` (one a year: the average of the top five at his spot) · `exerciseOption(F, pid)` · `letWalk(F, pid)`.
4. **fa** `freeAgency(F)` → `{ round: 1-3, roundName: 'Day 1' | 'Day 2' | 'Week 2', players: [{ ...PlayerRow, ask, suitors: n, fit: 0-100, bid, leader, from: TeamRef | null }], capSpace, signed: [{ player: { id, name, slot, ovr, age }, team, deal: { years, perYear, guaranteed }, mine, round: 1-3, ask: { years, perYear } (what he asked that round), from: short | null (the club he left), why: 'took less to chase a ring in Detroit', beat: true (he turned the GM's offer down) }] (every signing so far: the round just resolved first, the best man first inside a round), lastRound: 0-3 (the last round resolved), rosterCount, rosterLimit }`.
   `bidFreeAgent(F, pid, { years, perYear, guaranteed })` · `withdrawBid(F, pid)` · `advanceFA(F)` resolves the round (the best offer times fit wins; asks fall 10% then 22%) and opens the next; after the third the stage ends. An offer the GM made to a man who did not sign anywhere STANDS into the next round at the same terms (`players[].bid`); `withdrawBid` or a new `bidFreeAgent` changes it.
5. **draft** `draftBoard(F)` (also all season) → `{ year, label: 'THE DRAFT CLASS', pts, combine, prospects: [{ id, name, pos, slot, college, age, ht, wt, combine: { forty, bench, cone, vert } | null, range: { lo, hi, loGrade, hiGrade, text: 'B to A' }, scouted: 0-3, rank, proj, traits: [{ key, label, lo, hi, loGrade, hiGrade }] | null (from scouted 2), real, photo, gone, initials }], needs }`.
   `combineReport(F)` → `{ done, risers, fallers: [{ ...prospect row, before: range, after: range, move (points the middle of his range moved) }] }` (up to eight each way; empty until the combine has run, which is when the draft stage opens).
   `draftView(F)` → `{ started, done, round, pick, overall, onClock: TeamRef, mine, myPicks: [{ round, overall, used }], order: [{ overall, round, team, done, mine }], ticker, offers: [{ ...Offer, text, fromTeam: TeamRef, picks: { give, get: [{ key, year, round, orig, overall, when, text }] } }] (teams trading up to the user's pick), board, staffPick (the prospect id the staff would take), class: [{ overall, round, pick (in the round), name, pos, college, pid, rank (his rank on the league's board when taken), grade ('A+' … 'D': the pick against the board), ovr, ovrGrade, text }], classGrade: { grade, text, best: { pid, name, text } | null } | null }`. `ticker` rows carry `rank` and `grade` too. A pick trade made during the draft (`proposeTrade`, `answerOffer`) moves `order`, `myPicks` and `mine` at once.
   `draftPick(F, prospectId)` (then the CPU picks to the user's next turn) · `simToMyPick(F)` · `autoDraft(F)` · `answerOffer` / `proposeTrade` work on picks during the draft. `scoutProspect(F, id)` spends a scouting point (3 a week, more with the scouting director and the tree; the combine scouts everyone one level when the draft stage opens).
6. **udfa** `udfaPool(F)` → the best 48 left, `signUdfa(F, id)` (three-year minimum deals, up to the camp limit).
7. **camp** `campView(F)` → `{ drills: [{ id, group, title, game (a combine mini game id), gameTitle, player (the stop's player shape), mg (MgStage props), done: null | { medal: 'gold' | 'silver' | 'bronze' | null, xp, score, text }, medals }] (three), holdouts: [{ ...PlayerRow, wants: { perYear, years }, options, delegate }], camp: { count, limit } }`.
   `resolveDrill(F, drillId, { score } | 'sim')`: gold ≥ 0.85 (600 XP for every man at that position), silver ≥ 0.65 (380), bronze ≥ 0.45 (200). `resolveHoldout(F, pid, 'pay' | 'firm' | 'trade' | 'talk' | 'delegate')`. TALK is offered once a man (it leaves `options` after it is used): when it works he signs for 88% of his ask and reports (`flash.talked: true`; if that number does not fit the cap he reports on his current deal); when it does not he stays away, less happy, and the other three choices remain.
8. **cuts** `cutsView(F)` → `{ count, limit: 46, over, roster: [{ ...PlayerRow, cut }], suggested: [pid], problems: [text] }`; `releasePlayer`, `autoCut(F)`. Leaving it turns the league over (ages, progression and regression, the schedule, goals, states): `newSeason(F)` → `{ year, goals, changes: [{ player, d, text, pts, kind: 'grew' | 'slipped' | 'points' }], schedule, rookies }`. `d` is his OVR change over the offseason. With `autoUpgrade` off the GM spends the points himself, so a man who earned points has a `kind: 'points'` row: `pts` is what he earned and `d` is what they are worth in OVR once spent (the text says so).

## 7. The autopilot

`autopilot(F, { until })`: plays everything, making every decision the way the staff would (it is what DELEGATE does). `until`: `'week'`, `'season'` (to the offseason), `'year'` (through the offseason to Week 1), or a number of seasons.

## 8. Constants worth importing

`GAMEPLANS`, `PRACTICE`, `DEV`, `DRIVES`, `DRIVE_TEXT`, `SLOTS`, `STAGES`, `PLAYOFF_ROUNDS`, `COACH_TYPES`, `COACH_LABEL`, `ROLE_NAME`, `STATES`, `STATE_LABEL`, `STATE_TEXT`, `MOMENT_FITS`, `LEADER_LABELS`, `LIMITS`, `BUILD_CAPS`, `STAFF_BUDGET`, `XP_PER_POINT`, `DEFAULT_SETTINGS`, `SAVE_VERSION`, `TRADE_DEADLINE`, `moneyText`, `gradeOf`, `ovrGrade`, `teamRef(short)`, `photoUrl(photo)`, `coachDataIsReal()`, `COACH_ATTR`, and `coachOvr(ratings | build, role = 'HC')` → 0-99: a coach's overall by the data file's own formula (`ratings`: `{ talentDev: 7, … }`; a `build`: `{ talentDev: { val: 7 }, … }`), so the build-a-coach screen can show a built coach's overall on the same scale as the real ones.

## Limits (true today)

- Coaches are the REAL 2026 staffs (`src/data/nfl-coaches.js`: 96 on teams, 27 real coaches on the market). `CoachRow.placeholder` is only ever true for a job the data file leaves open (none today). Coaches the engine makes up later (a young assistant promoted when the market is thin) are `gen: true`.
- Punts and kickoffs have no punter or coverage men behind them (league-average punting; the returner is real).
- Records: season and team records are kept; single-game records are not yet (`history().records.game` is empty).
- A generated player has `gen: true`, no photo, a made-up name: show initials. A build has `built: true` and its face in `photo`. The first draft class's real college players carry their `cfb_…` headshot ids (`FR.photoUrl` resolves them).

## Log (newest first)

- The UI agents' REQUESTS.md worked in (scripts/franchise/requests.mjs checks each): `advanceStage`'s `once`; the GM's declared direction is never overwritten; free-agent offers stand into the next round and `freeAgency().signed` rows carry `round`, `ask`, `from`, `why`; draft-day pick trades move the order at once, `draftView().offers[].text`, `Pick.overall` while the draft is on (`text` and `when` are unchanged for the draft that is on; the furthest pick reads 'the draft in two years', not three), `class[]` with `pick`, `rank`, `grade` and `classGrade`; a free agent's `playerCard().contract.ask` is what `signFreeAgent` takes; `contract.extAsk`; `PlayerRow.xpNext`, `.brk`, `.tierUp`; `history().seasons[].user` carries the owner's read; `officeItems().who` carries `team`, `role`, `roleName`; `tradeVerdict` names the side and the reason; `moneyText(0)` is "$0"; one coaching budget (`STAFF_BUDGET`, $32M) for `staff().budget` and `hireCoach`; holdouts have TALK; `newSeason().changes` lists the men who earned points. Text: no later year anywhere (`playerCard().draft` carries no year until that season starts), "1 sack", no sentence starts on a numeral or in lower case.
- Sanity: a star past his prime years is still paid like one on a short deal (Kelce asks about $13M, not $6M); good free agents sign two to five years; the first draft class's real college players sit on the class's talent curve (two or three first-round quarterbacks, not thirteen) and the CPU takes a quarterback who grades with its starter; the season's injuries are healed when the offseason starts and every club's state is read again then; nobody on a team shares a jersey number (generated players give way; old saves are fixed on load); a GM is not fired in his first two seasons with a club and one season costs at most 24 security.

- The real coaches (data/nfl-coaches.js) replace the placeholders: staff, the coaching market, who calls the plays (`calls`), and `coachOvr` for a built coach.
- States and the GM's direction (DESIGN §9): `teamPreviews`, `teamState`, `leagueStates`, `setDirection`; goals, mood, free agents, trades and the staff's advice follow them. The league is now the same whichever team is taken.
- UI requests worked in: `gameCast` is real; `listSlots` rows carry `broken` / `reason`; box score and XP rows carry `slot` and `built`; plays carry `call` and `moment: 'played' | 'sim'`; `stop.mg.team` / `.opp` are `{ short, color, color2 }`, `stop.mg.weather` is `'snow' | 'rain' | null`; units are projected from the rosters before Week 1; injuries read "Sprained ankle"; nothing names a year that has not been played.
- The offseason (eight stages), the draft, trades, the autopilot: DONE.
- The season (the game with moments and calls, the week, standings, awards, owner, front office, development): DONE.
- The user is the GM; coaches with five ratings; a built head coach (DESIGN §8).
- Step 0: this file and a real league.
