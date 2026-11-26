// BLACKTOP LIVE online: lag compensation, the referee's side (live/src/btlive.js sets it on its game; in practice and
// on a device nothing sets it and the step runs exactly as before).
//
// THE RULE. A defender swipes, goes up or closes out at the man with the ball as his own screen shows that man. His
// screen is behind the referee by the trip a snapshot takes to reach him plus the trip his press takes back: his round
// trip (on top of the beat every screen draws the others behind, which is the same for everyone at any ping and is
// left as the game was tuned). So the referee judges a steal, a block and a contest against where the man with the
// ball was that round trip ago, from a short history of every man's spot it keeps, tick by tick:
//   - the rewind is the defender's own round trip, smoothed (pings), and never more than LAG_CAP_MS (150 ms). A man
//     on a worse line than that gets 150 ms and plays the rest of it as lag, as he would anywhere;
//   - it never reaches back past the handler's last action: the start of a dribble move, the ball changing hands, a
//     gather, a catch, a new possession or a dead ball. What the handler did on his own device stands; a defender can
//     only catch the spot he was in since then (so a steal that was clearly late from the handler's side, after his
//     crossover had already started, is judged against the crossover);
//   - the defender's own spot is his device's word (it already is: his device sends it with the press), so only the
//     handler is rewound. The judgement itself (reach, the chance, the seeded roll) is the same code as ever;
//   - a block: the defender's jump is judged at the point he was into it when he saw the release (his time in the air
//     + the rewind), and a man who goes up just after the release has the rewind added to that window (T.blockAfter);
//   - the CPU, and a seat whose device is quiet (the CPU plays it), get no rewind.
// It can't help a defender who was late on his own screen: the rewind is never more than his screen was behind, so
// the handler is judged where he was at the earliest when the defender saw him, never earlier.
import { HZ } from './tune.js'

export const LAG_CAP_MS = 150
const STEP_MS = 1000 / HZ
const KEEP = 16                  // ticks of history kept (more than the cap: 150 ms is under 6 ticks)
const F = 6                      // x, y, vx, vy, fx, fy
const SMOOTH = 0.25              // each new round trip moves the estimate this much of the way

// one per game: the history ring, each man's last action and his smoothed round trip
export function lagNew(n) {
  return { n, tick: new Int32Array(KEEP).fill(-1), pos: new Float64Array(KEEP * n * F), since: new Int32Array(n).fill(-1e9),
    prev: Array.from({ length: n }, () => ({ act: null, mv: 0, hand: 0, burst: 0, has: false })), rtt: new Float64Array(n), on: new Uint8Array(n), phase: null, poss: null }
}
// a round trip his device measured (ms): smoothed, a wild one (a hitch) only moves it part of the way
export function lagRtt(L, i, ms) {
  if (!L || !(ms > 0) || ms > 5000) return
  L.rtt[i] = L.rtt[i] ? L.rtt[i] + SMOOTH * (Math.min(ms, L.rtt[i] * 3 + 100) - L.rtt[i]) : ms
}
// how many ticks the referee rewinds for defender i (0: the CPU, a quiet seat, no round trip known)
export const lagTicks = (L, i) => (L && L.on[i] && L.rtt[i] > 0 ? Math.round(Math.min(LAG_CAP_MS, L.rtt[i]) / STEP_MS) : 0)

// after every step: every man's spot this tick, and the tick of each one's last action
export function lagRecord(L, s) {
  const t = s.tick, slot = t % KEEP, b = s.ball
  L.tick[slot] = t
  const fresh = s.phase !== L.phase || s.phase !== 'live' || s.poss !== L.poss
  L.phase = s.phase; L.poss = s.poss
  for (let i = 0; i < L.n; i++) {
    const p = s.players[i], o = (slot * L.n + i) * F, q = L.prev[i]
    L.pos[o] = p.x; L.pos[o + 1] = p.y; L.pos[o + 2] = p.vx; L.pos[o + 3] = p.vy; L.pos[o + 4] = p.fx; L.pos[o + 5] = p.fy
    const has = b.st === 'held' && b.holder === i
    if (fresh || p.act !== q.act || p.mv !== q.mv || (p.hand || 0) !== q.hand || (p.burst > 0 && !(q.burst > 0)) || (has && !q.has)) L.since[i] = t
    q.act = p.act; q.mv = p.mv; q.hand = p.hand || 0; q.burst = p.burst; q.has = has
  }
}
// man h as defender d's screen had him (during a step: the spots are the last tick's): { x, y, vx, vy, fx, fy, n }
// (n: the ticks it went back), or null for no rewind
export function lagView(L, s, d, h) {
  const want = lagTicks(L, d)
  if (!want) return null
  const latest = s.tick - 1
  const n = Math.min(want, latest - L.since[h])
  if (n <= 0) return null
  const t = latest - n, slot = t % KEEP
  if (L.tick[slot] !== t) return null
  const o = (slot * L.n + h) * F, P = L.pos
  return { x: P[o], y: P[o + 1], vx: P[o + 2], vy: P[o + 3], fx: P[o + 4], fy: P[o + 5], n }
}
