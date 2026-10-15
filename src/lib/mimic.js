// Made-up players for the Blacktop lobby's TEST fill: believable usernames and a
// look each (avatar, name colour, name effect, nameplate from the shop), so a
// practice game against CPUs looks like a lobby of real people (for demos and
// screenshots). They're still CPUs: the server builds and plays them, and
// nothing about the game is recorded.

import { itemsFor } from './cosmetics'

const NAMES = [
  'jaylen_hoops', 'Mikey2Smooth', 'buckets4days', 'TreyWay', 'AnkleTaker7', 'dimeDropper', 'KingOfTheCourt', 'splashBro22',
  'nate.g', 'Swish_Kid', 'LilBuckets', 'theRealJ', 'cookedYou', 'Deuce_04', 'HoopDreams', 'mvp_marco', 'glassCleaner',
  'jumpmanJR', 'Ty_Hoops', 'courtvision', 'Big_Frank', 'izzyBuckets', 'And1Andre', 'sauceGod', 'RJ_ballin', 'noLookNico',
]
const pick = (list, r) => list[Math.floor(r() * list.length)]

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
