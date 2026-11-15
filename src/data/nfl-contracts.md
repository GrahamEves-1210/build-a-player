# nfl-contracts.json

Real NFL contracts for every real player in the game's football rosters, for Franchise mode.
Gathered **2026-11-14** (rosters as of the game's Nov 10, 2026 data; contracts after the Nov 10 trade deadline).

## Sources
- **Over The Cap** team salary-cap pages (`overthecap.com/salary-cap/<team>`): each player's 2026 cap number, prorated
  bonus, and which future seasons he's under contract. The year tabs 2026-2035 give the years left.
- **Over The Cap** contracts table (`overthecap.com/contracts`): each player's current deal, total value and APY.
- **2026 salary cap: $301.2M**, announced by the NFL on Feb 27, 2026 (NFL.com; AP). `cap` in the file.
- **Wikipedia** NFL draft pages 2021-2026 (wikitext `NFLDraft-row`): draft year, round, pick, for the `rookie` flag.
- Spotrac / team sites / press reports for the two players OTC did not list (Ryan Neuzil, Xavier Woods).

## Shape
`players` is a map keyed `"<name>|<TEAM>"`, where `<name>` is the game's name lower-cased with everything but a-z
removed: the same `keyOf(name)|TEAM` that `lib/franchise2/contracts.js` builds (`patrickmahomes|KC`). Each row carries
`name` and `team` exactly as the game's data files spell them, so a name-only fallback works too.

| field | meaning |
|---|---|
| `capHit` | 2026 cap hit, $M (one decimal) |
| `yearsLeft` | seasons under contract counting 2026 as year 1 (void years not counted) |
| `through` | last contract season (`2025 + yearsLeft`) |
| `total`, `apy` | the current deal's total value and average per year, $M (OTC) |
| `rookie` | on his rookie contract (drafted 2022+ and the deal still ends where the rookie deal ends: 4 years, a first-rounder's 5th-year option; undrafted: 3-year UDFA deal) |
| `proratedBonus` | 2026 prorated signing bonus, $M (what accelerates if he's cut); active-roster players only |
| `draft` | `[year, round, pick]` (2021+); `undrafted: year` for UDFAs Wikipedia lists |
| `status` | `Injured Reserve`, `Physically Unable to Perform`, `Practice Squad`, `Non-Football Injury/Illness` when not on the active 53 |
| `est` | `true` when any figure is an estimate (see `note`) |
| `note` | why a figure differs from OTC's raw number |

Top level also has `teamDead` (each team's 2026 dead money, $M) and `teamCapUsed` (OTC's total 2026 cap liabilities,
$M) so a team's real books can be checked.

## Rules used
- **Joined in-season** (trades up to Nov 10, waiver claims, mid-season signings): OTC carries only the prorated rest
  of the year on the new team. `capHit` is the full-year figure on the new deal instead (base + prorated bonus on the
  new team; the old team keeps the old proration). 60 players, each noted.
- **Void years**: a year counts only when it has a real cap number and a base salary or roster bonus (OTC lists void
  years with proration only, or with a $99M placeholder base).
- **Practice squad / short-stay rows**: OTC's number is what's accrued so far; `capHit` is the 2026 minimum for his
  experience instead, marked `est`. Minimums used: 0 yrs $0.885M, 1 $1.005M, 2 $1.075M, 3 $1.145M, 4-6 $1.215M, 7+ $1.3M.

## Coverage
1,005 real players in qbs/rbs/wrs/tes/dbs/dls/lbs/ols/ks (1,004 keys: Travis Hunter is one contract, `pos` `WR/CB`).
All matched; **992 from the real books, 13 estimated** (`est: true`). Of the 968 men Franchise actually rosters (the
top MAX at each spot per team, league.js), 958 real and 10 estimated.

Hand-matched names: Drew Ogletree = Andrew Ogletree, Sauce Gardner = Ahmad Gardner, Riq Woolen = Tariq Woolen; 19 more
by last name + first initial on the same team (Matthew/Matt Stafford, Pat/Patrick Surtain II, Kam/Kamren Curl...).

## Gaps and caveats
- Estimated (13): Jake Moody ATL (signed off BAL's practice squad Nov 10, terms not public), Xavier Woods CHI (OTC shows
  his Aug 2026 CHI deal terminated; game still has him on CHI), practice-squad kickers Zane Gonzalez MIA and Charlie
  Smyth NO, Zach Ertz PHI and Dillon Bell MIN (practice squad), and seven IR/NFI rookies and minimum guys.
- Ryan Neuzil (game: ATL) was traded to BAL on Nov 10; OTC had not posted him yet. Figures from Spotrac (2026 cap
  hit $6.225M, 2yr/$9.5M through 2026).
- Daiyan Henley (game: DEN) was traded LAC to DEN on Nov 10; OTC still lists him on LAC. His deal is unchanged.
- Some stars carry very low 2026 hits on big extensions (Will Anderson Jr. $13.2M on $50M APY, Aidan Hutchinson,
  Myles Garrett, JSN...): that is how the deals are structured (proration, low first-year base), not an error.
- The cap hits are from the books as of mid-November (restructures already applied). Players' cap hits sum to 25-86%
  of the cap per team; the rest is backups, specialists and dead money (MIA carries $190M dead, CLE $121M, NO $123M,
  NYJ $119M, ARI $104M). `teamCapUsed` is above $301.2M for many teams because adjusted caps include rollover.
- The `rookie` flag for undrafted players is a heuristic (age 25 or under, APY up to $1.2M, deal through 2028 or sooner)
  where Wikipedia does not list them.

## Re-gathering
`scripts/franchise2/contracts-check.mjs` prints coverage, team totals and outliers
(`bash scripts/franchise2/run.sh scripts/franchise2/contracts-check.mjs`).
