import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, SHORTS, depthOrder, coachOrder, photoOf, CAP_SIM, nick, picksOf, pickText, seasonText, teamOvr, ROSTER_MAX, addNews, CONF_OF, careerView } from '../../../lib/franchise2/nba'
import { manPhoto } from './NbaBuilds'
import { sfx, haptic } from '../../../lib/juice'
import { teamWords } from '../../../lib/franchise2/nba/news'
import { fkVars, KLogo, LowerThird, Chyron, Go, BackBar, Tag, Fold, ActionBar } from '../kit'
import { money } from './NbaHub'

// THE TEAM: the rotation (the order the coach plays them in: the first five start), the cap, the two-way men,
// a man's page (his deal, his career, move him in the rotation, waive him) and trades.
const ppg = (F, p, all = false) => { const x = F.ss?.[p.i]; if (!x?.gp) return null; const f = k => (x[k] / x.gp).toFixed(1); return all ? `${f('pts')} PPG · ${f('reb')} RPG · ${f('ast')} APG` : `${f('pts')} PPG · ${p.g === 'big' ? `${f('reb')} RPG` : `${f('ast')} APG`}` }
export const dealText = p => (p.tw ? 'TWO-WAY' : p.y > 0 ? `${money(p.$)} · ${p.y} ${p.y === 1 ? 'YR' : 'YRS'}${p.opt ? ` · ${p.opt.k === 'P' ? 'PLAYER' : 'TEAM'} OPTION` : ''}` : 'DEAL UP')

export default function NbaTeam({ F, act, owner, view, setView }) {
  const [man, setMan] = useState(null)
  if (view === 'trades') return <Trades F={F} act={act} onBack={() => setView(null)} />
  const t = F.teams[F.team]
  const rot = CAP_SIM.rotationOf(F, F.team, { playoff: F.phase === 'playin' || F.phase === 'playoffs' })
  const mins = Object.fromEntries(rot.map(x => [x.i, x.min]))
  const order = coachOrder(F, F.team, CAP_SIM.rotationOf).filter(p => !p.tw)
  const hurt = t.r.filter(p => p.inj?.g && !p.tw)
  const tw = t.r.filter(p => p.tw)
  const canTrade = F.phase === 'off' || (F.phase === 'season' && F.day <= F.ddl)
  return (
    <div className="nb-team">
      <CapBar F={F} />
      {canTrade && <button type="button" className="fh-row" onClick={() => { setView('trades'); sfx('tap') }}><span><small>Trades</small><b>{F.phase === 'season' ? `Deadline ${F.ddl - F.day <= 0 ? 'today' : `in ${F.ddl - F.day} days`}` : 'Open for the summer'}</b></span><i className="fh-row-go" aria-hidden="true">›</i></button>}
      <Chyron team={F.team} title="Rotation" sub={`TEAM OVR ${teamOvr(F, F.team)} · ${t.r.filter(p => !p.tw).length} OF ${ROSTER_MAX} STANDARD`} right={t.rot ? <button type="button" className="nb-auto" onClick={() => act(X => { X.teams[X.team].rot = null })}>AUTO</button> : null} />
      <div className="nb-rot">
        {order.map((p, k) => (
          <div key={p.i} className="nb-rot-row">
            <span className="nb-rot-k">{k < 5 ? 'START' : mins[p.i] ? `${mins[p.i]} MIN` : 'DNP'}</span>
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" mine={p.b != null ? owner : null} line={ppg(F, p) ?? `AGE ${p.ag} · ${dealText(p)}`} onClick={() => { setMan(p.i); sfx('tap') }} />
          </div>
        ))}
        {hurt.map(p => (
          <div key={p.i} className="nb-rot-row is-out">
            <span className="nb-rot-k"><Tag tone="inj">OUT</Tag></span>
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={`${p.inj.k.toUpperCase()} · ${p.inj.g} G`} onClick={() => setMan(p.i)} />
          </div>
        ))}
      </div>
      {tw.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="Two-way contracts" sub={`${tw.length} OF 3`} />
          <div className="nb-rot">{tw.map(p => <LowerThird key={p.i} name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={`AGE ${p.ag} · TWO-WAY`} onClick={() => setMan(p.i)} />)}</div>
        </>
      )}
      <Fold title="Draft picks" right={`${picksOf(F, F.team).filter(p => p.r === 1).length} firsts`}>
        <ul className="nb-picks">{picksOf(F, F.team).map(p => <li key={`${p.y}${p.r}${p.o}`}>{pickText(F, p)}</li>)}</ul>
      </Fold>
      {man != null && <ManSheet F={F} act={act} id={man} owner={owner} onClose={() => setMan(null)} />}
    </div>
  )
}

export function CapBar({ F, s = F.team }) {
  const c = CAP_SIM.capSheet(F, s)
  const holds = F.phase === 'off' ? c.pay - CAP_SIM.payroll(F, s, CAP_SIM.capYear(F), { holds: false }) : 0
  const top = Math.max(c.a2 * 1.06, c.pay * 1.03)
  const at = v => `${Math.min(100, (v / top) * 100)}%`
  const OVER = { under: `${money(c.room)} in cap room`, cap: 'Over the cap', tax: `In the tax · bill ${money(c.bill)}`, a1: `Over the first apron · bill ${money(c.bill)}`, a2: `Over the second apron · bill ${money(c.bill)}` }
  return (
    <section className={`nb-cap is-${c.over}`}>
      <div className="nb-cap-h"><b>{money(c.pay)}</b><span>{F.noCap && s === F.team ? 'No salary cap' : OVER[c.over]}</span></div>
      {holds > 0.05 && <small className="nb-cap-holds">Includes {money(holds)} in cap holds for unsigned free agents</small>}
      <div className="nb-cap-bar" aria-hidden="true">
        <i className="nb-cap-fill" style={{ width: at(c.pay) }} />
        {[['CAP', c.cap], ['TAX', c.tax], ['', c.a1], ['', c.a2]].map(([k, v], i) => <em key={i} style={{ left: at(v) }}>{k && <small>{k}</small>}</em>)}
      </div>
      <div className="nb-cap-k"><span>Cap {money(c.cap)}</span><span>Tax {money(c.tax)}</span><span>Aprons {money(c.a1)} / {money(c.a2)}</span></div>
    </section>
  )
}

function ManSheet({ F, act, id, owner, onClose }) {
  const t = F.teams[F.team]
  const p = t.r.find(x => x.i === id)
  const [sure, setSure] = useState(false)
  if (!p) return null
  const order = coachOrder(F, F.team, CAP_SIM.rotationOf).filter(x => !x.tw)
  const k = order.findIndex(x => x.i === id)
  const move = d => act(X => {
    const ids = coachOrder(X, X.team, CAP_SIM.rotationOf).filter(x => !x.tw).map(x => x.i)
    const j = ids.indexOf(id), to = j + d
    if (j < 0 || to < 0 || to >= ids.length) return
    ;[ids[j], ids[to]] = [ids[to], ids[j]]
    X.teams[X.team].rot = ids
  })
  const cost = CAP_SIM.cutCost(F, p), costS = CAP_SIM.cutCost(F, p, { stretch: true })
  const dead = cost?.total ?? cost?.$ ?? (typeof cost === 'number' ? cost : 0)
  const canStretch = costS && (costS.per ?? costS.$) != null && (costS.years ?? costS.y ?? 0) > (cost?.years ?? cost?.y ?? 0)
  const extOk = CAP_SIM.extensionOk(F, F.team, p)
  const ext = extOk?.ok ? CAP_SIM.extensionAsk(F, F.team, p) : null
  const car = careerView(p)   // (a season split by a trade: a row a team, then TOT)
  return createPortal(
    <div className="ss-overlay nb-sheet-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fk fk-root nb-sheet" role="dialog" aria-label={p.n} style={fkVars(F.team)}>
        <div className="nb-sheet-top"><b>{TEAM[F.team].name}</b><button className="fk-x" onClick={onClose} aria-label="Close">✕</button></div>
        <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="l" mine={p.b != null ? owner : null} line={`AGE ${p.ag} · ${Math.floor(p.ht / 12)}'${p.ht % 12}" · ${p.wt} LBS`} />
        <div className="nb-facts">
          <span><small>Contract</small><b>{dealText(p)}</b></span>
          <span><small>Experience</small><b>{p.ys ? `${p.ys} ${p.ys === 1 ? 'YEAR' : 'YEARS'}` : 'ROOKIE'}</b></span>
          {p.dr && <span><small>Drafted</small><b>{p.dr[0]} · R{p.dr[1]} NO. {p.dr[2]}</b></span>}
          {p.inj?.g && <span><small>Injury</small><b>{p.inj.k} · {p.inj.g} G</b></span>}
        </div>
        {ppg(F, p) && <p className="nb-sheet-line">{seasonText(F.year)}: {ppg(F, p, true)}</p>}
        {ext && <div className="nb-sheet-acts"><button type="button" onClick={() => { const r = act(X => CAP_SIM.extendMan(X, X.team, X.teams[X.team].r.find(x => x.i === id), ext)); if (r?.ok !== false) { act(X => addNews(X, { k: 'ext', tag: 'EXTENSION', s: X.team, text: `${p.n} signs a ${ext.y}-year extension with the ${nick(X.team)}` })); sfx('claim') } else sfx('deny') }}>Extend him: {money(ext.$)} × {ext.y}</button></div>}
        {!p.tw && (
          <div className="nb-sheet-acts">
            <button type="button" disabled={k <= 0} onClick={() => { move(-1); sfx('tap') }}>Move up</button>
            <button type="button" disabled={k < 0 || k >= order.length - 1} onClick={() => { move(1); sfx('tap') }}>Move down</button>
          </div>
        )}
        {car.length > 0 && (
          <div className="bx-scroll"><table className="nb-car">
            <thead><tr><th>SEASON</th><th>TM</th><th>G</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead>
            <tbody>{car.map(c => <tr key={c.y + c.s}><td>{c.y2 ? `${c.y}-${String(c.y2 + 1).slice(2)}` : seasonText(c.y)}</td><td>{c.s || `${c.y2 - c.y + 1} YRS`}</td><td>{c.gp}</td><td>{(c.pts / c.gp).toFixed(1)}</td><td>{(c.reb / c.gp).toFixed(1)}</td><td>{(c.ast / c.gp).toFixed(1)}</td></tr>)}</tbody>
          </table></div>
        )}
        <div className="nb-sheet-acts">
          {!sure ? <button type="button" className="is-danger" onClick={() => setSure(true)}>Waive him</button>
            : <><span className="nb-sure">{dead > 0 ? `${money(dead)} stays on the books` : 'Waive him?'}</span><button type="button" onClick={() => setSure(false)}>Keep</button>
              <button type="button" className="is-danger" onClick={() => { act(X => { CAP_SIM.cutMan(X, X.team, id); addNews(X, { k: 'cut', tag: 'WAIVED', s: X.team, text: `The ${nick(X.team)} have waived ${p.n}` }) }); sfx('deny'); onClose() }}>Waive</button>
              {canStretch && <button type="button" className="is-danger" onClick={() => { act(X => { CAP_SIM.cutMan(X, X.team, id, { stretch: true }); addNews(X, { k: 'cut', tag: 'WAIVED', s: X.team, text: `The ${nick(X.team)} have waived and stretched ${p.n}` }) }); sfx('deny'); onClose() }}>Waive and stretch</button>}</>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── TRADES ───────────────────────────────────────────────────────────────────
// pick a team; the deal on top (what each side sends, the salaries), one side's men and picks at a time under it;
// the league office checks it (salary matching, the aprons, the Stepien rule: cap.js), then the other GM answers
function Trades({ F, act, onBack }) {
  const [them, setThem] = useState(null)
  const [side, setSide] = useState(0)
  const [ga, setGa] = useState([]), [gb, setGb] = useState([]), [pa, setPa] = useState([]), [pb, setPb] = useState([])
  const [ans, setAns] = useState(null)
  const deal = them ? { a: F.team, b: them, ga, gb, pa, pb } : null
  const any = ga.length + gb.length + pa.length + pb.length > 0
  const chk = useMemo(() => (deal && any ? CAP_SIM.checkTrade(F, deal) : null), [F, them, ga, gb, pa, pb]) // eslint-disable-line react-hooks/exhaustive-deps
  const tog = (arr, set, v) => { set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]); setAns(null); sfx('tap') }
  const reset = () => { setGa([]); setGb([]); setPa([]); setPb([]); setAns(null) }
  if (!them) {
    return (
      <div className="nb-trades">
        <BackBar label="Team" title="Trades" onBack={onBack} />
        <Chyron tone="ink" size="s" title="Pick a trade partner" />
        <div className="nb-wall">
          {SHORTS.filter(s => s !== F.team).map(s => <button key={s} type="button" className="fsu-tm" style={fkVars(s)} onClick={() => { setThem(s); setSide(1); sfx('tap') }} aria-label={TEAM[s].name}><KLogo s={s} size={40} /><small>{s}</small></button>)}
        </div>
      </div>
    )
  }
  const men = s => F.teams[s].r.filter(p => !p.tw)
  const pickIdx = s => (F.picks ?? []).map((p, i) => [p, i]).filter(([p]) => p.t === s && p.y > F.year)
  const S = [[F.team, ga, setGa, pa, setPa], [them, gb, setGb, pb, setPb]]
  const [s0, sel, set, psel, pset] = S[side]
  const sum = (s, ids) => ids.reduce((x, i) => x + (men(s).find(p => p.i === i)?.$ ?? 0), 0)
  const list = (s, ids, pids) => [...ids.map(i => men(s).find(p => p.i === i)?.n), ...pids.map(i => pickText(F, F.picks[i]))].filter(Boolean)
  const done = r => { for (const x of r?.news ?? []) addNews(F, x); setGa([]); setGb([]); setPa([]); setPb([]); sfx('claim'); haptic('success') }
  const ask = () => {
    const r = act(X => CAP_SIM.proposeTrade(X, deal))
    setAns(r)
    if (r?.ok) done(r); else sfx('deny')
  }
  const takeCounter = () => {
    const c = ans?.counter
    if (!c || !CAP_SIM.checkTrade(F, c).ok) return
    const r = act(X => CAP_SIM.doTrade(X, c))
    setAns({ ok: true, say: 'yes', text: `Deal done on the ${TEAM[them].nick}' terms` })
    done(r)
  }
  const g = any && chk?.ok ? CAP_SIM.gauge(F, deal) : null
  return (
    <div className="nb-trades">
      <BackBar label="Teams" title={`Trade with the ${TEAM[them].nick}`} onBack={() => { setThem(null); reset() }} />
      <section className="nb-deal">
        {S.map(([s, ids, , pids], k) => (
          <div key={s} className="nb-deal-side" style={fkVars(s)}>
            <span className="nb-deal-h"><KLogo s={s} size={22} /><b>{TEAM[s].nick} send</b><em>{money(sum(s, ids))}</em></span>
            <p>{list(s, ids, pids).join(', ') || 'Nothing yet'}</p>
          </div>
        ))}
      </section>
      <div className="nb-by" role="tablist">
        {S.map(([s], k) => <button key={s} type="button" role="tab" aria-selected={side === k} className={side === k ? 'is-on' : ''} onClick={() => { setSide(k); sfx('tap') }}>{TEAM[s].nick}</button>)}
      </div>
      <section className="nb-tside">
        {men(s0).sort((x, y) => y.o - x.o).map(p => {
          const no = CAP_SIM.whyNot(F, s0, p)
          return (
            <button key={p.i} type="button" disabled={!!no} className={`nb-tman${sel.includes(p.i) ? ' is-on' : ''}`} onClick={() => tog(sel, set, p.i)}>
              <b>{p.n}</b><span>{p.p} · {p.o} · {p.ag}</span><em>{no ? teamWords(no) : dealText(p)}</em>
            </button>
          )
        })}
        <Fold title="Draft picks" right={`${psel.length || ''}`}>{pickIdx(s0).map(([p, i]) => <button key={i} type="button" className={`nb-tman${psel.includes(i) ? ' is-on' : ''}`} onClick={() => tog(psel, pset, i)}><b>{pickText(F, p)}</b></button>)}</Fold>
      </section>
      <ActionBar className="nb-tact">
        {g && <div className="nb-gauge" aria-label="How the offer looks to them"><span>Your side</span><i><b style={{ left: `${50 + g.lean * 50}%` }} /></i><span>Their side</span></div>}
        {chk && !chk.ok && <p className="nb-why">{teamWords(chk.why)}</p>}
        {ans && !ans.ok && <p className="nb-why">{teamWords(ans.text ?? `The ${TEAM[them].nick} pass`)}</p>}
        {ans?.counter && <div className="nb-counter"><p>{counterText(F, ans.counter)}</p><button type="button" className="nb-tman is-on" onClick={takeCounter}>Take the counter</button></div>}
        {ans?.ok && <p className="nb-ok">{teamWords(ans.text ?? 'Deal done')}</p>}
        <Go disabled={!chk?.ok} onClick={ask}>Propose the trade</Go>
      </ActionBar>
    </div>
  )
}

// a counter, the way the other GM says it: what they'd send and what they want back
function counterText(F, c) {
  const nm = (s, ids) => ids.map(i => F.teams[s].r.find(p => p.i === i)?.n).filter(Boolean)
  const pk = list => (list ?? []).map(e => (typeof e === 'number' ? F.picks[e] : F.picks[e?.i])).filter(Boolean).map(p => pickText(F, p))
  const they = [...nm(c.b, c.gb), ...pk(c.pb)], you = [...nm(c.a, c.ga), ...pk(c.pa)]
  return `Their counter: ${they.join(', ') || 'nothing'} for ${you.join(', ') || 'nothing'}`
}
