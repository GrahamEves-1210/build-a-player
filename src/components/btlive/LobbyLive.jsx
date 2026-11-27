// BLACKTOP 1V1 / 2V2 online, played live. The lobby, the queue and the build are the ones players know (lib/
// blacktopServer.js, live/src/index.js Lobby + Room); when the build clock is done the room checks every build
// against that seat's seeded spins and hands them to a Blacktop Live room (live/src/btlive.js, the referee), and
// final.live says so. This is that game: each man plays his own build, on the team the lobby put him on. The live
// room books the rating and the 1v1 / 2v2 record (vs_results '1v1' / '2v2'); this device books his own line, XP and
// coins (lib/progress.js), as the old game did. A REMATCH goes back through the lobby (a new build); QUIT is a forfeit.
import { useEffect, useMemo, useRef, useState } from 'react'
import { myVid, myVidKey, clearEntered } from '../../lib/live'
import { LIVE_URL } from '../../lib/blacktopServer'
import { currentToken } from '../../lib/supabase'
import { setLiveLock } from '../../lib/liveLock'
import { Game } from './BtLive'
import { openNet } from './net'
import './btlive.css'

export default function LobbyLive({ bt, photoOf, onMenu }) {
  const code = bt.final.live
  // (King of the Hill: three men, every man for himself; its own final, its own record, btk)
  const koth = bt.size === 'koth'
  const size = koth ? 'koth' : bt.size === 2 ? 2 : 1
  const title = koth ? 'KING OF THE HILL' : size === 2 ? '2V2' : '1V1'
  const [seat, setSeat] = useState(null)
  const [line, setLine] = useState('connecting')
  const [over, setOver] = useState(false)
  const [asked, setAsked] = useState(false)
  const link = useRef(null)
  const seatRef = useRef(null); seatRef.current = seat
  const booked = useRef(null)
  useEffect(() => {
    const hello = { vid: myVid(), key: myVidKey(), token: currentToken() }
    const L = { eng: null, queue: [], net: null, attach(eng) { L.eng = eng; for (const m of L.queue.splice(0)) eng.onNet(m) } }
    L.net = openNet({
      server: LIVE_URL, room: code, hello,
      onState: st => { setLine(st); if (st === 'open') L.eng?.resync() },
      onMsg: m => {
        if (m.t === 'pong') return L.net.pong(m)
        if (m.t === 'seat') { setSeat(old => (old && old.seed === m.seed && old.i === m.i ? old : m)); return }
        if (m.t === 'wait' || m.t === 'again' || m.t === 'rated') return
        if (m.t === 'requeue' || m.t === 'gone' || m.t === 'taken') { L.net.close(); setLine('gone'); return }
        if (L.eng) L.eng.onNet(m); else { L.queue.push(m); if (L.queue.length > 30) L.queue.shift() }
      },
    })
    link.current = L
    if (import.meta.env.DEV) window.__btnet = L.net
    return () => { L.net.close(); if (window.__btnet === L.net) delete window.__btnet }
  }, [code])

  const team = () => seatRef.current?.seats?.[seatRef.current.i]?.team ?? bt.myTeam ?? 0
  // QUIT (or any way out while it's on): out of it at once, the CPU plays his man, and it's a forfeit
  const forfeit = () => {
    link.current?.net.send({ t: 'quit' })
    if (booked.current) return
    booked.current = code
    clearEntered(bt.match?.code)
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: false, mvp: false, line: null, bots: false, score: null, team: team(), forfeit: true, size } }))
  }
  const live = !!seat && !over
  useEffect(() => {
    if (!live) return
    setLiveLock({ title: 'Leave the game?', body: koth ? 'King of the Hill goes on without you. It counts as a loss on your Blacktop record and your online rating.' : 'The game goes on without you and the CPU takes your man. It counts as a loss on your Blacktop record and your online rating.', forfeit: () => forfeit() })
    const un = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', un)
    return () => { setLiveLock(null); window.removeEventListener('beforeunload', un) }
  }, [live]) // eslint-disable-line react-hooks/exhaustive-deps

  // the final: his line, XP and coins, once (the live room books the rating and the record)
  const onFinal = res => {
    if (booked.current) return
    booked.current = code
    setOver(true)
    clearEntered(bt.match?.code)
    const i = seatRef.current?.i ?? 0, t = team()
    const won = koth ? res.winner === i : res.winner === t
    const pts = (res.stats ?? []).map(s => s?.pts ?? 0)
    const mvp = size === 2 && pts.length > 0 && pts[i] === Math.max(...pts) && pts[i] > 0
    const xp = (won ? 40 : 15) + (mvp ? 20 : 0), coins = (won ? 35 : 15) + (mvp ? 10 : 0)
    const label = koth ? (won ? 'King of the Hill win' : 'King of the Hill game') : won ? (mvp ? 'Blacktop win · MVP' : 'Blacktop win') : 'Blacktop game'
    window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp, coins, label } }))
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won, mvp, line: res.stats?.[i] ?? null, bots: false, score: res.score, team: koth ? i : t, size } }))
    bt.finish()
  }

  const setup = useMemo(() => {
    if (!seat) return null
    const byTeam = (koth ? [0, 1, 2] : [0, 1]).map(t => seat.seats.map((x, i) => ({ ...x, i })).filter(x => x.team === t))
    const teams = byTeam.map((list, t) => list.map((x, slot) => ({ id: `t${t}p${slot}`, name: x.name, pos: x.pos, build: x.build })))
    const looks = seat.seats.map(x => {
      const real = x.look?.player ? photoOf(x.look.player) : null
      return { label: x.name, photo: real?.photo ?? null, faceCenter: x.look?.faceCenter ?? real?.faceCenter ?? null, who: x.look?.player || x.name, skin: x.look?.skin ?? real?.skin ?? null, num: x.look?.num ?? null }
    })
    return {
      online: true, mode: koth ? 'koth' : size === 2 ? '2v2' : '1v1', size: koth ? 1 : size, me: seat.i, seed: seat.seed,
      stick: (() => { try { return localStorage.getItem('bap_btlive_stick') === 'two' ? 'two' : 'one' } catch { return 'one' } })(),
      teams, levels: seat.seats.map(() => null), looks, names: byTeam.map(list => list.map(x => x.name).join(' & ') || 'CPU'),
    }
  }, [seat, photoOf, size])

  if (!setup) {
    return (
      <div className="btlv btlv-menu btlv-wait">
        <header className="btlv-menu-head"><span /><h1>{title}</h1><span className="btlv-tag">{code}</span></header>
        <div className="btlv-wait-body">
          <p className="btlv-wait-big">{line === 'gone' ? 'THIS GAME IS OVER' : line === 'open' ? 'TIPPING OFF' : 'CONNECTING'}</p>
          <p className="btlv-wait-n">{(bt.match?.players ?? []).map(p => p.name || 'Guest').join(' · ')}</p>
          {line === 'gone' && <button className="btlv-ghost" onClick={onMenu}>BACK TO BLACKTOP</button>}
        </div>
      </div>
    )
  }
  return (
    <Game key={setup.seed} setup={setup} name={setup.looks[setup.me]?.label || 'Guest'} link={link.current} onFinal={onFinal}
      again={asked ? { have: bt.rematchVotes?.size ?? 1, need: koth ? 1 : (bt.match?.players ?? []).filter(p => p.team === team() && !p.bot).length } : null}
      onMenu={() => { if (!over) forfeit(); onMenu() }}
      onRematch={() => { setAsked(true); bt.voteRematch() }} />
  )
}
