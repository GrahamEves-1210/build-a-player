import { useEffect, useMemo, useRef, useState } from 'react'
import { Panel, FrTable, FrSheet, FrSheetHead, Confirm, Logo, useWide } from '../frUi'
import { teamOf, FR_TEAMS } from '../frTeams'
import { Frame, useOff } from './frame'
import { PlayerSheet, PosFilter, Who, Bar, Pips, Sub, Fact, byPos, safe, up, plural, height, tap } from './offUi'

// OFFSEASON 6 · THE DRAFT (the engine's draftBoard / draftView / draftPick / simToMyPick / autoDraft /
// scoutProspect, and answerOffer / tradeVerdict / proposeTrade for picks). Two screens on one engine stage:
//   THE COMBINE   the numbers (the engine runs it as the stage opens: everyone a level better scouted)
//   THE WAR ROOM  the clock, the GM's picks, the ticker, offers for his pick, the club's needs, the board
// A pick comes in on a beat: the picks the engine made since the screen last caught up are shown one at a time
// (a tap, the main button or Reduce Motion shows them at once). Nothing is rolled here: the order is the engine's.

const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const f2 = v => (v == null ? '' : Number(v).toFixed(2))
const DRILLS = [['forty', '40-YARD DASH', f2, 1], ['bench', 'BENCH PRESS', v => `${v}`, -1], ['cone', 'THREE-CONE', f2, 1], ['vert', 'VERTICAL', v => `${v}"`, -1]]
// a call on the phone, said the way a GM says it: "pick No. 23 (Round 1) in this draft" is No. 23
const phoneText = t => String(t ?? '').replace(/pick No\. (\d+) \(Round \d+\) in this draft/g, 'No. $1').replace(/, ([^,]+) for /, ' and $1 for ')
const PROJ_SHORT = { 'Round 1': 'RD 1', 'Round 2': 'RD 2', 'Round 3': 'RD 3', 'Rounds 4-5': 'RD 4-5', 'Rounds 6-7': 'RD 6-7', Undrafted: 'UDFA' }

function Range({ lo, hi, min = 55, max = 99 }) {
  const a = (lo - min) / (max - min) * 100, b = (hi - min) / (max - min) * 100
  return <i className="fro-range"><u style={{ left: `${Math.max(0, a)}%`, width: `${Math.max(3, Math.min(100, b) - Math.max(0, a))}%` }} /></i>
}

// ── a prospect's sheet ──────────────────────────────────────────────────────
export function ProspectSheet({ FR, p, pts = 0, onClose, onScout = null, foot = null, staff = false }) {
  const kept = useRef(null); if (p) kept.current = p
  const c = p ?? kept.current
  return (
    <FrSheet open={!!p} onClose={onClose} label={c?.name} foot={p ? foot : null}
      head={c && <FrSheetHead name={c.name} photo={FR.photoUrl(c.photo)} line={[c.slot, up(c.college), `AGE ${c.age}`].filter(Boolean).join(' · ')} big={c.rank} bigLabel="BOARD" />}>
      {c && <>
        <Panel title="The grade" meta={up(c.proj)}>
          <div className="fro-grade-range"><b>{c.range.text}</b><Range lo={c.range.lo} hi={c.range.hi} /></div>
          <div className="fr-kv"><span>SCOUTED</span><b className="is-text"><Pips n={c.scouted} label={`Scouted ${c.scouted} of 3`} /></b></div>
          {staff && <div className="fr-kv"><span>THE STAFF</span><b className="is-text">Would take him here</b></div>}
          {onScout && (
            <div className="fro-opt">
              <span className="fr-row-main">SEND THE SCOUTS<small>{c.scouted >= 3 ? 'NOTHING MORE TO LEARN' : `${plural(pts, 'POINT')} IN HAND · NARROWS THE RANGE`}</small></span>
              <button className="fr-btn fr-btn--line fr-btn--sm" disabled={c.scouted >= 3 || pts < 1} onClick={() => { tap(); onScout(c.id) }}>1 POINT</button>
            </div>
          )}
        </Panel>
        <Panel title="Measurables">
          <div className="fro-meas">
            <span><small>HEIGHT</small><b>{height(c.ht) ?? '—'}</b></span>
            <span><small>WEIGHT</small><b>{c.wt ?? '—'}</b></span>
            {DRILLS.map(([k, label, fmt]) => <span key={k}><small>{k === 'forty' ? '40' : k === 'cone' ? 'CONE' : up(k)}</small><b>{c.combine ? fmt(c.combine[k]) : '—'}</b></span>)}
          </div>
        </Panel>
        <Panel title="Ratings" meta={c.traits ? 'WHAT THE SCOUTS SEE' : 'NOT SCOUTED YET'}>
          {c.traits ? c.traits.map(t => (
            <div key={t.key} className="fro-trait"><span>{up(t.label)}</span><b>{t.loGrade === t.hiGrade ? t.loGrade : `${t.loGrade} to ${t.hiGrade}`}</b><Range lo={t.lo} hi={t.hi} min={0} max={11} /></div>
          )) : <p className="fr-note">Two looks from the scouts bring his ratings in.</p>}
        </Panel>
      </>}
    </FrSheet>
  )
}

// ── the phones: picks for picks ─────────────────────────────────────────────
function Phones({ FR, F, v, open, onClose, act }) {
  const next = v.order.find(x => !x.done && !x.mine)
  const [to, setTo] = useState(next?.team.short ?? FR_TEAMS.find(t => t.short !== F.team).short)
  const [give, setGive] = useState([])
  const [get, setGet] = useState([])
  const mine = useMemo(() => (open ? safe(() => FR.tradeAssets(F, F.team).picks, []) : []), [FR, F, open])
  const theirs = useMemo(() => (open ? safe(() => FR.tradeAssets(F, to).picks, []) : []), [FR, F, to, open])
  const offer = { from: F.team, to, give: { players: [], picks: give.filter(k => mine.some(p => p.key === k)) }, get: { players: [], picks: get.filter(k => theirs.some(p => p.key === k)) } }
  const ready = offer.give.picks.length > 0 && offer.get.picks.length > 0
  const verdict = useMemo(() => (open && ready ? safe(() => FR.tradeVerdict(F, offer)) : null), [FR, F, open, ready, to, give.join(), get.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  // where a pick in this draft falls, when the order makes it certain (one pick left for that club in that round)
  const slotOf = (pk, holder) => { if (pk.when !== 'the next draft') return null; const left = v.order.filter(x => !x.done && x.team.short === holder && x.round === pk.round); return left.length === 1 ? left[0].overall : null }
  const flip = (set, k) => set(list => (list.includes(k) ? list.filter(x => x !== k) : [...list, k]))
  const send = o => { const n = act(f => FR.proposeTrade(f, o), { say: true }); if (n?.flash?.accepted) { setGive([]); setGet([]); onClose() } }
  const list = (picks, holder, on, set) => picks.map(pk => {
    const n = slotOf(pk, holder)
    return (
      <button key={pk.key} className={`fr-row fr-pick${on.includes(pk.key) ? ' is-on' : ''}`} aria-pressed={on.includes(pk.key)} onClick={() => { tap(); flip(set, pk.key) }}>
        <span className="fr-pick-box" />
        <span className="fr-row-main">{pk.text}{n && <small>NO. {n} OVERALL</small>}</span>
        <b className="fr-t-num">{pk.value}</b>
      </button>
    )
  })
  const t = teamOf(to)
  return (
    <FrSheet open={open} onClose={onClose} label="Trade picks"
      head={<span className="fr-sheet-who"><b>THE PHONES</b><small>PICKS FOR PICKS · {up(t.name)}</small></span>}
      foot={<>
        {verdict?.counter && !verdict.ok && <button className="fr-btn fr-btn--line" onClick={() => send(verdict.counter)}>TAKE THEIR COUNTER</button>}
        <button className="fr-btn" disabled={!ready} onClick={() => send(offer)}>SEND THE OFFER</button>
      </>}>
      <Panel title="The other club" meta={t.short}>
        <div className="fro-clubs">
          {FR_TEAMS.filter(x => x.short !== F.team).map(x => <button key={x.short} className={x.short === to ? 'is-on' : undefined} onClick={() => { tap(); setTo(x.short); setGet([]) }}>{x.short}</button>)}
        </div>
      </Panel>
      {verdict && (
        <Panel title="Their answer" meta={verdict.ok ? 'THEY WOULD DO IT' : 'NOT AS IT STANDS'}>
          <p className="fro-line">{verdict.answer}</p>
          <div className="fr-kv"><span>WHAT THEY GET, BY THEIR CHART</span><b>{verdict.give}</b></div>
          <div className="fr-kv"><span>WHAT THEY GIVE</span><b>{verdict.get}</b></div>
        </Panel>
      )}
      <Panel title={`${t.nick} send`} meta="CHART VALUE">
        {list(theirs, to, get, setGet)}
        {!theirs.length && <div className="fr-empty">NO PICKS TO GIVE</div>}
      </Panel>
      <Panel title={`${teamOf(F.team).nick} send`} meta="CHART VALUE">
        {list(mine, F.team, give, setGive)}
        {!mine.length && <div className="fr-empty">NO PICKS TO GIVE</div>}
      </Panel>
    </FrSheet>
  )
}

// ── the combine ─────────────────────────────────────────────────────────────
function Combine({ FR, board, onOpen }) {
  const wide = useWide()
  const [pos, setPos] = useState('all')
  const all = board.prospects.filter(p => p.combine)
  const rows = byPos(all, pos)
  const best = DRILLS.map(([k, label, fmt, dir]) => ({ k, label, fmt, top: [...rows].sort((a, b) => (a.combine[k] - b.combine[k]) * dir || a.rank - b.rank).slice(0, 5) }))
  const num = (k, label, fmt, w, dir) => ({ k, label, w, align: 'r', cls: 'fr-t-num', desc: dir < 0, val: p => p.combine[k], render: p => fmt(p.combine[k]) })
  const cols = [
    { k: 'rank', label: 'RK', w: 38, cls: 'fro-t-rk', val: p => p.rank, desc: false },
    { k: 'slot', label: 'POS', w: 42, cls: 'fr-t-pos', val: p => p.slot },
    { k: 'name', label: 'PROSPECT', val: p => p.name, render: p => <Who name={p.name} sub={up(p.college)} /> },
    ...(wide ? [{ k: 'ht', label: 'HT', w: 56, align: 'r', cls: 'fr-t-lab', val: p => p.ht ?? 0, render: p => height(p.ht) ?? '—' }, { k: 'wt', label: 'WT', w: 52, align: 'r', cls: 'fr-t-lab', val: p => p.wt ?? 0, render: p => p.wt ?? '—' }] : []),
    num('forty', '40', f2, 46, 1), num('bench', wide ? 'BENCH' : 'BN', v => v, wide ? 60 : 34, -1), num('cone', 'CONE', f2, 46, 1), num('vert', wide ? 'VERT' : 'VT', v => v, wide ? 56 : 34, -1),
    ...(wide ? [{ k: 'grade', label: 'GRADE', w: 96, align: 'r', cls: 'fr-t-lab', val: p => (p.range.lo + p.range.hi) / 2, render: p => p.range.text }] : []),
  ]
  return <>
    <Panel title="What the combine showed" meta={`${all.length} PROSPECTS`}>
      <Fact label="THE BOARD">Every prospect is a level better scouted, and the numbers are in. {plural(board.pts, 'scouting point')} in hand for the war room.</Fact>
      <PosFilter value={pos} onChange={setPos} />
      <div className="fro-best">
        {best.map(d => (
          <div key={d.k}>
            <Sub>{d.label}</Sub>
            {d.top.map((p, i) => (
              <button key={p.id} className="fro-best-row" onClick={() => { tap(); onOpen(p.id) }}>
                <i>{i + 1}</i><span>{p.name}<small>{p.slot} · {up(p.college)}</small></span><b>{d.fmt(p.combine[d.k])}</b>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Panel>
    <Panel title="Results" meta={pos === 'all' ? 'EVERY POSITION' : up(pos)}>
      <FrTable key={pos} className="fro-fixed" cols={cols} rows={rows} sort={{ k: 'rank', desc: false }} onRow={p => onOpen(p.id)} label="Combine results" empty="NO ONE AT THIS POSITION" />
    </Panel>
  </>
}

export default function Draft() {
  const { FR, F, o, act, move, dropReport } = useOff()
  const v = o.view, board = v.board, us = teamOf(F.team)
  const wide = useWide()
  const made = v.done ? v.order.length : v.overall - 1
  const [room, setRoom] = useState(made > 0 || v.done)
  const [pos, setPos] = useState('all')
  const [sel, setSel] = useState(null)          // the prospect the GM has his eye on
  const [open, setOpen] = useState(null)        // the prospect whose sheet is up
  const [pid, setPid] = useState(null)          // a drafted player's sheet
  const [phones, setPhones] = useState(false)
  const [ask, setAsk] = useState(false)
  // the beat: how many picks the screen has shown
  const [shown, setShown] = useState(made)
  const settled = useRef(made)                  // where the screen stood before the picks now coming in
  useEffect(() => {
    if (shown >= made) { if (shown > made) setShown(made); settled.current = made; return }
    if (reduced()) { setShown(made); return }
    const left = made - shown
    if (left > 44) { setShown(made - 32); return }
    // (the GM's own pick is held on the band a moment longer)
    const mineUp = shown > settled.current && v.order[shown - 1]?.mine
    const id = setTimeout(() => setShown(n => n + 1), mineUp ? 1700 : left > 16 ? 110 : left > 6 ? 260 : 520)
    return () => clearTimeout(id)
  }, [shown, made]) // eslint-disable-line react-hooks/exhaustive-deps
  const live = shown < made
  const catchUp = () => setShown(made)
  const inPick = live && shown > settled.current ? v.order[shown - 1] : null   // the pick that just came in

  const prospects = board.prospects
  const p = prospects.find(x => x.id === open) ?? null
  const picked = sel != null && prospects.some(x => x.id === sel) ? sel : null
  const target = prospects.find(x => x.id === (picked ?? v.staffPick)) ?? null
  const offers = useMemo(() => (v.mine && v.offers.length ? safe(() => FR.tradeBlock(F).offers, []).filter(x => v.offers.some(y => y.id === x.id)) : []), [FR, F, v])
  const mineLeft = v.myPicks.filter(x => !x.used)
  const clock = live ? v.order[shown] : null
  const on = clock ? clock.team : v.onClock
  const onMine = clock ? clock.mine : v.mine
  const at = clock ?? (v.done ? null : { round: v.round, overall: v.overall })
  const ticker = v.order.filter(x => x.done && x.overall <= shown).slice(-(wide ? 14 : live || v.done ? 5 : 3)).reverse()
  const roster = useMemo(() => (v.done ? Object.fromEntries(safe(() => FR.roster(F), []).map(r => [r.id, r])) : {}), [FR, F, v.done])

  // the pick an offer sends back, when the order makes it certain (that club's one pick left in that round)
  const pick = id => { const n = act(f => FR.draftPick(f, id)); if (n?.flash?.ok !== false) { setSel(null); setOpen(null) } }
  const hand = () => move(f => FR.advanceStage(f), 'THE STAFF RAN THE DRAFT', 'The club had no picks to make.')
  let main
  if (!room) main = { label: 'TO THE WAR ROOM', onClick: () => { dropReport(); setRoom(true) } }
  else if (live) main = { label: 'SHOW EVERY PICK', onClick: catchUp }
  else if (v.done) main = { label: 'TO THE UNDRAFTED', onClick: () => move(f => FR.advanceStage(f)) }
  else if (v.mine) main = { label: target ? (target.name.length <= 14 ? `DRAFT ${up(target.name)}` : 'MAKE THE PICK') : 'MAKE THE PICK', disabled: !target, onClick: () => pick(target.id) }
  else main = mineLeft.length ? { label: 'SIM TO MY PICK', onClick: () => act(f => FR.simToMyPick(f)) } : { label: 'SIM THE REST', onClick: () => act(f => FR.autoDraft(f)) }

  const shownRows = byPos(prospects, pos)
  const cols = [
    { k: 'rank', label: 'RK', w: 38, cls: 'fro-t-rk', val: x => x.rank, desc: false },
    { k: 'slot', label: 'POS', w: 42, cls: 'fr-t-pos', val: x => x.slot },
    { k: 'name', label: 'PROSPECT', val: x => x.name, render: x => <Who name={x.name} tag={x.id === v.staffPick ? 'STAFF' : null} sub={`${up(x.college)} · ${PROJ_SHORT[x.proj] ?? up(x.proj)}`} /> },
    ...(wide ? [
      { k: 'age', label: 'AGE', w: 40, align: 'r', cls: 'fr-t-lab', val: x => x.age },
      { k: 'ht', label: 'HT', w: 48, align: 'r', cls: 'fr-t-lab', val: x => x.ht ?? 0, render: x => height(x.ht) ?? '—' },
      { k: 'wt', label: 'WT', w: 44, align: 'r', cls: 'fr-t-lab', val: x => x.wt ?? 0, render: x => x.wt ?? '—' },
    ] : []),
    { k: 'forty', label: '40', w: 46, align: 'r', cls: 'fr-t-num', desc: false, val: x => x.combine?.forty ?? 9, render: x => f2(x.combine?.forty) },
    ...(wide ? [{ k: 'sc', label: 'SCOUTED', w: 66, align: 'r', val: x => x.scouted, render: x => <Pips n={x.scouted} /> }] : []),
    { k: 'grade', label: 'GRADE', w: wide ? 92 : 76, align: 'r', cls: 'fr-t-lab', val: x => (x.range.lo + x.range.hi) / 2, render: x => x.range.text },
  ]
  const classCols = [
    { k: 'round', label: 'RD', w: 36, cls: 'fro-t-rk', val: x => x.overall, desc: false, render: x => x.round },
    { k: 'overall', label: 'PICK', w: 46, cls: 'fr-t-num', val: x => x.overall, desc: false },
    { k: 'pos', label: 'POS', w: 42, cls: 'fr-t-pos', val: x => x.pos },
    { k: 'name', label: 'PLAYER', val: x => x.name, render: x => <Who name={x.name} sub={up(x.college)} /> },
    { k: 'ovr', label: 'OVR', w: 40, align: 'r', cls: 'fr-t-num', val: x => roster[x.pid]?.ovr ?? 0, render: x => roster[x.pid]?.ovr ?? '' },
    { k: 'grade', label: 'GRADE', w: 54, align: 'r', cls: 'fr-t-num', val: x => roster[x.pid]?.ovr ?? 0, render: x => roster[x.pid]?.grade ?? '' },
  ]
  const picksPanel = (
      <Panel title="The picks" meta={made ? `${shown} OF ${v.order.length}` : 'NONE YET'} action={live ? <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); catchUp() }}>SHOW ALL</button> : null}>
        {ticker.map((x, i) => (
          <button key={x.overall} className={`fro-tick${x.mine ? ' is-mine' : ''}${i === 0 && live ? ' is-new' : ''}`} onClick={() => { tap(); setPid(x.done.pid) }}>
            <i>{x.overall}</i><Logo team={x.team.short} size={24} />
            <span>{x.done.name}<small>{x.done.pos} · {up(x.done.college ?? '')}</small></span>
            <em>{x.team.short}</em>
          </button>
        ))}
        {!ticker.length && <div className="fr-empty">THE FIRST PICK IS STILL TO COME</div>}
      </Panel>
  )
  return (
    <Frame main={main} side={v.done ? null : { label: 'DELEGATE', onClick: hand }}>
      {!room ? <Combine FR={FR} board={board} onOpen={setOpen} /> : <>
        {inPick?.done ? (
          <section className={`fro-clock is-pick${inPick.mine ? ' is-mine' : ''}`} key={inPick.overall}>
            <Logo team={inPick.team.short} size={52} />
            <span><small>ROUND {inPick.round} · NO. {inPick.overall} · {up(inPick.team.name)}</small><b>{up(inPick.done.name)}</b><em>{inPick.done.pos} · {up(inPick.done.college ?? '')}</em></span>
          </section>
        ) : (
          <section className={`fro-clock${onMine ? ' is-mine' : ''}`}>
            {on && <Logo team={on.short} size={52} />}
            {on && at ? (
              <span><small>ROUND {at.round} · NO. {at.overall} OVERALL</small><b>{up(on.name)}</b><em>{live ? 'THE PICK IS IN' : 'ON THE CLOCK'}</em></span>
            ) : <span><small>SEVEN ROUNDS · {v.order.length} PICKS</small><b>THE DRAFT IS OVER</b><em>{plural(v.class.length, 'PICK')} FOR THE {up(us.nick)}</em></span>}
          </section>
        )}
        <div className="fro-picks" role="group" aria-label={`${us.nick} picks`}>
          <small>{up(us.short)} PICKS</small>
          {v.myPicks.map(x => <span key={x.overall} className={x.used ? 'is-used' : x.overall === mineLeft[0]?.overall ? 'is-next' : undefined}><b>{x.overall}</b><em>RD {x.round}</em></span>)}
          {!v.myPicks.length && <span className="is-used"><em>NONE</em></span>}
        </div>
        {offers.length > 0 && !live && (
          <Panel title="On the phone" meta={`FOR NO. ${v.overall}`} className="fro-report">
            {offers.map(x => (
              <div key={x.id} className="fro-offer">
                <Logo team={x.from} size={28} />
                <p>{phoneText(x.text)}</p>
                <div className="fro-btns">
                  <button className="fr-btn fr-btn--sm" onClick={() => act(f => FR.answerOffer(f, x.id, true), { say: true })}>TRADE DOWN</button>
                  <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => act(f => FR.answerOffer(f, x.id, false))}>NO</button>
                </div>
              </div>
            ))}
          </Panel>
        )}
        {!wide && picksPanel}
        <div className="fr-cols">
          <div className="fr-col">
            {v.done && !live && (
              <Panel title={`The ${us.nick} class`} meta={plural(v.class.length, 'PICK')}>
                <FrTable className="fro-fixed" cols={classCols} rows={v.class} rowKey={x => x.pid} onRow={x => setPid(x.pid)} label="Draft class" empty="NO PICKS WERE MADE" />
              </Panel>
            )}
            {!v.done && (
              <Panel title="The board" meta={`${prospects.length} LEFT · ${plural(board.pts, 'SCOUTING PT')}`}
                action={<button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setPhones(true) }}>THE PHONES</button>}>
                <PosFilter value={pos} onChange={setPos} />
                <FrTable key={pos} className="fro-fixed" cols={cols} rows={shownRows.slice(0, 120)} sort={{ k: 'rank', desc: false }} onRow={x => setOpen(x.id)} rowClass={x => (x.id === picked ? 'is-mine' : null)} label="Draft board" empty="NO ONE LEFT AT THIS POSITION" />
              </Panel>
            )}
          </div>
          <div className="fr-col">
            {wide && picksPanel}
            <Panel title="Needs" meta={up(us.nick)}>
              {board.needs.map(n => <div key={n.group} className="fro-need"><span>{n.group}</span><Bar v={n.need} max={1} team /><b>{n.starter}</b><small>STARTER</small></div>)}
            </Panel>
            {!v.done && (
              <Panel title="The rest of it">
                <div className="fro-opt">
                  <span className="fr-row-main">AUTO-DRAFT THE REST<small>THE STAFF MAKES EVERY {up(us.nick)} PICK FROM HERE</small></span>
                  <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setAsk(true) }}>AUTO-DRAFT</button>
                </div>
              </Panel>
            )}
          </div>
        </div>
      </>}
      <ProspectSheet FR={FR} p={p} pts={board.pts} onClose={() => setOpen(null)} staff={p?.id === v.staffPick} onScout={id => act(f => FR.scoutProspect(f, id))}
        foot={p && room && !v.done ? (v.mine && !live
          ? <button className="fr-btn" onClick={() => pick(p.id)}>DRAFT HIM AT NO. {v.overall}</button>
          : <button className="fr-btn fr-btn--line" onClick={() => { tap(); setSel(picked === p.id ? null : p.id); setOpen(null) }}>{picked === p.id ? 'TAKE HIM OFF THE CARD' : 'PUT HIM ON THE CARD'}</button>) : null} />
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} />
      {room && !v.done && <Phones FR={FR} F={F} v={v} open={phones} onClose={() => setPhones(false)} act={act} />}
      <Confirm open={ask} title="Auto-draft the rest?" yes="AUTO-DRAFT" no="STAY IN THE ROOM" onNo={() => setAsk(false)}
        body={`The staff makes ${mineLeft.length === 1 ? `the ${us.nick}' last pick` : `all ${mineLeft.length} ${us.nick} picks that are left`}, best man on its board with need in mind.`}
        onYes={() => { setAsk(false); act(f => FR.autoDraft(f)) }} />
    </Frame>
  )
}
