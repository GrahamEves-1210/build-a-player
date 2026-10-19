// Made-up players for the Blacktop lobby's TEST fill: believable usernames and a
// look each (avatar, name colour, name effect, nameplate from the shop), so a
// practice game against CPUs looks like a lobby of real people (for demos and
// screenshots). They're still CPUs: the server builds and plays them, and
// nothing about the game is recorded.

import { itemsFor } from './cosmetics'
import { getUsername } from './discord'

// Who sees the testing shortcuts (the lobby's TEST fill, the build's AUTO FILL): the demo
// account, and local dev builds
const TESTERS = new Set(['GOATmaker'])
export const isTester = user => import.meta.env.DEV || TESTERS.has(getUsername(user))

const NAMES = [
  'jaylen_hoops', 'Mikey2Smooth', 'buckets4days', 'TreyWay', 'AnkleTaker7', 'dimeDropper', 'CourtKing',
  'splashBro22', 'nate_g', 'Swish_Kid', 'LilBuckets', 'theRealJ', 'cookedYou', 'Deuce_04', 'HoopDreams', 'mvp_marco',
  'glassCleaner', 'jumpmanJR', 'Ty_Hoops', 'courtvision', 'Big_Frank', 'izzyBuckets', 'And1Andre', 'sauceGod',
  'RJ_ballin', 'noLookNico', 'deshawn23', 'MaliqBuckets', 'coldBlooded9', 'tank_jr', 'KJ_Splash', 'zayy_hoops',
  'smoothOp', 'tre_bang', 'Bigmike_33', 'dreyy', 'LongRange_L', 'PostMoves44', 'handleGod', 'jeterrr', 'kaybuckets',
  'OTwill', 'jalen_SZN', 'buckshot_b', 'milesahead', 'GrindTime0', 'fadeaway_ft', 'StepBackSam', 'mo_money3',
  'rimrocker', 'cuz_tyler', 'nickNasty', 'PaintBeast', 'benny_hoops', 'dunkonu', 'ElbowJimmy', 'xavi_23',
  'hoopsbyjay', 'bryce4three', 'SlickRick_4', 'wetJumper', 'TheGoatJr', 'chef_ish', 'downtownDre', 'Q_Buckets',
  'layupLarry', 'splashdaddy', 'krisCrossed', 'ChaseBuckets', 'pickNroll12', 'MarcusRips', 'zoneBuster',
  'heatcheck_h',
]
const pick = (list, r) => list[Math.floor(r() * list.length)]

// (letters, numbers, _ and -, 12 at most: the court shows 12)
// n players with different names; about half wear something on each slot, so some
// look flashy and some plain, like a real lobby
export function makeMimics(n, seed = Date.now()) {
  let x = seed % 2147483647 || 1
  const r = () => (x = (x * 16807) % 2147483647) / 2147483647
  const names = [...NAMES].sort(() => r() - 0.5).slice(0, n)
  const wear = slot => { const list = itemsFor(slot).filter(i => !i.free); return r() < 0.55 && list.length ? pick(list, r).id : undefined }
  return names.map(name => {
    const cos = Object.fromEntries(['avatar', 'nameColor', 'nameFx', 'plate'].map(k => [k, wear(k)]).filter(([, v]) => v))
    return { name, cos: Object.keys(cos).length ? cos : null }
  })
}
