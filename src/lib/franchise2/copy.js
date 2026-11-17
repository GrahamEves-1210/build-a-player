// FRANCHISE: the words the screens share, written the way a broadcast or a beat writer writes them.
//   pairText([label, n])  a box score's number and its word: "1 SACK ALLOWED", "3 PRESSURES", "2 TD"
//   plural(n, one, many)  "1 PRO BOWL", "2 PRO BOWLS"
//   tidyName(n)           a real name's suffix with its period: "Will Anderson Jr" -> "Will Anderson Jr."
//   hurtText(F, p, out)   a man's injury in the words of the moment (after the season: back for camp, or how long
//                         into next year); out: injury.js outText
//   seasonOver(F)         the Super Bowl has been played (the offseason)

// a box score's short labels (squadSeason fbLine) as the words a broadcast reads: [one, many]
const WORDS = {
  SACKS: ['SACK ALLOWED', 'SACKS ALLOWED'], PRESS: ['PRESSURE', 'PRESSURES'], PNK: ['PANCAKE', 'PANCAKES'],
  SCK: ['SACK', 'SACKS'], QBH: ['QB HIT', 'QB HITS'], TFL: ['TFL', 'TFL'], FF: ['FORCED FUMBLE', 'FORCED FUMBLES'],
}
export const pairText = ([k, v]) => { const w = WORDS[k]; return w ? `${v} ${v === 1 ? w[0] : w[1]}` : `${v} ${k}` }
export const plural = (v, one, many = `${one}S`) => `${v} ${v === 1 ? one : many}`
export const tidyName = n => String(n ?? '').replace(/\s(Jr|Sr)$/, ' $1.')
// a man's surname the way a broadcast says it: a suffix kept with it, a two-word surname whole (St. Brown, Van Noy)
const SUF = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i, PART = /^(st\.?|de|del|la|le|van|von|da|di|mc)$/i
export function surname(n, keepSuffix = true) {
  const w = String(n ?? '').trim().split(/\s+/)
  const end = w.length > 2 && SUF.test(w[w.length - 1]) ? w.length - 1 : w.length
  let k = end - 1
  while (k > 1 && PART.test(w[k - 1])) k--
  return w.slice(k, keepSuffix ? w.length : end).join(' ')
}
export const seasonOver = F => F?.phase === 'done' || F?.phase === 'off'
export function hurtText(F, p, out) {
  if (!p?.in) return ''
  if (!seasonOver(F)) return out(p)
  // (the season's over: a man with weeks left heals over the spring; a torn ACL late in the year carries over)
  const nx = p.ij?.nx ?? 0
  return nx > 0 ? `OUT ${nx} ${nx === 1 ? 'WEEK' : 'WEEKS'} INTO ${F.year + 1}` : 'BACK FOR CAMP'
}
