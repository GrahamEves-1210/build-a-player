// BLACKTOP · KING OF THE HILL online (/bucket?btlive=1&koth=1: the Blacktop hub's KING OF THE HILL). Three people,
// every man for himself, on Blacktop Live. He picks his player (the practice list: real players at their own ratings),
// waits in the queue (live/src/koth.js) until three are in, then plays in a Blacktop Live room (live/src/btlive.js),
// the referee: his device moves his own man and times his own meter, the room decides everything else. The room books
// the rating and the record (vs_results 'koth'); this device books his own line, XP and coins (lib/progress.js).
// Like every live game: one tab at a time (claimLive), the seat key with every hello, and leaving counts as a loss.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { adsOffHere } from '../../lib/ads'
import { getUsername } from '../../lib/discord'
import { sfx } from '../../lib/juice'
import { myVid, myVidKey, myDevice, claimLive, releaseLive, markEntered, clearEntered } from '../../lib/live'
import { liveSocket, LIVE_URL } from '../../lib/blacktopServer'
import { currentToken } from '../../lib/supabase'
import { myCosmetics } from '../../lib/progress'
import { setLiveLock } from '../../lib/liveLock'
import { RULES, MODES } from '../../lib/btlive/index.js'
import { PRESETS, ovrOf, best3, Face, Game } from './BtLive'
import { openNet } from './net'
import './btlive.css'
import './koth.css'

const PICK_KEY = 'bap_btlive_koth_pick'
const SEATS = MODES.koth.seats
const phone = () => !!window.matchMedia?.('(pointer: coarse), (max-width: 899px)').matches
const toHub = () => { window.location.href = '/bucket?bthub=1' }
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function KothOnline({ pools, user }) {
  useLayoutEffect(() => (phone() ? adsOffHere() : undefined), [])
  const name = getUsername(user) || 'Guest'
  const presets = useMemo(() => PRESETS.map(([pos, n]) => { const p = pools[pos]?.find(x => x.name === n); return p ? { pos, p, ovr: ovrOf(p, pos) } : null }).filter(Boolean), [pools])
  const photoOf = useMemo(() => { const m = new Map(); for (const pos of ['guard', 'big']) for (const p of pools[pos] ?? []) m.set(p.name, p); return n => m.get(n) ?? null }, [pools])
  const [pick, setPick] = useState(() => { let v = null; try { v = localStorage.getItem(PICK_KEY) } catch {} return presets.some(x => x.p.name === v) ? v : presets[0]?.p.name })
  useEffect(() => { try { if (pick) localStorage.setItem(PICK_KEY, pick) } catch {} }, [pick])
  const [stage, setStage] = useState('pick')       // pick | queue | room | busy
  const [match, setMatch] = useState(null)         // { code, players }
  const mine = presets.find(x => x.p.name === pick) ?? presets[0]
  const findGame = () => { if (!claimLive('blacktop')) { setStage('busy'); return } setMatch(null); setStage('queue') }
  useEffect(() => () => releaseLive(), [])

  if (stage === 'busy') return <Busy onBack={() => setStage('pick')} />
  if (stage === 'queue') return <Queue mine={mine} photoOf={photoOf} onMatch={m => { setMatch(m); setStage('room') }} onLeave={() => { releaseLive(); setStage('pick') }} />
  if (stage === 'room' && match) return <Room key={match.code} match={match} name={name} photoOf={photoOf} onRequeue={() => { setMatch(null); setStage('queue') }} />

  const groups = [['GUARDS', presets.filter(x => x.pos === 'guard')], ['BIGS', presets.filter(x => x.pos === 'big')]]
  return (
    <div className="btlv btlv-menu btlk">
      <header className="btlv-menu-head">
        <a className="btlv-exit" href="/bucket?bthub=1" onClick={() => sfx('back')}>BACK</a>
        <h1>KING OF THE HILL</h1>
        <span className="btlv-tag">ONLINE</span>
      </header>
      <div className="btlv-menu-body">
        <section>
          <h2>YOUR PLAYER</h2>
          {groups.map(([label, list]) => (
            <div key={label} className="btlv-builds">
              <h3>{label}</h3>
              {list.map(x => (
                <button key={x.p.name} className={`btlv-build${x.p.name === pick ? ' is-on' : ''}`} onClick={() => { setPick(x.p.name); sfx('tap') }}>
                  <Face p={x.p} />
                  <span className="btlv-build-name">{x.p.name}</span>
                  <span className="btlv-build-best">{best3(x.p, x.pos).join('  ')}</span>
                  <b className="btlv-build-ovr">{x.ovr}</b>
                </button>
              ))}
            </div>
          ))}
        </section>
      </div>
      <footer className="btlv-menu-foot">
        <p className="btlv-rules">3 PLAYERS · TWO PLAY, ONE SITS · FIRST TO {RULES.goal}, WIN BY {RULES.winBy}</p>
        <button className="btlv-play" disabled={!mine} onClick={() => { sfx('lock'); findGame() }}>FIND A GAME</button>
      </footer>
    </div>
  )
}

function Busy({ onBack }) {
  return (
    <div className="btlv btlv-menu btlv-wait btlk">
      <header className="btlv-menu-head"><button className="btlv-exit" onClick={onBack}>BACK</button><h1>KING OF THE HILL</h1><span /></header>
      <div className="btlv-wait-body">
        <p className="btlv-wait-big">IN A GAME ON ANOTHER TAB</p>
        <p className="btlv-wait-n">FINISH THAT ONE FIRST</p>
      </div>
    </div>
  )
}

// ── The queue: who's in, the player each one picked, and the open spots. It tips off the moment the third man is in ──
function Queue({ mine, photoOf, onMatch, onLeave }) {
  const [list, setList] = useState([])
  const [line, setLine] = useState('connecting')
  const [waited, setWaited] = useState(0)
  const onMatchRef = useRef(onMatch); onMatchRef.current = onMatch
  const me = myVid()
  useEffect(() => {
    const sock = liveSocket('/btlive/koth', () => ({ t: 'hello', vid: myVid(), dev: myDevice(), cos: myCosmetics(), pick: { name: mine.p.name, pos: mine.pos } }), m => {
      if (m.t === 'queue') setList(m.list ?? [])
      if (m.t === 'match') { sock.close(); onMatchRef.current({ code: m.code, players: m.players ?? [] }) }
      if (m.t === 'taken' || m.t === 'bad') { sock.close(); setLine(m.t === 'taken' ? 'taken' : 'bad') }
    }, setLine)
    const id = setInterval(() => setWaited(w => w + 1), 1000)
    return () => { clearInterval(id); sock.close() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // me first, then the others as they came in, then the open spots
  const sorted = [...list.filter(p => p.vid === me), ...list.filter(p => p.vid !== me)]
  const seats = [...Array(SEATS)].map((_, i) => sorted[i] ?? null)
  const have = Math.min(SEATS, list.length || (line === 'live' ? 1 : 0))
  return (
    <div className="btlv btlv-menu btlk btlk-queue">
      <header className="btlv-menu-head">
        <button className="btlv-exit" onClick={() => { sfx('back'); onLeave() }}>LEAVE</button>
        <h1>KING OF THE HILL</h1>
        <span className="btlv-tag">{mmss(waited)}</span>
      </header>
      <div className="btlv-menu-body">
        <div className="btlk-q-head">
          <p className="btlk-q-big">{line === 'taken' ? 'IN THE QUEUE ON ANOTHER TAB' : line === 'bad' ? 'PICK ANOTHER PLAYER' : line !== 'live' ? 'CONNECTING' : 'FINDING PLAYERS'}</p>
          <p className="btlk-q-n"><b>{have}</b> OF {SEATS} IN · TIPS OFF WHEN THE THIRD MAN IS IN</p>
        </div>
        <ol className="btlk-seats" aria-label="The three spots">
          {seats.map((p, i) => {
            const real = p?.pick ? photoOf(p.pick.name) : null
            return (
              <li key={p?.vid ?? `open-${i}`} className={`btlk-seat${p ? ' is-in' : ''}${p?.vid === me ? ' is-me' : ''}`}>
                <span className="btlk-seat-n">{i + 1}</span>
                {p ? (
                  <>
                    {real ? <Face p={real} size={44} /> : <span className="btlv-face" style={{ width: 44, height: 44 }} />}
                    <span className="btlk-seat-who"><b>{p.name || 'Guest'}</b><small>{p.pick ? `${p.pick.name.toUpperCase()} · ${p.pick.pos === 'big' ? 'BIG' : 'GUARD'}` : ''}</small></span>
                  </>
                ) : (
                  <><span className="btlk-seat-open" aria-hidden="true" /><span className="btlk-seat-who is-open"><b>OPEN</b><small>WAITING ON A PLAYER</small></span></>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      <footer className="btlv-menu-foot">
        <p className="btlv-rules">REAL PLAYERS ONLY · LEAVING A GAME COUNTS AS A LOSS</p>
        <button className="btlv-ghost" onClick={() => { sfx('back'); onLeave() }}>LEAVE THE QUEUE</button>
      </footer>
    </div>
  )
}

// ── The game: a seat in the room the queue made. Everything is the referee's; this device moves its own man ──
function Room({ match, name, photoOf, onRequeue }) {
  const [seat, setSeat] = useState(null)
  const [wait, setWait] = useState(null)
  const [again, setAgain] = useState(null)
  const [line, setLine] = useState('connecting')
  const [over, setOver] = useState(false)
  const link = useRef(null)
  const seatRef = useRef(null); seatRef.current = seat
  const onRequeueRef = useRef(onRequeue); onRequeueRef.current = onRequeue
  const booked = useRef(null)
  useEffect(() => {
    // (a reload or the app killed before the final: it's booked as a forfeit on the next load, lib/blacktopServer.js)
    markEntered({ kind: 'blacktop', code: match.code, team: 0, size: 'koth' })
    const hello = { vid: myVid(), key: myVidKey(), token: currentToken() }
    const L = { eng: null, queue: [], net: null, attach(eng) { L.eng = eng; for (const m of L.queue.splice(0)) eng.onNet(m) } }
    L.net = openNet({
      server: LIVE_URL, room: match.code, hello,
      onState: st => { setLine(st); if (st === 'open') L.eng?.resync() },
      onMsg: m => {
        if (m.t === 'pong') return L.net.pong(m)
        if (m.t === 'seat') { setSeat(old => (old && old.seed === m.seed && old.i === m.i ? old : m)); setAgain(null); setOver(false); return }
        if (m.t === 'wait') return setWait(m)
        if (m.t === 'again') return setAgain(m)
        if (m.t === 'requeue') { L.net.close(); onRequeueRef.current(); return }
        if (m.t === 'gone' || m.t === 'taken') { L.net.close(); setLine('gone'); return }
        if (L.eng) L.eng.onNet(m); else { L.queue.push(m); if (L.queue.length > 30) L.queue.shift() }
      },
    })
    link.current = L
    if (import.meta.env.DEV) window.__btnet = L.net
    return () => { L.net.close(); if (window.__btnet === L.net) delete window.__btnet }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // live: every way out asks first and counts as a loss (the page's own QUIT asks too)
  const live = !!seat && !over
  useEffect(() => {
    if (!live) return
    setLiveLock({ title: 'Leave the game?', body: 'King of the Hill goes on without you. It counts as a loss on your Blacktop record and your online rating.', forfeit: () => forfeit() })
    const un = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', un)
    return () => { setLiveLock(null); window.removeEventListener('beforeunload', un) }
  }, [live]) // eslint-disable-line react-hooks/exhaustive-deps

  const forfeit = () => {
    if (booked.current === (seatRef.current?.seed ?? match.code)) return
    booked.current = seatRef.current?.seed ?? match.code
    clearEntered(match.code)
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: false, mvp: false, line: null, bots: false, score: null, team: 0, forfeit: true, size: 'koth' } }))
  }
  // the final: his line, XP and coins, once a game (the room books the rating and the record)
  const onFinal = res => {
    const sd = seatRef.current?.seed
    if (!sd || booked.current === sd) return
    booked.current = sd
    setOver(true)
    clearEntered(match.code)
    const i = seatRef.current.i
    const won = res.winner === i
    const xp = won ? 40 : 15, coins = won ? 35 : 15
    window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp, coins, label: won ? 'King of the Hill win' : 'King of the Hill game' } }))
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won, mvp: false, line: res.stats?.[i] ?? null, bots: false, score: res.score, team: i, size: 'koth' } }))
  }

  const setup = useMemo(() => {
    if (!seat) return null
    const looks = seat.seats.map(x => {
      const real = x.look?.player ? photoOf(x.look.player) : null
      return { label: x.name, photo: real?.photo ?? null, faceCenter: x.look?.faceCenter ?? real?.faceCenter ?? null, who: x.look?.player || x.name, skin: x.look?.skin ?? null, num: x.look?.num ?? null }
    })
    return {
      online: true, mode: 'koth', size: 1, me: seat.i, seed: seat.seed, stick: (() => { try { return localStorage.getItem('bap_btlive_stick') === 'two' ? 'two' : 'one' } catch { return 'one' } })(),
      teams: seat.seats.map((x, t) => [{ id: `t${t}p0`, name: x.name, pos: x.pos, build: x.build }]),
      levels: seat.seats.map(() => null), looks, names: seat.seats.map(x => x.name),
    }
  }, [seat, photoOf])

  if (!setup) {
    const players = match.players ?? []
    return (
      <div className="btlv btlv-menu btlv-wait btlk">
        <header className="btlv-menu-head"><span /><h1>KING OF THE HILL</h1><span className="btlv-tag">{match.code}</span></header>
        <div className="btlv-wait-body">
          <p className="btlv-wait-big">{line === 'gone' ? 'THIS GAME IS OVER' : line === 'open' ? 'TIPPING OFF' : 'CONNECTING'}</p>
          <p className="btlv-wait-n">{players.map(p => p.name || 'Guest').join(' · ')}</p>
          {wait && <p className="btlv-wait-n">{wait.have} OF {wait.need} ON THE COURT</p>}
          {line === 'gone' && <button className="btlv-ghost" onClick={toHub}>BACK TO BLACKTOP</button>}
        </div>
      </div>
    )
  }
  return (
    <Game key={setup.seed} setup={setup} name={name} link={link.current} again={again} onFinal={onFinal}
      onMenu={() => { if (!over) forfeit(); releaseLive(); toHub() }}
      onRematch={() => { link.current?.net.send({ t: 'again' }); setAgain(a => a ?? { have: 1, need: SEATS }) }} />
  )
}
