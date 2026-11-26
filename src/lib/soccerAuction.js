// TRAIT AUCTION, soccer: the striker on Salary Cap's five soccer columns (data/soccer-salary.js), dealt from its pool,
// scored with the striker's OVR (calcSoccerOVR). Importing this file adds the kit to lib/auctionCore.js; its own file so
// soccer's rosters stay out of football's and basketball's bundles. The soccer app (lib/soccerAuctionUi.js) and the
// live worker (live/src/auction.js) import it: the worker must be redeployed with it.
import { addAuctionKit, slotKit } from './auctionCore'
import { SOCCER_SAL_POOL, SOCCER_SAL_COLS } from '../data/soccer-salary'
import { SOCCER_ATTR, SOCCER_TYPES } from '../data/soccer-attrs'
import { calcSoccerOVR } from '../utils/soccerSimulation'

let kit = null
export const soccerAuctionKit = () => (kit ??= slotKit({
  sport: 'soccer', pos: 'st',
  slots: SOCCER_SAL_COLS.map(c => ({ key: c.key, label: c.label, types: c.types, alt: [] })),
  posTypes: SOCCER_TYPES, attr: SOCCER_ATTR, pool: SOCCER_SAL_POOL,
  ovr: b => calcSoccerOVR(b, SOCCER_TYPES, true),
}))
addAuctionKit('soccer', () => soccerAuctionKit())
