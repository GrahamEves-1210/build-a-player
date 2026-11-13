import { useMemo, useState } from 'react'
import { Panel, FrTable, Seg, Logo } from '../frUi'
import { teamOf } from '../frTeams'
import { Frame, useOff } from './frame'
import { OfferPad, Drives, PlayerSheet, PosFilter, Who, Club, Bar, Sub, byPos, meetAsk, safe, up, plural, pct, tap } from './offUi'

// OFFSEASON 5 · FREE AGENCY (the engine's freeAgency / bidFreeAgent / withdrawBid / advanceFA). Three rounds:
// Day 1, Day 2, Week 2. The market in a table (position, sort); a row opens the man: his ask, what drives him, how
// many clubs are in on him, how he fits here, and the offer. Advancing resolves the round: who signed where, and
// what became of the GM's own offers. The cap room, the roster count and the club's needs stay pinned on top.
//
// WHY a man signed where he did: the engine's signing rows carry the club and the deal, not a reason (asked for in
// REQUESTS.md as signed[].why, read here when it comes). Until then the line is put together from what the engine
// does say: his drives, the deal against his ask, the club he left and the state of the club he joined.

const ROUND_NEXT = { 1: 'ADVANCE TO DAY 2', 2: 'ADVANCE TO WEEK 2', 3: 'CLOSE FREE AGENCY' }
const deal = (FR, d) => `${plural(d.years, 'year')}, ${FR.moneyText(d.perYear)} a year`

export function whyOf(FR, s, was, states) {
  if (s.why) return s.why
  const D = new Set(was?.drives ?? []), t = s.team, st = states[t.short], ask = was?.ask?.perYear ?? null
  const less = ask != null && s.deal.perYear < ask * 0.985, more = ask != null && s.deal.perYear > ask * 1.03
  if (was?.from && was.from.short === t.short) return D.has('LOYAL') ? 'stayed home' : `went back to ${t.city}`
  if (D.has('RING') && st === 'contend') return less ? `took less to chase a ring in ${t.city}` : 'wanted a contender'
  if (D.has('MONEY') && more) return 'went where the money was, over his ask'
  if (D.has('ROLE') && st === 'rebuild') return 'went for the bigger role on a rebuilding roster'
  if (D.has('MENTOR') && st !== 'contend') return 'signed on to lead a young room'
  if (D.has('COMPETITOR') && st === 'contend') return 'picked a winner'
  if (more) return 'paid over his ask'
  if (less) return 'took a little less than he asked'
  return ask != null ? 'got his number' : 'signed'
}

export default function FreeAgency() {
  const { FR, F, o, act, move } = useOff()
  const v = o.view, money = FR.moneyText
  const [tab, setTab] = useState('market')
  const [pos, setPos] = useState('all')
  const [pid, setPid] = useState(null)
  const [draft, setDraft] = useState({})
  const [results, setResults] = useState(null)   // the round just resolved
  const needs = useMemo(() => safe(() => FR.teamNeeds(F), []).filter(n => n.level >= 1).slice(0, 6), [FR, F])
  const states = useMemo(() => Object.fromEntries(safe(() => FR.teams(F), []).map(t => [t.short, t.state])), [FR, F])
  const mine = v.players.filter(p => p.bid)
  const out = mine.reduce((s, p) => s + p.bid.perYear, 0)
  const r = v.players.find(p => p.id === pid) ?? null
  const offer = r ? draft[r.id] ?? r.bid ?? meetAsk(r.ask) : null
  const us = teamOf(F.team)

  // What a round did, read off the engine after it. The signings are the league's new 'sign' transactions (the
  // stage view's own list keeps only the last 40, which are the round's least-known names), each joined to the man
  // as the market showed him before the round (his ask, his drives, the GM's offer) and to the deal he signed.
  const lastTx = safe(() => FR.transactions(F, 1)[0]?.id, 0)
  const outcome = (before, txWas, next, roundName) => {
    const was = new Map(before.players.map(p => [p.id, p]))
    const st = Object.fromEntries(FR.teams(next).map(t => [t.short, t.state]))
    const fresh = FR.transactions(next, 240).filter(t => t.id > txWas && t.type === 'sign' && t.pid != null && was.has(t.pid)).map(t => {
      const w = was.get(t.pid), c = safe(() => FR.playerCard(next, t.pid))
      const s = { player: { id: w.id, name: w.name, slot: w.slot, ovr: w.ovr }, team: t.team, deal: { years: c?.contract?.yrs ?? c?.yrs ?? 1, perYear: c?.contract?.salary ?? c?.salary ?? 0 }, mine: t.team.short === next.team, was: w }
      return { ...s, why: whyOf(FR, s, w, st) }
    })
    const bids = before.players.filter(p => p.bid)
    return {
      roundName,
      got: fresh.filter(s => s.mine),
      lost: fresh.filter(s => !s.mine && s.was?.bid),
      waiting: bids.filter(p => !fresh.some(s => s.player.id === p.id)),
      league: fresh.filter(s => !s.mine && !s.was?.bid).sort((a, b) => b.player.ovr - a.player.ovr),
    }
  }
  const lines = res => [
    ...res.got.map(s => `${us.nick} sign ${s.player.slot} ${s.player.name}: ${deal(FR, s.deal)}.`),
    ...res.lost.map(s => `${s.player.name} turned the ${us.nick} down: ${s.why} (${deal(FR, s.deal)}).`),
    ...res.league.slice(0, 10).map(s => `${s.player.slot} ${s.player.name} (${s.player.ovr}) to the ${s.team.nick}: ${s.why}.`),
  ]
  const advance = () => {
    const before = v, tx = lastTx, last = v.round >= 3
    if (last) { move(f => FR.advanceFA(f), `FREE AGENCY · ${up(v.roundName)}`, 'Nobody signed in the last round.', next => lines(outcome(before, tx, next, before.roundName))); return }
    const next = move(f => FR.advanceFA(f))
    if (!next || next.flash?.ok === false) return
    const res = safe(() => outcome(before, tx, next, before.roundName))
    // (the engine clears every offer when a round resolves: an offer a man has not answered stands for the next one)
    for (const p of res?.waiting ?? []) act(f => FR.bidFreeAgent(f, p.id, p.bid))
    setResults(res); setTab('market')
  }
  // DELEGATE: the staff makes the offers for what is left of free agency (advanceStage's auto) and the stage ends
  const hand = () => { const before = v, tx = lastTx; move(f => FR.advanceStage(f, { auto: true, once: true }), 'THE STAFF RAN FREE AGENCY', 'Nobody signed.', next => lines(outcome(before, tx, next, before.roundName)).slice(0, 14)) }

  const shown = byPos(tab === 'offers' ? mine : v.players, pos)
  const cols = [
    { k: 'slot', label: 'POS', w: 42, cls: 'fr-t-pos', val: p => p.slot },
    { k: 'name', label: 'PLAYER', val: p => p.name, render: p => <Who name={p.name} tag={p.bid ? (p.leader ? 'LEADING' : 'OFFER') : null} tagOut={!!p.bid && !p.leader} sub={`AGE ${p.age}${p.from ? ` · ${p.from.short}` : ''}`} /> },
    { k: 'ovr', label: 'OVR', w: 38, align: 'r', cls: 'fr-t-num', val: p => p.ovr },
    { k: 'ask', label: 'ASKS', w: 70, align: 'r', val: p => p.ask.perYear, render: p => <span className="fr-t-num">{money(p.ask.perYear)}<small className="fro-t-sub">{plural(p.ask.years, 'YR')}</small></span> },
    { k: 'in', label: 'CLUBS', w: 46, align: 'r', cls: 'fr-t-num', title: 'Clubs in on him', val: p => p.suitors },
    { k: 'fit', label: 'FIT', w: 36, align: 'r', cls: 'fr-t-num', title: 'How he fits this club', val: p => p.fit },
  ]
  const signedCols = [
    { k: 'name', label: 'PLAYER', val: s => s.player.name, render: s => <Who name={s.player.name} sub={`${s.player.slot} · ${s.player.ovr}`} /> },
    { k: 'team', label: 'SIGNED WITH', w: 96, val: s => s.team.short, render: s => <Club t={s.team} /> },
    { k: 'deal', label: 'DEAL', w: 84, align: 'r', val: s => s.deal.perYear, render: s => <span className="fr-t-num">{money(s.deal.perYear)}<small className="fro-t-sub">{plural(s.deal.years, 'YR')}</small></span> },
  ]
  const top = r && <>
    <Panel title="The market" meta={`${up(v.roundName)} · ${plural(r.suitors, 'CLUB')} IN`}>
      <div className="fro-ask">
        <span><small>YEARS</small><b>{r.ask.years}</b></span>
        <span><small>A YEAR</small><b>{money(r.ask.perYear)}</b></span>
        <span><small>GUARANTEED</small><b>{pct(r.ask.guaranteed)}</b></span>
      </div>
      <div className="fr-kv"><span>FIT IN {up(us.city)}</span><b><Bar v={r.fit} team />{r.fit}</b></div>
      {r.from && <div className="fr-kv"><span>LAST CLUB</span><b className="is-text">{r.from.name}</b></div>}
      <Drives FR={FR} drives={r.drives} />
    </Panel>
    <Panel title="The offer" meta={r.bid ? (r.leader ? 'LEADS THE FIELD' : 'BEHIND ANOTHER OFFER') : null}
      action={!r.bid ? <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setDraft(d => ({ ...d, [r.id]: meetAsk(r.ask) })) }}>MEET HIS ASK</button> : null}>
      <OfferPad FR={FR} value={offer} ask={r.ask} room={v.capSpace - out + (r.bid?.perYear ?? 0)} onChange={x => setDraft(d => ({ ...d, [r.id]: x }))} />
    </Panel>
  </>
  const bid = () => { const next = act(f => FR.bidFreeAgent(f, r.id, offer)); if (next?.flash?.ok !== false) setDraft(d => { const { [r.id]: _, ...rest } = d; return rest }) }
  return (
    <Frame main={{ label: ROUND_NEXT[v.round] ?? 'CLOSE FREE AGENCY', onClick: advance }} side={{ label: 'DELEGATE', onClick: hand }}>
      <div className="fro-cap" role="group" aria-label="Free agency">
        <span className="is-lead"><small>CAP ROOM</small><b className={v.capSpace < 0 ? 'fr-t-red' : undefined}>{money(v.capSpace)}</b></span>
        <span><small>OFFERS OUT</small><b>{mine.length ? `${mine.length} · ${money(Math.round(out * 100) / 100)}` : 'NONE'}</b></span>
        <span><small>ROSTER</small><b>{v.rosterCount}/{v.rosterLimit}</b></span>
        <span><small>ROUND {Math.min(3, v.round)} OF 3</small><b>{up(v.roundName)}</b></span>
      </div>
      {needs.length > 0 && (
        <div className="fro-needs" role="group" aria-label="Needs">
          <small>NEEDS</small>
          {needs.map(n => <span key={n.slot} className={n.level >= 3 ? 'is-urgent' : undefined}><b>{n.slot}</b><em>{n.word}</em></span>)}
        </div>
      )}
      {results && (
        <Panel title={`${results.roundName}: who signed`} className="fro-report" action={<button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setResults(null) }}>CLOSE</button>}>
          {results.got.map(s => <Result key={s.player.id} FR={FR} s={s} word="SIGNED" mine />)}
          {results.lost.map(s => <Result key={s.player.id} FR={FR} s={s} word="LOST" />)}
          {results.waiting.map(p => (
            <div key={p.id} className="fro-res"><Logo team={F.team} size={28} /><span>{p.slot} {p.name}<small>No decision yet. The offer stands for the next round.</small></span><em>WAITING</em></div>
          ))}
          {(results.got.length + results.lost.length + results.waiting.length > 0) && results.league.length > 0 && <Sub>AROUND THE LEAGUE</Sub>}
          {results.league.slice(0, 12).map(s => <Result key={s.player.id} FR={FR} s={s} />)}
          {!results.got.length && !results.lost.length && !results.waiting.length && !results.league.length && <div className="fr-empty">NOBODY SIGNED</div>}
        </Panel>
      )}
      <Panel title="Free agents" meta={`${v.players.length} ON THE MARKET`}>
        <Seg label="List" value={tab} onChange={setTab} options={[['market', 'THE MARKET'], ['offers', `MY OFFERS${mine.length ? ` · ${mine.length}` : ''}`], ['signed', 'SIGNINGS']]} />
        {tab !== 'signed' && <PosFilter value={pos} onChange={setPos} />}
        {tab === 'signed'
          ? <FrTable className="fro-fixed" cols={signedCols} rows={v.signed} rowKey={s => s.player.id} rowClass={s => (s.mine ? 'is-mine' : null)} label="Signings" empty="NO ONE HAS SIGNED YET" />
          : <FrTable key={tab} className="fro-fixed" cols={cols} rows={shown} sort={{ k: 'ovr', desc: true }} onRow={p => setPid(p.id)} rowClass={p => (p.bid ? 'is-mine' : null)} label="Free agents"
            empty={tab === 'offers' ? 'NO OFFERS OUT' : 'NO ONE AT THIS POSITION'} />}
      </Panel>
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} top={top} seasonLabel={`${o.year} season`}
        foot={r ? <>
          {r.bid && <button className="fr-btn fr-btn--line" onClick={() => { tap(); act(f => FR.withdrawBid(f, r.id)) }}>WITHDRAW</button>}
          <button className="fr-btn" onClick={bid}>{r.bid ? 'CHANGE THE OFFER' : 'MAKE THE OFFER'}</button>
        </> : null} />
    </Frame>
  )
}
function Result({ FR, s, word = null, mine = false }) {
  return (
    <div className={`fro-res${mine ? ' is-mine' : ''}`}>
      <Logo team={s.team.short} size={28} />
      <span>{s.player.slot} {s.player.name} <i>{s.player.ovr}</i><small>{up(s.team.nick)} · {deal(FR, s.deal)} · {s.why}</small></span>
      {word && <em>{word}</em>}
    </div>
  )
}
