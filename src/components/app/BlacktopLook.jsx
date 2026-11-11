// DEV ONLY (BucketApp mounts it behind import.meta.env.DEV, so it never ships): Blacktop's
// game screens on a made-up game, played out by the real engine on this device. Nothing
// here touches the live server, an account or a record.
//   /bucket?btlook=live      the game from the tip (the reveal, then the court)
//   /bucket?btlook=final     the final (add &loss=1 for the losing side)
//   /bucket?btlook=watch     the same game from the stands (add &stage=result for its final)
//   /bucket?btlook=nowatch  a game that can't be watched (no code: it never asks the server)
//   /bucket?btlook=hud       the bar over the build (add &open=1 for the squads, &clock=15 for the last seconds)
//   &size=1|2|3  &seed=abc  &at=12 (start on play 12)  &play=dunk|arc|block|steal|score|gp|call|guard (start just before the first one; call / guard: my ball, my man)
import { useMemo, useState } from 'react'
import { BlacktopGame, BlacktopHud, BlacktopWatch } from './AppBlacktop'
import { playOut } from '../../lib/blacktopPlay'
import { autoBuild } from '../../lib/blacktopCore'
import { makeMimics } from '../../lib/mimic'

const NO = () => {}

export default function BlacktopLook({ look, pools, types, photoFor }) {
  const q = new URLSearchParams(window.location.search)
  const size = Math.max(1, Math.min(3, Number(q.get('size')) || 3))
  const seed = q.get('seed') || 'look-7'
  const loss = q.has('loss')
  const watch = look === 'watch'
  const [locks, setLocks] = useState({})
  const [votes, setVotes] = useState(() => new Set())
  const [emotes, setEmotes] = useState([])
  const [role, setRole] = useState('balanced')
  const [myCalls, setMyCalls] = useState({})

  const { match, final } = useMemo(() => {
    const people = makeMimics(size * 2, 7919)
    const posAt = i => (size === 1 ? 'guard' : i === size - 1 ? 'big' : 'guard')
    const players = []
    for (let t = 0; t < 2; t++) for (let i = 0; i < size; i++) {
      const me = t === 0 && i === 0
      const cpu = t === 1 && i === size - 1 && size > 1
      const m = people[t * size + i]
      players.push(me
        ? { vid: 'me', name: 'hoopsbygray', uid: null, bot: false, pos: posAt(i), team: t, cos: null }
        : cpu
          ? { vid: `cpu-${t}${i}`, name: 'Hammer', uid: null, bot: true, pos: posAt(i), team: t, cos: null }
          : { vid: `p-${t}${i}`, name: m.name, uid: null, bot: false, pos: posAt(i), team: t, cos: m.cos })
    }
    return { match: { code: 'LOOK', seed, created: Date.now(), ends: Date.now() + 120000, players, bots: true }, final: { seed, builds: {}, roles: {}, afk: [] } }
  }, [size, seed])
  const game = useMemo(() => {
    let g = playOut({ final, match, locks: null, pools, types })
    // the side asked for wins: try a few seeds
    for (let k = 1; k < 40 && g && (g.winner === 0) === loss; k++) g = playOut({ final: { ...final, seed: `${seed}-${k}` }, match, locks: null, pools, types })
    return g
  }, [match, final]) // eslint-disable-line

  const startAt = useMemo(() => {
    if (!game) return null
    if (q.has('at')) return Math.max(0, Math.min(game.plays.length - 1, Number(q.get('at')) || 0))
    const want = q.get('play')
    if (!want) return null
    const hit = game.plays.findIndex(p => (want === 'dunk' ? p.type === 'score' && p.shot === 'dunk'
      : want === 'arc' ? p.type === 'score' && p.pts === 2
      : want === 'gp' ? p.type === 'milestone' && p.big
      : want === 'call' ? p.type === 'check' && p.handler === 'me'
      : want === 'guard' ? p.type === 'check' && p.defender === 'me'
      : p.type === want))
    if (hit < 0) return null
    // the check-up before it
    let i = hit; while (i > 0 && game.plays[i].type !== 'check') i--
    return i
  }, [game]) // eslint-disable-line

  if (look === 'nowatch') return <BlacktopWatch code={null} pools={pools} types={types} onClose={NO} />
  if (look === 'hud') {
    const clock = Number(q.get('clock')) || 134
    const builds = Object.fromEntries(match.players.map((p, i) => {
      const t = p.pos === 'big' ? types.big : types.guard
      const full = autoBuild(null, t, (p.pos === 'big' ? pools.big : pools.guard) ?? [], `${seed}-${p.vid}`)
      const n = p.vid === 'me' ? 5 : [8, 3, 6, 8, 2][i % 5]
      const build = Object.fromEntries(t.map((k, j) => [k, j < n ? full[k] : null]))
      return [p.vid, { filled: n, done: n >= 8, build, pos: p.pos }]
    }))
    const bt = { match, builds, clock, size, myTeam: 0, me: { vid: 'me' }, present: match.players.filter(p => p.vid !== 'p-11'), role, setRole }
    return (
      <div className="ag-screen ag-screen--bucket" style={{ minHeight: '100dvh' }}>
        <BlacktopHud key={q.get('open') ? 'o' : 'c'} bt={bt} onOpenChat={NO} unread={2} devOpen={q.has('open')} />
      </div>
    )
  }
  if (!game) return <div style={{ padding: 40, color: '#fff' }}>No game (no pools?)</div>

  const bt = {
    game, match, final, me: watch ? { vid: null } : { vid: 'me' }, server: false, isLeader: true, watch,
    state: 'live', link: 'live', watchers: 14, startAt: watch ? startAt ?? 0 : null,
    devStart: watch ? null : startAt, devStage: look === 'final' || q.get('stage') === 'result' ? 'result' : null,
    // the calls lock with whatever I tapped; the CPUs' calls are made up here (for the look of what was called: the game was played without them)
    locks, lockCalls: pn => setLocks(l => {
      if (l[pn]) return l
      const c = game.plays.find(p => p.type === 'check' && p.pn === pn)
      const any = a => a[(pn * 7 + a.length) % a.length]
      const pair = [null, null]
      if (c) {
        pair[c.team] = c.handler === 'me' ? myCalls[pn] ?? null : any(['drive', 'pullup', 'post'])
        pair[1 - c.team] = c.defender === 'me' ? myCalls[pn] ?? null : any(size > 1 ? ['press', 'sag', 'help'] : ['press', 'sag'])
      }
      return { ...l, [pn]: pair }
    }),
    arrive: NO, finish: NO, exit: () => { window.location.search = '' },
    myCalls, call: (pn, v) => setMyCalls(c => ({ ...c, [pn]: v })),
    emotes, emote: e => setEmotes(l => [...l, { from: 'me', e, ts: Date.now() }]),
    rematchVotes: votes, voteRematch: () => setVotes(new Set(['me'])),
  }
  return <BlacktopGame bt={bt} user={null} photoFor={photoFor} onOpenChat={watch ? null : NO} unread={watch ? 0 : 1} />
}
