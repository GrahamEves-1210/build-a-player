// TRAIT AUCTION, college (owner 11-27): the same game on College Football's and College Basketball's own pools: each
// school's players and its Legends, at the position the room draws (football QB, RB or WR; basketball guard or big).
// The slots are the pro auction's (Salary Cap's five columns: the trait keys are the same), the OVR is the college
// modes' own: the pro formula through College Football's curve (utils/cfbOvr.js collegeOVR; calcCFBOVR, calcCBBOVR),
// taken to one decimal like the pro auction's.
// Sports 'cfb' and 'cbb' in lib/auctionCore.js: their own queues (cfb-any, cbb-any), counts and rooms; the rules, the
// seeded draw, the ledger check, no repeats and the last-bidder rules are all auctionCore's. Its own file so the
// college rosters stay out of the football and basketball bundles: the apps import it (lib/collegeAuctionUi.js) when
// COLLEGE is picked, and the live worker imports it (live/src/auction.js): the worker must be redeployed with it.
import { addAuctionKit, slotKit } from './auctionCore'
import { calcOVR, calcOVRRB, calcOVRWR } from '../utils/simulation'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { collegeOVR } from '../utils/cfbOvr'
import { ATTR } from '../data/qbs'
import { RB_ATTR } from '../data/rbs'
import { WR_ATTR } from '../data/wrs'
import { BUCKET_ATTR } from '../data/nba-attrs'
import { FB_SAL } from '../data/fb-salary'
import { SAL_COLS } from '../data/nba-salary'
import { CFB_QBS, CFB_RBS, CFB_WRS, CFB_QB_TYPES, CFB_RB_TYPES, CFB_WR_TYPES } from '../data/cfb-players'
import { CFB_LEGEND_QBS, CFB_LEGEND_RBS, CFB_LEGEND_WRS } from '../data/cfb-legends'
import { CBB_GUARDS, CBB_BIGS, CBB_GUARD_TYPES, CBB_BIG_TYPES } from '../data/cbb-players'
import { CBB_LEGEND_GUARDS, CBB_LEGEND_BIGS } from '../data/cbb-legends'

// a position's pool: the current players and the Legends, everyone rated at every trait, one row a name
const poolOf = (lists, types) => {
  const seen = new Set()
  return lists.flat().filter(p => p?.attrs && types.every(t => typeof p.attrs[t] === 'number') && !seen.has(p.name) && seen.add(p.name))
}
// College Football's overall on the unrounded pro number: the curve's step reads the whole number the mode would
// (collegeOVR(95) = 97), the rest of the decimal stays, so the auction's 96.6 is the mode's 97
const college = raw => (raw == null ? null : Math.min(99, raw + (collegeOVR(Math.round(raw)) - Math.round(raw))))

const CFB = {
  qb: { types: CFB_QB_TYPES, attr: ATTR, lists: [CFB_QBS, CFB_LEGEND_QBS], ovr: (b, t) => college(calcOVR(b, t, true)) },
  rb: { types: CFB_RB_TYPES, attr: RB_ATTR, lists: [CFB_RBS, CFB_LEGEND_RBS], ovr: (b, t) => college(calcOVRRB(b, t, true)) },
  wr: { types: CFB_WR_TYPES, attr: WR_ATTR, lists: [CFB_WRS, CFB_LEGEND_WRS], ovr: (b, t) => college(calcOVRWR(b, t, true)) },
}
const CBB = {
  guard: { types: CBB_GUARD_TYPES, lists: [CBB_GUARDS, CBB_LEGEND_GUARDS] },
  big: { types: CBB_BIG_TYPES, lists: [CBB_BIGS, CBB_LEGEND_BIGS] },
}

const kits = {}
export function cfbAuctionKit(pos) {
  const p = CFB[pos] ? pos : 'qb', d = CFB[p]
  return (kits[`cfb-${p}`] ??= slotKit({
    sport: 'cfb', pos: p,
    slots: FB_SAL[p].cols.map(c => ({ key: c.key, label: c.label, types: c.types, alt: [] })),
    posTypes: d.types, attr: d.attr, pool: poolOf(d.lists, d.types),
    ovr: b => d.ovr(b, d.types),
  }))
}
export function cbbAuctionKit(pos) {
  const p = pos === 'big' ? 'big' : 'guard', d = CBB[p]
  return (kits[`cbb-${p}`] ??= slotKit({
    sport: 'cbb', pos: p,
    slots: SAL_COLS.map(c => ({ key: c.key, label: c.label, types: p === 'big' ? c.bigTypes : c.guardTypes, alt: p === 'big' ? c.guardTypes : c.bigTypes })),
    posTypes: d.types, attr: BUCKET_ATTR, pool: poolOf(d.lists, d.types),
    ovr: b => college(calcBucketOVR(b, d.types, p, true)),
  }))
}
addAuctionKit('cfb', cfbAuctionKit)
addAuctionKit('cbb', cbbAuctionKit)
