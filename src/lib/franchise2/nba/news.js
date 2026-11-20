// NBA FRANCHISE: the wire. Short items in the voice of a league insider: facts, the team, the man, the terms.
// { d (the day, or null in the offseason), y (season), k (kind), tag (the chyron's word), s (team), text }
import { TEAM } from './league'
export const NEWS_MAX = 60
// the cap engine writes teams by their short ("the BOS"); the wire and the screens say them the way a reporter does
// ("the Celtics", "the Heat's")
export const teamWords = t => String(t ?? '').replace(/\b(the|The) ([A-Z]{3})\b('s|')?/g, (m, the, s, pos) => {
  const n = TEAM[s]?.nick
  if (!n) return m
  return `${the} ${n}${pos ? (/s$/.test(n) ? "'" : "'s") : ''}`
})
export function addNews(F, item) {
  if (!item?.text) return
  F.news = [{ d: F.phase === 'season' ? F.day : null, y: F.year, ...item, text: teamWords(item.text) }, ...(F.news ?? [])].slice(0, NEWS_MAX)
}
export const newsFor = (F, s) => (F.news ?? []).filter(x => !s || x.s === s)
