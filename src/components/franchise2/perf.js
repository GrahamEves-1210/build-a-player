// Franchise screens on a slow phone or a school Chromebook: the work a screen does once and keeps, and the work it
// does while nobody's touching anything.
//
//   touch(F) · revOf(F)         every change to a franchise goes through FranchiseMode's act(), which counts it here
//   memoF(F, name, key, fn)     fn() worked out once per F and key (key: what it reads; revOf(F) for "anything")
//   idleRun(steps, done)        run the steps one at a time while the page is idle (a phone without
//                               requestIdleCallback: short timer slices); returns a cancel
//
// (all of it held off F itself: F is the save, plain JSON)
import { useEffect, useState } from 'react'
import { SHORTS, standings, records } from '../../lib/franchise2'
import { warmStats } from '../../lib/franchise2/stats'
import { draftNews } from '../../lib/franchise2/draft'
const REV = new WeakMap()
export const revOf = F => (F ? REV.get(F) ?? 0 : 0)
export const touch = F => { if (F) REV.set(F, revOf(F) + 1) }

const MEMO = new WeakMap()
export function memoF(F, name, key, fn) {
  if (!F) return fn()
  let m = MEMO.get(F)
  if (!m) MEMO.set(F, (m = new Map()))
  const k = String(key)
  const e = m.get(name)
  if (e && e.k === k) return e.v
  const v = fn()
  m.set(name, { k, v })
  return v
}
// a cached value without working it out (undefined when it isn't there yet for this key)
export function peekF(F, name, key) {
  const e = F && MEMO.get(F)?.get(name)
  return e && e.k === String(key) ? e.v : undefined
}

const ric = typeof window !== 'undefined' && window.requestIdleCallback ? window.requestIdleCallback.bind(window) : null
// One line of idle work for the whole mode, first in first out (first: true jumps the line: what's on screen now)
const Q = []
let pending = false
function slice(deadline) {
  pending = false
  const end = performance.now() + 8
  let ran = 0
  while (Q.length) {
    const job = Q[0]
    if (job.off || job.i >= job.steps.length) { Q.shift(); if (!job.off) job.done?.(); continue }
    // (at least one step a slice; more while the frame has time left)
    if (ran && (deadline ? deadline.timeRemaining() <= 4 : performance.now() >= end)) break
    try { job.steps[job.i++]() } catch { /* (a step that fails is skipped: the screen works it out when it needs it) */ }
    ran++
  }
  if (Q.length) kick()
}
function kick() {
  if (pending) return
  pending = true
  if (ric) ric(slice, { timeout: 1200 }); else setTimeout(() => slice(null), 16)
}
export function idleRun(steps, done, { first = false } = {}) {
  const job = { steps, i: 0, done, off: false }
  if (first) Q.unshift(job); else Q.push(job)
  kick()
  return () => { job.off = true }
}

// the standings and the records, worked out once each time the franchise changes (every card on the hub reads them)
export const standingsOf = F => memoF(F, 'standings', revOf(F), () => standings(F))
export const recordsOf = F => memoF(F, 'records', revOf(F), () => records(F))
// The league's box scores (31 teams' seasons, played again from the saved scores: stats.js) and the draft board's
// consensus, worked out a team at a time while the phone is idle, so the hub opens without waiting on them. true once
// they're in for this week (the ticker, the players to watch and the leaders read them).
export const warmKey = F => `${F.year}|${F.phase}|${F.wk}|${F.po?.rd ?? ''}`
export function useLeagueWarm(F) {
  const key = warmKey(F)
  const [done, setDone] = useState(() => (peekF(F, 'warm', key) ? key : null))
  useEffect(() => {
    if (peekF(F, 'warm', key)) { setDone(key); return undefined }
    const steps = [...SHORTS.map(s => () => warmStats(F, s)), () => { draftNews(F) }]
    return idleRun(steps, () => { memoF(F, 'warm', key, () => true); setDone(key) }, { first: true })
  }, [F, key])
  return done === key
}

// A long screen drawn in parts: the first `first` parts now, one more part a frame after that (the parts below the
// fold are in before they're scrolled to; each one's entrance plays as it lands). key: a new key starts it over
// (Team's offense and defense).
export function useStaged(total, first = 1, key = '') {
  const [st, setSt] = useState({ key, n: first })
  const n = st.key === key ? st.n : first
  useEffect(() => {
    if (n >= total) return undefined
    let t = null
    const r = requestAnimationFrame(() => { t = setTimeout(() => setSt({ key, n: n + 1 }), 0) })
    return () => { cancelAnimationFrame(r); clearTimeout(t) }
  }, [n, total, key])
  return Math.min(n, total)
}
