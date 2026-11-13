import { useRef, useState } from 'react'
import { Panel, FrTable, FrMeters, useWide } from '../frUi'
import { Frame, useOff } from './frame'
import { CapStrip, OfferPad, Drives, PlayerSheet, Who, meetAsk, safe, up, plural, pct, signed, tap } from './offUi'

// OFFSEASON 4 · RE-SIGN (the engine's expiring / openTalks / makeOffer / tagPlayer / exerciseOption / letWalk).
// The club's expiring deals in a table; a row opens the talks: PATIENCE and INTEREST, his ask and what drives him,
// the offer (years, money a year, the guaranteed share), and what each offer did. The franchise tag (one a year)
// and a first-round pick's fifth-year option sit beside the talks. The cap is always in view.
// Whoever is still open when the stage ends is the staff's call (the engine keeps the ones worth their ask).

const status = r => (r.decided === 'signed' ? 'SIGNED' : r.decided === 'tagged' ? 'TAGGED' : r.decided === 'option' ? 'OPTION' : r.decided === 'walk' ? (r.optionOnly ? 'DECLINED' : 'WALKS') : r.talks ? 'IN TALKS' : r.optionOnly ? '5TH YEAR' : 'OPEN')
const terms = (FR, o) => `${plural(o.years, 'YR')} · ${FR.moneyText(o.perYear)} · ${pct(o.guaranteed)}`

export default function Resign() {
  const { FR, F, o, act, move } = useOff()
  const rows = o.view, money = FR.moneyText
  const wide = useWide()
  const [pid, setPid] = useState(null)
  const [draft, setDraft] = useState({})          // pid → the offer on the pad
  const log = useRef({})                          // pid → [{ offer, reaction, text, dI, dP }] (this sitting)
  const [, bump] = useState(0)
  const r = rows.find(x => x.id === pid) ?? null
  const room = safe(() => FR.capSheet(F).space, 0)
  const open = rows.filter(x => !x.decided).length
  const T = r?.talks ?? null
  const offer = r ? draft[r.id] ?? (T?.last?.offer ?? meetAsk(r.ask)) : null
  const openRow = x => {
    setPid(x.id)
    if (!x.decided && !x.optionOnly && !x.talks) act(f => FR.openTalks(f, x.id))
  }
  const send = () => {
    const was = { i: T?.interest ?? 0, p: T?.patience ?? 0 }
    const next = act(f => FR.makeOffer(f, r.id, offer))
    const t = next?.flash?.talks
    if (next?.flash?.ok && t) { (log.current[r.id] ??= []).push({ offer: t.last.offer, reaction: t.last.reaction, text: t.last.text, dI: t.interest - was.i, dP: t.patience - was.p, wasI: was.i, wasP: was.p }); bump(n => n + 1) }
  }
  const said = r ? log.current[r.id] ?? [] : []
  const lastMove = said[said.length - 1] ?? null
  const cols = [
    { k: 'slot', label: 'POS', w: 44, cls: 'fr-t-pos', val: x => x.slot },
    { k: 'name', label: 'PLAYER', val: x => x.name, render: x => <Who name={x.name} tag={x.built ? 'BUILT' : null} sub={`AGE ${x.age}${wide && x.line ? ` · ${x.line}` : ''}`} /> },
    { k: 'ovr', label: 'OVR', w: 40, align: 'r', cls: 'fr-t-num', val: x => x.ovr },
    { k: 'ask', label: 'ASKS', w: 78, align: 'r', val: x => (x.optionOnly ? x.option.cost : x.ask.perYear), render: x => <span className="fr-t-num">{money(x.optionOnly ? x.option.cost : x.ask.perYear)}<small className="fro-t-sub">{x.optionOnly ? 'OPTION' : plural(x.ask.years, 'YEAR')}</small></span> },
    { k: 'st', label: 'STATUS', w: 72, align: 'r', cls: 'fr-t-lab', val: x => status(x), render: x => <span className={x.decided === 'walk' ? 'fr-t-dim' : x.decided ? undefined : 'fro-due'}>{status(x)}</span> },
  ]
  const top = r && (
    r.optionOnly ? (
      <Panel title="Fifth-year option" meta={r.decided ? status(r) : 'A FIRST-ROUND PICK'}>
        <div className="fr-kv"><span>THE FIFTH YEAR</span><b>{money(r.option.cost)}</b></div>
        <div className="fr-kv"><span>HIS MARKET VALUE</span><b>{money(r.market)}</b></div>
        <div className="fr-kv"><span>CAP ROOM</span><b>{money(room)}</b></div>
        {!r.decided && (
          <div className="fro-btns">
            <button className="fr-btn fr-btn--sm" onClick={() => act(f => FR.exerciseOption(f, r.id), { say: true })}>EXERCISE IT</button>
            <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => act(f => FR.letWalk(f, r.id))}>DECLINE</button>
          </div>
        )}
      </Panel>
    ) : <>
      {T && <FrMeters a={{ label: 'PATIENCE', value: T.patience, was: lastMove ? lastMove.wasP : null }} b={{ label: 'INTEREST', value: T.interest, was: lastMove ? lastMove.wasI : null, team: true }} />}
      {r.decided && (
        <Panel title={r.decided === 'signed' ? 'Signed' : r.decided === 'tagged' ? 'Franchise tag' : 'The talks are over'}>
          <p className="fro-line">{T?.last?.text ?? (r.decided === 'tagged' ? `One year at ${money(r.salary)}.` : r.decided === 'walk' ? `${r.name} will test the market.` : `${plural(r.yrs, 'year')} at ${money(r.salary)} a year.`)}</p>
        </Panel>
      )}
      {!r.decided && <>
        <Panel title="His ask" meta={`MARKET ${money(r.market)}`}>
          <div className="fro-ask">
            <span><small>YEARS</small><b>{r.ask.years}</b></span>
            <span><small>A YEAR</small><b>{money(r.ask.perYear)}</b></span>
            <span><small>GUARANTEED</small><b>{pct(r.ask.guaranteed)}</b></span>
          </div>
          <Drives FR={FR} drives={r.drives} />
        </Panel>
        <Panel title="The offer" action={<button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setDraft(d => ({ ...d, [r.id]: meetAsk(r.ask) })) }}>MEET HIS ASK</button>}>
          <OfferPad FR={FR} value={offer} ask={r.ask} room={room} onChange={v => setDraft(d => ({ ...d, [r.id]: v }))} />
        </Panel>
      </>}
      {said.length > 0 && (
        <Panel title="The talks" meta={plural(said.length, 'OFFER')}>
          {said.map((m, i) => (
            <div key={i} className="fro-talk">
              <i>{i + 1}</i>
              <span>{terms(FR, m.offer)}<small>{m.text}</small></span>
              <em><b>{up(m.reaction)}</b>INT {signed(m.dI)} · PAT {signed(m.dP)}</em>
            </div>
          ))}
        </Panel>
      )}
      {!r.decided && (
        <Panel title="Other ways">
          <div className="fro-opt">
            <span className="fr-row-main">FRANCHISE TAG<small>ONE YEAR · {money(r.tagCost)} · ONE TAG A YEAR</small></span>
            <button className="fr-btn fr-btn--line fr-btn--sm" disabled={!r.canTag} onClick={() => act(f => FR.tagPlayer(f, r.id), { say: true })}>{r.canTag ? 'TAG HIM' : 'USED'}</button>
          </div>
          <div className="fro-opt">
            <span className="fr-row-main">LET HIM WALK<small>HE REACHES FREE AGENCY</small></span>
            <button className="fr-btn fr-btn--danger fr-btn--sm" onClick={() => act(f => FR.letWalk(f, r.id))}>LET HIM GO</button>
          </div>
        </Panel>
      )}
    </>
  )
  return (
    <Frame main={{ label: 'TO FREE AGENCY', onClick: () => move(f => FR.advanceStage(f)) }}
      side={{ label: 'DELEGATE', onClick: () => move(f => FR.advanceStage(f), 'THE STAFF RE-SIGNED', 'The staff let every expiring deal run out.') }}>
      <CapStrip FR={FR} F={F} />
      <Panel title="Expiring deals" meta={rows.length ? `${open} OPEN OF ${rows.length}` : null}>
        <FrTable className="fro-fixed" cols={cols} rows={rows} sort={{ k: 'ovr', desc: true }} onRow={openRow} rowClass={x => (x.decided ? 'is-settled' : null)} label="Expiring deals" empty="NO DEALS ARE UP THIS YEAR" />
      </Panel>
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} top={top} seasonLabel={`${o.year} season`}
        foot={r && !r.decided && !r.optionOnly ? <button className="fr-btn" disabled={!T} onClick={send}>OFFER {terms(FR, offer)}</button> : null} />
    </Frame>
  )
}
