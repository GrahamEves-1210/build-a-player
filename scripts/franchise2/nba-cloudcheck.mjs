// Franchise cloud saves, headless: which account copies land on a device slot (lib/franchise2/cloud.js cloudLands).
//   FR_TMP=<scratch> bash scripts/franchise2/run.sh scripts/franchise2/nba-cloudcheck.mjs
import { cloudLands } from '../../src/lib/franchise2/cloud'
const save = at => JSON.stringify({ v: 1, sport: 'nba', team: 'DET', at })
const setup = JSON.stringify({ v: 1, sport: 'nba', slot: 0, setup: { team: 'DET' }, at: 5000 })
const T = [
  ['an empty slot takes the account copy', { raw: null, owner: undefined, uid: 'a', cloudAt: 100 }, true],
  ['signed out: nothing lands', { raw: null, owner: undefined, uid: null, cloudAt: 100 }, false],
  ['his own older save is replaced by the newer cloud copy', { raw: save(50), owner: 'a', uid: 'a', cloudAt: 100 }, true],
  ['his own newer save stays', { raw: save(200), owner: 'a', uid: 'a', cloudAt: 100 }, false],
  ["another account's save is never written over", { raw: save(50), owner: 'b', uid: 'a', cloudAt: 100 }, false],
  ['a save nobody is marked for stays', { raw: save(50), owner: undefined, uid: 'a', cloudAt: 100 }, false],
  ['an unfinished setup does not block the cloud copy (tester 5 #14)', { raw: setup, owner: undefined, uid: 'a', cloudAt: 100 }, true],
  ['an unfinished setup in his own slot does not block it either', { raw: setup, owner: 'a', uid: 'a', cloudAt: 100 }, true],
  ["an unfinished setup in a slot marked as another account's stays", { raw: setup, owner: 'b', uid: 'a', cloudAt: 100 }, false],
  ['a slot that cannot be read is older than a real save', { raw: '{not json', owner: undefined, uid: 'a', cloudAt: 100 }, true],
  ['a cloud row with no save time never lands', { raw: null, owner: undefined, uid: 'a', cloudAt: 0 }, false],
]
let bad = 0
for (const [name, a, want] of T) { const got = cloudLands(a); if (got !== want) bad++; console.log(`${got === want ? 'ok ' : 'BAD'} ${name}`) }
console.log(bad ? `${bad} problems` : 'no problems')
if (bad) process.exit(1)
