// Career's save, end to end through lib/career.js (loaded the way the app loads it, through Vite). A player reported
// that his Career sometimes didn't save on a refresh, unlike his Franchise. This plays football and basketball careers
// from the combine to a second season and "reloads" at every stop on the way (the save written, read back the way the
// app opens it, the season director rebuilt from it): the combine, the interviews, draft day, camp, the press
// conference, after a few weeks, a key moment on the card, an injury, the bye, the deadline, the All-Star break, the
// playoffs between rounds, the offseason's steps, the contract talks and the next season. At each one the reloaded
// copy must be the same career, and playing on from it must come out exactly like playing on from the one in memory.
// Then the save itself: storage full (freed and retried, else reported, never a silent loss), stamps that only move
// forward (a device whose clock is behind another's), the merge with the account's copy, the last slot played, and
// saves from before this change.     Run from the repo root:  node scripts/moments/career-save-check.mjs [careers=3]
import { createServer } from 'vite'

// a browser's storage: 5 MiB of text (Chrome's quota, measured: 5,242,880 characters), and it throws when full
const QUOTA = 5 * 1024 * 1024
globalThis.localStorage = {
  _m: new Map(), quota: QUOTA,
  used() { let n = 0; for (const [k, v] of this._m) n += k.length + v.length; return n },
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { v = String(v); const was = this._m.has(k) ? k.length + this._m.get(k).length : 0; if (this.used() - was + k.length + v.length > this.quota) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e } this._m.set(k, v) },
  removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() },
  key(i) { return [...this._m.keys()][i] ?? null }, get length() { return this._m.size },
}
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const N = Number(process.argv[2] ?? 3)
for (const sp of ['nfl', 'bucket']) { await C.ensureSport(sp); await C.ensureLore(sp) }
if (C.loadDraftClass) await C.loadDraftClass()

let bad = 0, checks = 0
const fail = (...a) => { bad++; console.log('  FAIL', ...a) }
const ok = (cond, ...a) => { checks++; if (!cond) fail(...a) }
// where two careers part (the first field that differs, a few levels down)
// how far a career has got: the year, then the phase, then the week / the offseason step / the draft's stage
const PHASES = ['college', 'draft', 'preseason', 'season', 'offseason', 'retired']
const OFF = ['recap', 'moves', 'camp', 'contract']
const progress = c => (c.year ?? 0) * 1e6 + PHASES.indexOf(c.phase) * 1e4 + (c.phase === 'season' ? (c.active?.po ? 500 + (c.active.po.idx ?? 0) * 10 + (c.active.po.stage === 'done' ? 5 : 0) : c.active?.k ?? 0) : c.phase === 'offseason' ? OFF.indexOf(c.off?.step ?? 'recap') : c.phase === 'draft' ? (c.step === 'day' ? 300 : c.step === 'interview' ? 100 + (c.draft?.interviews ?? []).filter(x => x.answer != null).length : (c.draft?.combine ?? []).filter(x => x.score != null).length) : 0)
function diffOf(a, b, path = '', depth = 0) {
  if (JSON.stringify(a) === JSON.stringify(b)) return null
  if (depth > 5 || typeof a !== 'object' || typeof b !== 'object' || !a || !b) return `${path}: ${JSON.stringify(a)?.slice(0, 80)} vs ${JSON.stringify(b)?.slice(0, 80)}`
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (k === 'updatedAt' && !path) continue; const d = diffOf(a[k], b[k], `${path}.${k}`, depth + 1); if (d) return d }
  return null
}

const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}

// One tap the way the Career screen makes it, from wherever the career is (D: the season director the screen holds).
// Returns [career, director, what it was]. Every choice is fixed (the first option, a set drill score), so the same
// career taps the same way every time.
function tap(c, D) {
  if (c.phase === 'draft') {
    const d = c.draft
    const left = (d.combine ?? []).find(x => x.score == null)
    if (left) return [C.recordCombine(c, left.id, 0.62, null), D, 'combine']
    if (c.step !== 'interview' && c.step !== 'day') return [C.setupInterviews({ ...c, step: 'interview' }), D, 'interviews']
    const i = (d.interviews ?? []).findIndex(x => x.answer == null)
    if (c.step === 'interview' && i >= 0) return [C.answerInterview(c, i, 0), D, 'interview']
    if (c.step !== 'day') return [C.runDraft({ ...c, step: 'day' }), D, 'draft day']
    return [{ ...c, phase: 'preseason', step: null }, D, 'rookie deal']
  }
  if (c.phase === 'preseason') {
    if (C.pressFor(c)) return [C.answerPress(c, 0), D, 'press']
    if (C.spotMove(c)) return [C.answerSpotMove(c, true), D, 'spot']
    const [n, d] = C.startSeason(c); return [n, d, 'start season']
  }
  if (c.phase === 'season') {
    D ??= C.resumeSeason(c)
    const a = c.active
    if (a.po) {
      if (a.po.stage === 'done') return [C.bookSeason(c), null, 'book']
      const game = C.playoffGame(c, a.po)
      return [C.playoffRound(c, 0.6, game, true, null), D, 'playoff round']
    }
    if (a.injury) return [C.resolveInjury(c, D, false, false)[0], D, 'injury']
    if (a.moment) return [C.chooseMoment(c, D, a.moment.options[0])[0], D, 'moment']
    if (C.byeNow(c)) return [C.byeRest(c, D), D, 'bye']
    // the trade deadline: a first-year player asks out the first time it opens (a new team, a new director)
    if (c.year === 0 && C.canDeadlineTrade(c) && !c.tradeAsked) { const [n, d] = C.deadlineTrade(c, D, 'any'); if (n !== c) return [n, d, 'deadline'] }
    if (a.k >= D.total) { const n = C.finishRegular(c, D); return [n, n.phase === 'season' ? C.resumeSeason(n) : null, 'wrap regular'] }
    const [n] = C.advanceWeek(c, D); return [n, D, 'week']
  }
  if (c.phase === 'offseason') {
    const step = c.off?.step ?? 'recap'
    if (step === 'recap') return [C.offStep(c, 'moves'), D, 'off: recap']
    if (step === 'moves') return [C.offStep(c, 'camp'), D, 'off: moves']
    if (step === 'camp' && !c.off?.camp) return [C.offStep(C.campDrill(c, 0.7, null, false), 'contract'), D, 'off: camp']
    if (c.talks && !c.talks.asked?.length && !c.talks.walked) return [C.ask(c, 'years'), D, 'off: ask']
    if (c.talks) return [c.talks.walked ? C.closeTalks(c) : C.acceptTalks(c), D, 'off: sign the talks']
    if (Array.isArray(c.offers) && c.offers.length) return [C.openTalks(c, c.offers.find(o => o.kind === 'stay') ?? c.offers[0]), D, 'off: talks']
    return [C.nextSeason(c), null, 'next season']
  }
  return [c, D, 'stuck']
}

// a reload: the screen's save, the page gone, the career read back the way the app opens it (loadCareer → opened),
// the director rebuilt from it the way the hub does (resumeSeason)
function reload(c) {
  const okSave = C.saveCareer(c)
  const back = C.loadCareer(c.sport, c.uid, c.slot ?? 0)
  return [okSave, back, back?.phase === 'season' && back.active && !back.active.po ? C.resumeSeason(back) : null]
}

console.log('A · a reload at every stop: the same career, and it plays on the same')
const AHEAD = 6
const CASES = [['nfl', 'qb'], ['nfl', 'wr'], ['nfl', 'dl'], ['bucket', 'guard'], ['bucket', 'big']]
const seen = new Map()
for (const [sport, pos] of CASES) {
  const S = C.SPORT[sport]
  for (let i = 0; i < N; i++) {
    localStorage.clear()
    const rnd = Math.random; Math.random = seeded(`savechk-${sport}-${pos}-${i}`)
    let c
    try { c = C.newCareer({ sport, pos, build: buildFor(S, pos, seeded(`savechk-b-${sport}-${pos}-${i}`)), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: i % C.CAREER_SLOTS }) } finally { Math.random = rnd }
    let D = null, taps = 0, seasons = 0, reloads = 0
    while (taps++ < 700 && seasons < 2 && c.phase !== 'retired') {
      const [okSave, back, D2] = reload(c)
      ok(okSave, sport, pos, i, 'the save did not go in at', c.phase, c.active?.k)
      ok(back && !diffOf(back, { ...c, slot: c.slot ?? 0 }), sport, pos, i, 'reloaded copy differs at', c.phase, c.step ?? c.off?.step ?? c.active?.k)
      // every few stops: play on from both and compare (more often around the stops that hold the most)
      const what = tap(c, D)[2]
      seen.set(what, (seen.get(what) ?? 0) + 1)
      if (back && (taps % 3 === 0 || !['week', 'combine'].includes(what))) {
        reloads++
        // played on from the reload, against playing on in memory: never behind (the stop he reloaded at, the week, the
        // season, the offseason step: nothing undone), and a second reload of the same save plays exactly the same.
        // (Not move for move the same as in memory: the season's games are rolled as it goes, and a career read back
        // rolls them from its own copy, so the same save always plays the same way.)
        // (the moments rotate the ones seen lately to the back, from the device's own list, lib/scenarios.js bap_scn_recent:
        // each run starts from the same list)
        const recent = localStorage.getItem('bap_scn_recent')
        const on = (from, d0) => { let x = from, dx = d0; const real = Math.random; if (recent == null) localStorage.removeItem('bap_scn_recent'); else localStorage.setItem('bap_scn_recent', recent); try { Math.random = seeded(`on-${taps}`); for (let k = 0; k < AHEAD; k++) [x, dx] = tap(x, dx ?? (x.phase === 'season' && x.active && !x.active.po ? C.resumeSeason(x) : null)) } finally { Math.random = real }; return x }
        const x = on(c, D), y = on(back, D2)
        const again = C.loadCareer(c.sport, c.uid, c.slot ?? 0), y2 = on(again, null)
        ok(progress(y) > progress(c) && progress(x) > progress(c), sport, pos, i, `played on after a reload at "${what}": no further on than where he was`, progress(c), progress(x), progress(y))
        // what was played stays played: the seasons booked, and this season's games so far
        // (a booked season's award race keeps its top line once the next one is booked, lib/career.js shortVote: not compared)
        const booked = l => l.map(({ race, ...x }) => x)
        ok(!diffOf(booked(y.seasons.slice(0, c.seasons.length)), booked(c.seasons)), sport, pos, i, `after a reload at "${what}": a booked season changed`, diffOf(booked(y.seasons.slice(0, c.seasons.length)), booked(c.seasons)))
        // (against playing on in memory: a trade at the deadline marks the games before it with the team they were for)
        const fd = z => z.active.feed.slice(0, c.active.feed.length)
        if (c.phase === 'season' && y.phase === 'season' && x.phase === 'season' && y.seasons.length === c.seasons.length && x.seasons.length === c.seasons.length && c.active?.feed) ok(!diffOf(fd(y), fd(x)), sport, pos, i, `after a reload at "${what}": the games already played changed`, diffOf(fd(y), fd(x)))
        ok(!diffOf(y, y2), sport, pos, i, `the same save played on twice came out differently at "${what}"`, diffOf(y, y2))
      }
      const before = c.seasons.length
      ;[c, D] = tap(c, D)
      if (c.seasons.length > before) seasons++
    }
    ok(seasons >= 1, sport, pos, i, 'never finished a season', c.phase)
    console.log(`  ${sport} ${pos} #${i}: ${taps} stops, ${reloads} played on after a reload, ${seasons} seasons, ${(JSON.stringify(c).length / 1024).toFixed(0)} KB`)
  }
}
console.log('  stops covered:', [...seen.entries()].map(([k, v]) => `${k} ${v}`).join(', '))

console.log('B · the browser storage full')
{
  localStorage.clear()
  const S = C.SPORT.nfl
  let c = C.runDraft(C.skipCombine(C.newCareer({ sport: 'nfl', pos: 'qb', build: buildFor(S, 'qb', seeded('full')), name: 'Cole Norwood', owner: 'Guest', slot: 0 })))
  c = { ...c, phase: 'preseason', step: null }
  ok(C.saveCareer(c), 'first save')
  // the rest of the storage: a pile of old Salary Cap days (rebuildable), then filler that isn't (other saves)
  const old = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10)
  for (let d = 0; d < 30; d++) localStorage.setItem(`qbsal_shuffled_u1_${old.slice(0, 8)}${String(d % 28 + 1).padStart(2, '0')}`, 'x'.repeat(2000))
  const today = new Date().toISOString().slice(0, 10)
  localStorage.setItem(`qbsal_shuffled_${today}`, 'keep')
  let n = 0
  try { for (;; n++) localStorage.setItem(`other_save_${n}`, 'x'.repeat(50000)) } catch {}
  try { for (let s = 25000; s >= 1; s = Math.floor(s / 2)) { try { localStorage.setItem(`other_tail_${s}`, 'x'.repeat(s)) } catch {} } } catch {}
  let [c2] = C.startSeason(c)
  ok(C.saveCareer(c2), 'a full storage with old Salary Cap days: the save frees them and goes in')
  ok(localStorage.getItem(`qbsal_shuffled_${today}`) === 'keep', "today's Salary Cap shuffle was dropped")
  ok(C.loadCareer('nfl', null, 0)?.phase === 'season', 'after freeing: the season is the one saved')
  // nothing left to free: the save says it failed, the old copy stays readable
  try { for (let m = 0; ; m++) localStorage.setItem(`more_${m}`, 'x'.repeat(20000)) } catch {}
  try { for (let s = 10000; s >= 1; s = Math.floor(s / 2)) { try { localStorage.setItem(`more_tail_${s}`, 'x'.repeat(s)) } catch {} } } catch {}
  let D3 = C.resumeSeason(c2); let c3 = c2
  for (let k = 0; k < 4; k++) { if (c3.active.moment) c3 = C.chooseMoment(c3, D3, c3.active.moment.options[0])[0]; else if (c3.active.injury) c3 = C.resolveInjury(c3, D3, false, false)[0]; else c3 = C.advanceWeek(c3, D3)[0] }
  ok(C.saveCareer(c3) === false, 'storage full with nothing to free: saveCareer must report the failure (the screen shows it)')
  ok(C.loadCareer('nfl', null, 0)?.active?.k === c2.active.k, 'a failed save must leave the last good copy readable')
  for (const k of [...localStorage._m.keys()]) if (k.startsWith('more_')) localStorage.removeItem(k)
  ok(C.saveCareer(c3) === true && C.loadCareer('nfl', null, 0)?.active?.k === c3.active.k, 'space back (a save deleted): the retry goes in')
}

console.log('C · stamps only move forward (two devices, one clock behind)')
{
  localStorage.clear()
  const S = C.SPORT.bucket
  let c = { ...C.runDraft(C.skipCombine(C.newCareer({ sport: 'bucket', uid: 'u1', pos: 'guard', build: buildFor(S, 'guard', seeded('skew')), name: 'Cole Norwood', owner: 'T', slot: 2 }))), phase: 'preseason', step: null }
  // the copy came from another device whose clock is ten minutes ahead
  const ahead = Date.now() + 10 * 60e3
  c = { ...c, updatedAt: ahead }
  const [n] = C.startSeason(c)
  C.saveCareer(n)
  const saved = C.loadCareer('bucket', 'u1', 2)
  ok(saved.updatedAt > ahead, 'a save made after the other device must stamp later than its copy', saved.updatedAt - ahead)
  // the merge: that older copy, from the cloud, must not win over the device's newer progress
  const merged = await C.syncCareerFromCloud('bucket', 'u1', 2, { cloud: { ...c, updatedAt: ahead } })
  ok(merged?.phase === 'season', 'the merge handed back the older cloud copy over newer progress', merged?.phase)
  // and a genuinely newer cloud copy (another device played on after) still wins
  const later = { ...saved, active: { ...saved.active }, year: saved.year, note: 'other device', updatedAt: saved.updatedAt + 5000 }
  const m2 = await C.syncCareerFromCloud('bucket', 'u1', 2, { cloud: later })
  ok(m2?.note === 'other device', 'a newer cloud copy must win')
}

console.log('D · the slot he played last, and saves from before')
{
  localStorage.clear()
  const S = C.SPORT.nfl
  const mk = slot => ({ ...C.runDraft(C.skipCombine(C.newCareer({ sport: 'nfl', pos: 'wr', build: buildFor(S, 'wr', seeded(`last-${slot}`)), name: `Slot ${slot}`, owner: 'Guest', slot }))), phase: 'preseason', step: null })
  C.saveCareer(mk(0)); C.saveCareer(mk(3))
  ok(C.lastCareerSlot('nfl', null) === 3, 'last slot played: 3', C.lastCareerSlot('nfl', null))
  C.saveCareer({ ...C.loadCareer('nfl', null, 0), face: { x: 1 } })
  ok(C.lastCareerSlot('nfl', null) === 0, 'last slot played: 0')
  localStorage.setItem('bap_career_last_nfl_guest', '4')
  ok(C.lastCareerSlot('nfl', null) === 0, 'a last slot with no career in it falls back to slot 0')
  localStorage.setItem('bap_career_last_nfl_guest', 'junk')
  ok(C.lastCareerSlot('nfl', null) === 0, 'a bad value falls back to slot 0')
  // a save written before this change: no last-slot key, a stamp from Date.now(), or none at all
  const old = mk(1); delete old.updatedAt
  localStorage.setItem('bap_career_nfl_guest_s1', JSON.stringify(old))
  const back = C.loadCareer('nfl', null, 1)
  ok(back && back.name === 'Slot 1' && back.phase === 'preseason', 'an old save (no stamp) still loads')
  ok(C.saveCareer({ ...back, face: { y: 2 } }) && C.loadCareer('nfl', null, 1).updatedAt > 0, 'an old save saves again with a stamp')
  // the same career saved twice: the second is no write and keeps its stamp (an untouched copy never looks newer)
  const a1 = C.loadCareer('nfl', null, 1).updatedAt
  C.saveCareer(C.loadCareer('nfl', null, 1))
  ok(C.loadCareer('nfl', null, 1).updatedAt === a1, 'a save that changes nothing must keep the stamp')
}

console.log(`\n${bad ? `${bad} FAILED` : 'all passed'} (${checks} checks)`)
await server.close()
process.exit(bad ? 1 : 0)
