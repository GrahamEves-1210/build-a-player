// The words the screens share (copy.js) and the draft night's consensus rank, headless.
//   bash scripts/franchise2/run.sh scripts/franchise2/copy-check.mjs
// Checks: a box score's numbers read as words ("1 SACK ALLOWED", never "1 SACKS · 3 PRESS"); plurals; a real man's
// "Jr" written "Jr."; two-word surnames kept whole (St. Brown); an injury after the Super Bowl; the draft night's
// CONSENSUS NO. is a man's place on the board when the draft began (not among the men left), and a pick keeps it.
import * as FR from '../../src/lib/franchise2/index'
import { pairText, plural, tidyName, surname, hurtText } from '../../src/lib/franchise2/copy'
import { outText } from '../../src/lib/franchise2/injury'
import { statLine } from '../../src/lib/franchise2/awards'

const problems = []
const eq = (got, want, what) => { if (got !== want) { problems.push(what); console.log(`  !! ${what}: got "${got}", want "${want}"`) } else console.log(`   ok ${what}: ${got}`) }
eq([['SACKS', 1], ['PRESS', 3]].map(pairText).join(' · '), '1 SACK ALLOWED · 3 PRESSURES', 'a lineman\'s game line')
eq(pairText(['SCK', 1]), '1 SACK', 'one sack')
eq(pairText(['TD', 2]), '2 TD', 'touchdowns')
eq(plural(1, 'PRO BOWL'), '1 PRO BOWL', 'one Pro Bowl')
eq(plural(2, 'PRO BOWL'), '2 PRO BOWLS', 'two Pro Bowls')
eq(statLine({ p: 'dl' }, { sck: 1, tfl: 4 }), '1 SACK · 4 TFL', 'a season line with one sack')
eq(statLine({ p: 'ol' }, { gp: 1, sa: 1 }), '1 START · 1 SACK ALLOWED', 'a lineman\'s season line')
eq(tidyName('Will Anderson Jr'), 'Will Anderson Jr.', 'Jr. with its period')
eq(tidyName('Michael Penix Jr.'), 'Michael Penix Jr.', 'Jr. already right')
eq(surname('Amon-Ra St. Brown'), 'St. Brown', 'St. Brown')
eq(surname('Kenneth Walker III', false), 'Walker', 'a surname without the suffix')
eq(surname('Marvin Harrison Jr.'), 'Harrison Jr.', 'a surname with the suffix')
const hurt = { in: 2, ij: { l: 'ankle', w: 3 } }
eq(hurtText({ phase: 'season', year: 2026 }, hurt, outText), 'OUT 2 WEEKS', 'an injury in the season')
eq(hurtText({ phase: 'done', year: 2026 }, hurt, outText), 'BACK FOR CAMP', 'an injury after the Super Bowl')
eq(hurtText({ phase: 'off', year: 2026 }, { in: 5, ij: { l: 'ACL', se: 1, nx: 6 } }, outText), 'OUT 6 WEEKS INTO 2027', 'a torn ACL that carries over')

// draft night's CONSENSUS NO.: the board as it stood when the draft began
const F = FR.createFranchise({ seed: 'copy-check', team: 'DEN', owner: 'Graham', builds: [], coach: { name: 'Coach', scheme: 'balanced', style: 'developer' } })
while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
FR.intoPlayoffs(F); while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
FR.closeSeason(F); FR.closeCarousel?.(F); FR.ageLeague(F); FR.openResign(F); FR.openFA(F); while (F.fad) FR.nextFADay(F)
FR.openDraft(F)
const before = FR.consensus(F).map(x => x.i)
FR.startNight(F)
for (let k = 0; k < 40 && !FR.draftDone(F); k++) { FR.cpuPicks(F, 1); if (!FR.draftDone(F) && FR.pickTeam(F) === F.team) FR.autoPick(F) }
const br = FR.boardRank(F)
const left = F.dc.slice(0, 50)
const wrong = left.filter(x => br.get(x.i) !== before.indexOf(x.i) + 1)
if (wrong.length) { problems.push('board rank'); console.log(`  !! ${wrong.length} men left show a rank that isn't their place on the opening board`) } else console.log(`   ok the men left keep their opening board rank (e.g. ${left.slice(0, 3).map(x => br.get(x.i)).join(', ')})`)
const badPick = F.dr.picks.filter(p => p.rk !== before.indexOf(p.xi) + 1)
if (badPick.length) { problems.push('pick rank'); console.log(`  !! ${badPick.length} picks without their board rank`) } else console.log(`   ok every pick keeps its board rank (No. 1 pick was No. ${F.dr.picks[0].rk} on the board)`)
FR.markSeen(F, 5); FR.markSeen(F, 3)
if (F.dr.seen !== 5) { problems.push('seen'); console.log('  !! draft night seen went backwards') } else console.log('   ok draft night\'s seen only moves forward')
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
