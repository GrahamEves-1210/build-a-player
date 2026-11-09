// TEST FIXTURE ONLY: fills every team's list with made-up players around the team's level.
import { MLB_TEAMS } from './mlb-teams.js'
export function hash(s) {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}
const FIRST = ['Luis', 'Jake', 'Tyler', 'Carlos', 'Ryan', 'Josh', 'Matt', 'Nick', 'Jose', 'Alex', 'Kyle', 'Brandon', 'Austin', 'Will', 'Miguel', 'Chris', 'Sam', 'Ben']
const LAST = ['Ramos', 'Miller', 'Walker', 'Castillo', 'Hayes', 'Brooks', 'Torres', 'Allen', 'Bell', 'Diaz', 'Green', 'Ortiz', 'Reyes', 'Ward', 'Price', 'Cruz', 'Ford', 'Lane']
export function fill(named, kind, roles, keys, legend = false) {
  const out = [...named]
  for (const t of MLB_TEAMS) {
    const r = hash(`${kind}-${t.short}-${legend}`)
    const lvl = legend ? 8.2 : 5 + ((kind === 'bat' ? t.off : t.def) - 5.5) * 0.35
    const have = out.filter(p => p.team === t.short)
    for (let i = have.length; i < roles.length; i++) {
      const role = roles[i]
      const attrs = {}
      for (const k of keys) attrs[k] = Math.max(1, Math.min(11, Math.round(lvl + (i === 0 ? 1 : 0) + (r() - 0.5) * 4)))
      if (kind === 'pit') attrs.stamina = role === 'SP' ? Math.max(5, attrs.stamina) : Math.min(3, attrs.stamina)
      out.push({ name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]} ${t.short}${i}`, team: t.short, number: 10 + i, age: 24 + Math.floor(r() * 10), role, starter: i === 0 && !have.some(p => p.starter), attrs })
    }
  }
  return out
}
