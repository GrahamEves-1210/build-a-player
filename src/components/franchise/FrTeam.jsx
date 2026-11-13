import { useEffect, useMemo, useState } from 'react'
import { Panel, FrTable, Steps, Seg, Switch, useWide } from './frUi'
import { Sub, Bar, CoachBlock, Fact, NewsRow, tap, up, plural, shortName, safe } from './frBits'
import { PlayerSheet } from './FrPlayer'
import { sfx } from '../../lib/juice'

// FRANCHISE: TEAM. Six views of the GM's own club behind one slim row:
//   ROSTER    the dense table (position, name, age, OVR, development tier, contract, mood)
//   DEPTH     the depth chart: the staff's by default; an arrow moves a man up or down at his spot, and the
//             chart is the GM's from then on (STAFF SETS IT hands it back)
//   CAP       the cap sheet: this season, the seasons ahead by how far off they are (never by a year that has
//             not been played), and every contract by its hit
//   HEALTH    the injury report, and wear (the men carrying the most)
//   DEVELOP   upgrade points to spend, XP, tiers, who has broken out
//   STAFF     the head coach and the coordinators with their five grades, and what they add
// A row anywhere opens the player's sheet (FrPlayer.jsx), where the upgrades and the front-office actions are.
// `jump` ({ view }) is how the hub's THIS WEEK lands on a view.
export { PlayerSheet }

const SIDE = { QB: 'off', RB: 'off', WR: 'off', TE: 'off', LT: 'off', LG: 'off', C: 'off', RG: 'off', RT: 'off', EDGE: 'def', DT: 'def', LB: 'def', CB: 'def', S: 'def', K: 'st' }
const ORDER = Object.fromEntries(Object.keys(SIDE).map((s, i) => [s, i]))
const DEV_SHORT = { NORMAL: 'NORM', STAR: 'STAR', SUPERSTAR: 'SUPER', ELITE: 'ELITE' }
const VIEWS = [['roster', 'ROSTER'], ['depth', 'DEPTH'], ['cap', 'CAP'], ['health', 'HEALTH'], ['develop', 'DEVELOP'], ['staff', 'STAFF']]
const AHEAD = ['NEXT SEASON', 'IN TWO SEASONS', 'IN THREE SEASONS']
const posCol = wide => ({ k: 'pos', label: 'POS', w: wide ? 56 : 40, cls: 'fr-t-pos', val: r => ORDER[r.at ?? r.slot] ?? 99, desc: false, render: r => r.at ?? r.slot })
const nameCol = (wide, extra = null) => ({ k: 'name', label: 'PLAYER', cls: 'fr-t-name', val: r => r.short ?? r.name, render: r => <>{wide ? r.name : shortName(r.name)}{r.inj && <i className="is-out" title={`${r.inj.status}: ${r.inj.what}`}>{r.inj.status === 'QUESTIONABLE' ? 'Q' : r.inj.status}</i>}{wide && r.built && <i>BUILT</i>}{extra?.(r)}</> })

function Roster({ FR, F, rows, wide, onPlayer }) {
  const [side, setSide] = useState('all')
  const shown = useMemo(() => (side === 'all' ? rows : rows.filter(r => SIDE[r.at ?? r.slot] === side)), [rows, side])
  const cols = useMemo(() => [
    posCol(wide), nameCol(wide),
    ...(wide ? [{ k: 'num', label: 'NO.', align: 'r', w: 44, cls: 'fr-t-dim', val: r => r.num ?? 999, desc: false, render: r => r.num ?? '' }] : []),
    { k: 'age', label: 'AGE', align: 'r', w: wide ? 48 : 30, val: r => r.age },
    { k: 'ovr', label: 'OVR', align: 'r', w: wide ? 52 : 36, cls: 'fr-t-num', val: r => r.ovr },
    { k: 'dev', label: 'DEV', w: wide ? 96 : 44, cls: 'fr-t-lab fr-t-dim fr-t-gap', val: r => r.dev ?? -1, render: r => (r.devName ? (wide ? r.devName : DEV_SHORT[r.devName] ?? r.devName) : '–') },
    { k: 'sal', label: wide ? 'SALARY' : 'PAY', align: 'r', w: wide ? 84 : 50, val: r => r.salary, render: r => FR.moneyText(r.salary) },
    { k: 'yrs', label: 'YRS', align: 'r', w: wide ? 46 : 26, val: r => r.yrs },
    ...(wide ? [{ k: 'line', label: `${F.year}`, cls: 'fr-t-dim', render: r => r.line ?? '' }] : []),
    { k: 'mood', label: 'MOOD', align: 'r', w: wide ? 68 : 50, val: r => r.mood, render: r => <Steps value={r.mood} label={`${r.moodWord ?? 'Mood'}, ${Math.round(r.mood)} of 100`} /> },
  ], [FR, F.year, wide])
  return (
    <Panel>
      <Seg label="Side of the ball" options={[['all', 'ALL'], ['off', 'OFFENSE'], ['def', 'DEFENSE'], ['st', 'SPECIAL']]} value={side} onChange={setSide} />
      <FrTable className="fr-roster" label="Roster" cols={cols} rows={shown} sort={{ k: 'pos', desc: false }} onRow={r => onPlayer(r.id)} rowClass={r => `${r.built ? 'is-mine' : ''}${r.starter ? '' : ' is-bench'}`} empty="NOBODY AT THAT SPOT" />
    </Panel>
  )
}

function Depth({ FR, F, act, onPlayer }) {
  const chart = useMemo(() => safe(() => FR.depthChart(F)), [FR, F])
  const [side, setSide] = useState('off')
  if (!chart) return <Panel><div className="fr-empty">NO DEPTH CHART ON FILE</div></Panel>
  const slots = chart.slots.filter(s => s.side === side && s.players.length)
  const move = (s, i, by) => { const ids = s.players.map(p => p.id), j = i + by; [ids[i], ids[j]] = [ids[j], ids[i]]; sfx('tap'); act(f => FR.setDepth(f, s.slot, ids)) }
  return (
    <Panel title="Depth chart" meta={chart.auto ? 'SET BY THE STAFF' : null}
      action={chart.auto ? null : <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { sfx('send'); act(f => FR.setSetting(f, 'autoDepth', true)) }}>STAFF SETS IT</button>}>
      <Seg label="Side of the ball" options={[['off', 'OFFENSE'], ['def', 'DEFENSE'], ['st', 'SPECIAL']]} value={side} onChange={setSide} />
      {slots.map(s => (
        <div key={s.slot}>
          <Sub meta={`${s.starters} ${s.starters === 1 ? 'STARTS' : 'START'}`}>{up(s.name)}</Sub>
          {s.players.map((p, i) => (
            <div key={p.id} className={`fr-depth${i < s.starters ? ' is-start' : ''}`}>
              <i>{i + 1}</i>
              <button className="fr-depth-who" onClick={() => { tap(); onPlayer(p.id) }}>{p.name}{p.inj && <em>{p.inj.status === 'QUESTIONABLE' ? 'Q' : p.inj.status}</em>}</button>
              <b>{p.ovr}</b>
              <button className="fr-move" disabled={i === 0} aria-label={`Move ${p.name} up`} onClick={() => move(s, i, -1)} />
              <button className="fr-move is-down" disabled={i === s.players.length - 1} aria-label={`Move ${p.name} down`} onClick={() => move(s, i, 1)} />
            </div>
          ))}
        </div>
      ))}
      {!slots.length && <div className="fr-empty">NOBODY LISTED</div>}
    </Panel>
  )
}

function Cap({ FR, F, wide, onPlayer }) {
  const cap = useMemo(() => safe(() => FR.capSheet(F)), [FR, F])
  if (!cap) return <Panel><div className="fr-empty">NO CAP SHEET ON FILE</div></Panel>
  const money = v => (v ? FR.moneyText(v) : '$0')
  const cols = [
    posCol(wide), nameCol(wide),
    { k: 'hit', label: 'CAP HIT', align: 'r', w: wide ? 90 : 62, cls: 'fr-t-num', val: r => r.capHit, render: r => money(r.capHit) },
    { k: 'pct', label: wide ? '% OF CAP' : '%', align: 'r', w: wide ? 84 : 40, cls: 'fr-t-dim', val: r => r.pctOfCap, render: r => r.pctOfCap.toFixed(1) },
    { k: 'yrs', label: 'YRS', align: 'r', w: wide ? 50 : 30, val: r => r.yrs },
    ...(wide ? [{ k: 'guar', label: 'GUARANTEED', align: 'r', w: 110, val: r => r.guar, render: r => money(r.guar) }] : []),
    { k: 'dead', label: wide ? 'DEAD IF CUT' : 'DEAD', align: 'r', w: wide ? 110 : 58, cls: 'fr-t-dim', val: r => r.cut?.dead ?? 0, render: r => money(r.cut?.dead ?? 0) },
    ...(wide ? [{ k: 'saves', label: 'SAVED IF CUT', align: 'r', w: 116, val: r => r.cut?.saves ?? 0, render: r => money(r.cut?.saves ?? 0) }] : []),
  ]
  return (
    <div className="fr-cols">
      <Panel title="Contracts" meta={plural(cap.rows.length, 'DEAL')} style={{ order: wide ? 0 : 2 }}>
        <FrTable className="fr-table--tight" label="Contracts" cols={cols} rows={cap.rows} sort={{ k: 'hit', desc: true }} onRow={r => onPlayer(r.id)} rowClass={r => (r.built ? 'is-mine' : null)} />
      </Panel>
      <div className="fr-col">
        <Panel title="Salary cap" meta={cap.on ? `${F.year} SEASON` : 'OFF'}>
          <div className="fr-kv"><span>CAP</span><b>{money(cap.cap)}</b></div>
          <div className="fr-kv"><span>PAYROLL</span><b>{money(cap.payroll)}</b></div>
          {cap.dead > 0 && <div className="fr-kv"><span>DEAD MONEY</span><b>{money(cap.dead)}</b></div>}
          <div className="fr-kv"><span>ROOM</span><b className={cap.space < 0 ? 'fr-t-red' : undefined}>{money(cap.space)}</b></div>
        </Panel>
        <Panel title="Committed ahead">
          {/* (no later year is named until it has been played: the seasons ahead by how far off they are) */}
          {cap.next?.map((n, i) => <div key={i} className="fr-kv"><span>{n.label ?? AHEAD[i] ?? 'LATER'} · {plural(n.players, 'DEAL')}</span><b>{money(n.committed)}</b></div>)}
        </Panel>
      </div>
    </div>
  )
}

function Health({ FR, F, rows, wide, onPlayer }) {
  const hurt = useMemo(() => safe(() => FR.injuryReport(F), []), [FR, F])
  const worn = useMemo(() => [...rows].filter(r => r.wear > 0).sort((a, b) => b.wear - a.wear).slice(0, 14), [rows])
  const on = FR.settingsOf(F).injuries
  return (
    <div className="fr-cols is-even">
      <Panel title="Injury report" meta={on ? (hurt.length ? `${hurt.length} LISTED` : null) : 'INJURIES OFF'}>
        <FrTable className="fr-table--tight" label="Injury report" rows={hurt} onRow={r => onPlayer(r.id)} empty="NOBODY ON THE REPORT"
          cols={[posCol(wide), { k: 'name', label: 'PLAYER', cls: 'fr-t-name', render: r => <>{wide ? r.name : shortName(r.name)}<span className="fr-t-sub">{r.what}</span></> },
            { k: 'ovr', label: 'OVR', align: 'r', w: 38, cls: 'fr-t-num', render: r => r.ovr },
            { k: 'st', label: 'STATUS', align: 'r', w: wide ? 120 : 84, cls: 'fr-t-lab', render: r => <span className={r.status === 'QUESTIONABLE' ? undefined : 'fr-t-red'}>{r.status === 'QUESTIONABLE' ? 'QUEST.' : r.status}</span> },
            { k: 'wk', label: 'WEEKS', align: 'r', w: 52, render: r => (r.wk > 0 ? r.wk : '–') }]} />
      </Panel>
      <Panel title="Wear" meta="THE HEAVIEST LOADS">
        <FrTable className="fr-table--tight" label="Wear" rows={worn} onRow={r => onPlayer(r.id)} empty="FRESH LEGS ALL AROUND"
          cols={[posCol(wide), nameCol(wide), { k: 'age', label: 'AGE', align: 'r', w: 36, render: r => r.age },
            { k: 'wear', label: 'WEAR', align: 'r', w: wide ? 120 : 84, render: r => <><Bar v={r.wear} low={r.wear >= 60} />{r.wear}</> }]} />
      </Panel>
    </div>
  )
}

function Develop({ FR, F, rows, wide, act, say, onPlayer }) {
  const auto = FR.settingsOf(F).autoUpgrade
  const pts = rows.reduce((s, r) => s + (r.pts ?? 0), 0)
  // (who has shown what he is, and who has played his way up a tier: the engine's own lines, this season)
  const arcs = useMemo(() => safe(() => FR.news(F, 80), []).filter(n => n.kind === 'milestone' && n.team?.short === F.team && n.year === F.year), [FR, F])
  const list = useMemo(() => [...rows].sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || (b.xp ?? 0) - (a.xp ?? 0)), [rows])
  const cols = [
    posCol(wide), nameCol(wide),
    { k: 'age', label: 'AGE', align: 'r', w: wide ? 48 : 30, val: r => r.age },
    { k: 'ovr', label: 'OVR', align: 'r', w: wide ? 52 : 36, cls: 'fr-t-num', val: r => r.ovr },
    { k: 'dev', label: 'TIER', w: wide ? 110 : 48, cls: 'fr-t-lab fr-t-dim fr-t-gap', val: r => r.dev ?? -1, render: r => (r.devName ? (wide ? r.devName : DEV_SHORT[r.devName] ?? r.devName) : '–') },
    { k: 'xp', label: 'XP', align: 'r', w: wide ? 70 : 48, val: r => r.xp ?? 0, render: r => (r.xp ?? 0).toLocaleString('en-US') },
    { k: 'pts', label: wide ? 'POINTS' : 'PTS', align: 'r', w: wide ? 70 : 38, cls: 'fr-t-num', val: r => r.pts ?? 0, render: r => (r.pts > 0 ? r.pts : <span className="fr-t-dim">0</span>) },
  ]
  return (
    <div className="fr-cols">
      <Panel title="Development" meta={pts ? `${plural(pts, 'POINT')} TO SPEND` : 'NO POINTS TO SPEND'} style={{ order: wide ? 0 : 2 }}>
        <FrTable className="fr-table--tight" label="Development" cols={cols} rows={list} onRow={r => onPlayer(r.id)} rowClass={r => (r.pts > 0 ? 'is-mine' : null)} />
      </Panel>
      <div className="fr-col">
        <Panel title="Upgrade points">
          <Switch label="The staff spends them" note="AS THEY ARE EARNED" on={auto} onChange={v => act(f => FR.setSetting(f, 'autoUpgrade', v))} />
          <div className="fr-pad"><button className="fr-btn fr-btn--line fr-btn--wide" disabled={!pts} onClick={() => { sfx('send'); const n = act(f => FR.autoUpgrade(f, null)); if (n?.flash?.msg) say(n.flash.msg) }}>STAFF SPENDS THEM NOW</button></div>
        </Panel>
        <Panel title="Breakouts" meta={`${F.year}`}>
          {arcs.map(n => <NewsRow key={n.id} n={n} tag={`WEEK ${n.week}`} onClick={n.pid != null ? () => onPlayer(n.pid) : null} />)}
          {!arcs.length && <div className="fr-empty">NOBODY HAS BROKEN OUT YET</div>}
        </Panel>
      </div>
    </div>
  )
}

function Staff({ FR, F }) {
  const staff = useMemo(() => safe(() => FR.staff(F)), [FR, F])
  if (!staff) return <Panel><div className="fr-empty">NO STAFF ON FILE</div></Panel>
  // (a head coach who calls a side himself: that side's coordinator does not)
  const calls = c => (c?.calls === 'off' ? 'CALLS THE OFFENSE' : c?.calls === 'def' ? 'CALLS THE DEFENSE' : c?.calls === true && staff.hc?.calls !== (c.role === 'OC' ? 'off' : 'def') ? 'CALLS THE PLAYS' : null)
  const g = v => FR.gradeOf(v)
  return (
    <div className="fr-cols is-even">
      <div className="fr-col">
        <Panel title="Head coach" meta={staff.hc?.record ?? null}><CoachBlock c={staff.hc} full note={calls(staff.hc)} money={FR.moneyText} /></Panel>
        <Panel title="What the staff adds">
          {staff.playcall && <div className="fr-kv"><span>THE OFFENSE IS CALLED AT</span><b>{g(staff.playcall.off)}</b></div>}
          {staff.playcall && <div className="fr-kv"><span>THE DEFENSE IS CALLED AT</span><b>{g(staff.playcall.def)}</b></div>}
          {(staff.effects ?? []).map((t, i) => <p key={i} className="fr-read fr-read--row">{t}</p>)}
          {staff.budget && <div className="fr-kv"><span>STAFF BUDGET LEFT</span><b>{FR.moneyText(staff.budget.left)}</b></div>}
          {staff.scout && <Fact label="SCOUTING">{staff.scout.name}{staff.scout.specialty ? ` · ${staff.scout.specialty}` : ''}</Fact>}
        </Panel>
      </div>
      <div className="fr-col">
        <Panel title="Offensive coordinator"><CoachBlock c={staff.oc} full note={calls(staff.oc)} money={FR.moneyText} /></Panel>
        <Panel title="Defensive coordinator"><CoachBlock c={staff.dc} full note={calls(staff.dc)} money={FR.moneyText} /></Panel>
      </div>
    </div>
  )
}

export default function FrTeam({ FR, F, act, go, say, jump }) {
  const wide = useWide()
  const rows = useMemo(() => FR.roster(F), [FR, F])
  const [view, setView] = useState(jump?.view ?? 'roster')
  useEffect(() => { if (jump?.view) setView(jump.view) }, [jump])
  const [pid, setPid] = useState(null)
  const built = rows.filter(r => r.built).length, out = rows.filter(r => r.inj && r.inj.status !== 'QUESTIONABLE').length
  const p = { FR, F, rows, wide, act, say, onPlayer: setPid }
  return (
    <div className="fr-page">
      <Panel title={up(FR.teamRef(F.team)?.nick ?? 'Team')} meta={[`${rows.length} MEN`, built ? `${built} BUILT` : null, out ? `${out} OUT` : null].filter(Boolean).join(' · ')} className="fr-panel--nav">
        <Seg className="fr-seg--fit" label="Team" options={VIEWS} value={view} onChange={setView} />
      </Panel>
      {view === 'roster' && <Roster {...p} />}
      {view === 'depth' && <Depth {...p} />}
      {view === 'cap' && <Cap {...p} />}
      {view === 'health' && <Health {...p} />}
      {view === 'develop' && <Develop {...p} />}
      {view === 'staff' && <Staff {...p} />}
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} act={act} say={say} go={go} />
    </div>
  )
}
