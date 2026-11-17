import { useEffect, useState } from 'react'
import { valToGrade } from '../../utils/simulation'

// Small pieces the wiki's pages share: links between pages, number formats, a weights table, and useMod, which
// loads a heavy module of the game (Career, Franchise, soccer) only on the page that reads numbers from it, so the
// wiki itself stays small and every number still comes from the module the game runs on.

export const Link = ({ go, to, hash, children }) => <a href={to === 'main' ? '/wiki' : `/wiki/${to}`} onClick={e => { e.preventDefault(); go(to, { hash }) }}>{children}</a>

export const n0 = v => (v == null ? '' : Math.round(v).toLocaleString('en-US'))
export const pct = v => `${Math.round(v * 100)}%`
export const usd = v => `$${v}`
export const grade = v => valToGrade(v)
// a list in words: "A, B and C"
export const andList = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
export const orList = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`)
const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
export const word = n => SMALL[n] ?? n0(n)
export const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1) }
// the game's own lines (written to the player) in the wiki's third person
const THIRD = [[/when you use it/g, 'when it is used'], [/when you get hurt/g, 'when he gets hurt'], [/keeps you out/g, 'keeps him out'], [/\byour\b/g, 'his'], [/\byou\b/g, 'he']]
export const third = s => THIRD.reduce((t, [re, w]) => t.replace(re, w), String(s ?? ''))

// A position's OVR weights as a table: weights { trait: share }, attr { trait: { label } }
export function Weights({ title, weights, attr }) {
  const rows = Object.entries(weights ?? {}).sort((a, b) => b[1] - a[1])
  const total = rows.reduce((s, [, w]) => s + w, 0) || 1
  return (
    <table className="wikitable">
      <caption>{title}</caption>
      <tbody>{rows.map(([k, w]) => <tr key={k}><td>{attr?.[k]?.label ?? k}</td><td className="num">{Math.round((w / total) * 100)}%</td></tr>)}</tbody>
    </table>
  )
}

// ── Heavy modules on demand ──────────────────────────────────────────────────
// useMod('career', () => import('../../lib/career')) → the module, or null while it loads. Loaded once per visit.
const mods = new Map()
export function useMod(key, load) {
  const [m, setM] = useState(() => mods.get(key)?.v ?? null)
  useEffect(() => {
    if (m) return undefined
    let live = true
    let e = mods.get(key)
    if (!e) { e = { v: null }; e.p = load().then(v => { e.v = v; return v }); mods.set(key, e) }
    e.p.then(v => { if (live) setM(v) }, () => {})
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return m
}
// several at once: null until every one is in
export function useMods(list) {
  const got = list.map(([k, l]) => useMod(k, l)) // eslint-disable-line react-hooks/rules-of-hooks
  return got.every(Boolean) ? got : null
}
export const Loading = () => <p className="wk-loading" role="status">Loading the numbers from the game…</p>
