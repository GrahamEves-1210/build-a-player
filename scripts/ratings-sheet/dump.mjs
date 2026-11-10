import { QBS, ATTR, TYPES } from 'F:/build-a-player/src/data/qbs.js'
import { RBS, RB_ATTR, RB_TYPES } from 'F:/build-a-player/src/data/rbs.js'
import { WRS, WR_ATTR, WR_TYPES } from 'F:/build-a-player/src/data/wrs.js'
import { TES, TE_ATTR, TE_TYPES } from 'F:/build-a-player/src/data/tes.js'
import { DBS, DB_ATTR, DB_TYPES } from 'F:/build-a-player/src/data/dbs.js'
import { DLS, DL_ATTR, DL_TYPES } from 'F:/build-a-player/src/data/dls.js'
import { LEGENDS, LEGEND_TYPES } from 'F:/build-a-player/src/data/qb-legends.js'
import { RB_LEGENDS, RB_LEGEND_TYPES } from 'F:/build-a-player/src/data/rb-legends.js'
import { WR_LEGENDS, WR_LEGEND_TYPES } from 'F:/build-a-player/src/data/wr-legends.js'
import { TE_LEGENDS, TE_LEGEND_TYPES } from 'F:/build-a-player/src/data/te-legends.js'
import { DB_LEGENDS, DB_LEGEND_TYPES } from 'F:/build-a-player/src/data/db-legends.js'
import { DL_LEGENDS, DL_LEGEND_TYPES } from 'F:/build-a-player/src/data/dl-legends.js'
import { LBS, LB_ATTR, LB_TYPES } from 'F:/build-a-player/src/data/lbs.js'
import { LB_LEGENDS, LB_LEGEND_TYPES } from 'F:/build-a-player/src/data/lb-legends.js'
import { OLS, OL_ATTR, OL_TYPES } from 'F:/build-a-player/src/data/ols.js'
import { OL_LEGENDS, OL_LEGEND_TYPES } from 'F:/build-a-player/src/data/ol-legends.js'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from 'F:/build-a-player/src/data/nba-guards.js'
import { NBA_BIG_PLAYERS, BIG_TYPES } from 'F:/build-a-player/src/data/nba-bigs.js'
import { NBA_ALLTIME_GUARD_PLAYERS } from 'F:/build-a-player/src/data/nba-guard-legends.js'
import { NBA_ALLTIME_BIG_PLAYERS } from 'F:/build-a-player/src/data/nba-big-legends.js'
import { BUCKET_ATTR } from 'F:/build-a-player/src/data/nba-attrs.js'
import { valToGrade } from 'F:/build-a-player/src/utils/simulation.js'
import { writeFileSync } from 'node:fs'
const P = [
  ['QB', 'nfl', QBS, LEGENDS, TYPES, LEGEND_TYPES, ATTR], ['RB', 'nfl', RBS, RB_LEGENDS, RB_TYPES, RB_LEGEND_TYPES, RB_ATTR],
  ['WR', 'nfl', WRS, WR_LEGENDS, WR_TYPES, WR_LEGEND_TYPES, WR_ATTR], ['TE', 'nfl', TES, TE_LEGENDS, TE_TYPES, TE_LEGEND_TYPES, TE_ATTR],
  ['OL', 'nfl', OLS, OL_LEGENDS, OL_TYPES, OL_LEGEND_TYPES, OL_ATTR], ['DL', 'nfl', DLS, DL_LEGENDS, DL_TYPES, DL_LEGEND_TYPES, DL_ATTR],
  ['LB', 'nfl', LBS, LB_LEGENDS, LB_TYPES, LB_LEGEND_TYPES, LB_ATTR], ['DB', 'nfl', DBS, DB_LEGENDS, DB_TYPES, DB_LEGEND_TYPES, DB_ATTR],
  ['Guards', 'nba', NBA_GUARD_PLAYERS, NBA_ALLTIME_GUARD_PLAYERS, GUARD_TYPES, GUARD_TYPES, BUCKET_ATTR], ['Bigs', 'nba', NBA_BIG_PLAYERS, NBA_ALLTIME_BIG_PLAYERS, BIG_TYPES, BIG_TYPES, BUCKET_ATTR],
]
const out = P.map(([label, sport, cur, leg, types, ltypes, attr]) => ({ label, sport, types, ltypes, labels: Object.fromEntries([...new Set([...types, ...ltypes])].map(t => [t, attr[t]?.label ?? t])),
  cur: cur.map(p => ({ name: p.name, team: p.team, pos: p.subpos ?? p.pos ?? p.position ?? null, attrs: p.attrs ?? null, keys: Object.keys(p).join(',') })),
  leg: leg.map(p => ({ name: p.name, team: p.team, pos: p.subpos ?? p.pos ?? p.position ?? null, attrs: p.attrs ?? null, keys: Object.keys(p).join(',') })) }))
writeFileSync(process.argv[2], JSON.stringify({ grades: Array.from({ length: 12 }, (_, i) => valToGrade(i)), pools: out }))
for (const o of out) console.log(o.label, 'cur', o.cur.length, 'leg', o.leg.length, '| types', o.types.join(','), '| ltypes same', o.types.join() === o.ltypes.join(), '| sample', JSON.stringify(o.cur[0]).slice(0, 330))
