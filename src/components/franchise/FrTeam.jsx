import { useMemo, useRef, useState } from 'react'
import { Panel, FrTable, FrSheet, FrSheetHead, GradeRow, Steps, Seg, useWide } from './frUi'

// FRANCHISE: TEAM. The roster as one dense table (position, name, age, OVR, development tier, contract, mood);
// a row opens the player's sheet: his letter grades, his contract, his season.
// SEAMS for the agents that come next:
//   PlayerSheet's `actions(card)` → buttons for the sheet's foot (extend, trade block, release, upgrade…)
//   the Seg at the top has room for DEPTH CHART and CAP SHEET (FR.depthChart, FR.capSheet are ready)

const SIDE = { QB: 'off', RB: 'off', WR: 'off', TE: 'off', LT: 'off', LG: 'off', C: 'off', RG: 'off', RT: 'off', EDGE: 'def', DT: 'def', LB: 'def', CB: 'def', S: 'def', K: 'st' }
const ORDER = Object.fromEntries(Object.keys(SIDE).map((s, i) => [s, i]))
const DEV_SHORT = { NORMAL: 'NORM', STAR: 'STAR', SUPERSTAR: 'SUPER', ELITE: 'ELITE' }
const short = name => String(name).replace(/^(\S)\S*\s+(?=\S)/, '$1. ')
const STAT_LABEL = { g: 'G', gs: 'GS', cmp: 'CMP', att: 'ATT', pct: 'PCT', yds: 'YDS', td: 'TD', int: 'INT', rtg: 'RTG', sk: 'SK', rushYds: 'RUSH', rushTD: 'R TD', ypc: 'AVG', rec: 'REC', recYds: 'REC YDS', recTD: 'REC TD', fum: 'FUM',
  tgt: 'TGT', ypr: 'AVG', long: 'LONG', sacksAllowed: 'SACKS ALW', pancakes: 'PANCAKES', tkl: 'TKL', sack: 'SACK', tfl: 'TFL', pd: 'PD', ff: 'FF', dTD: 'TD', fgm: 'FGM', fga: 'FGA', xpm: 'XPM', xpa: 'XPA', pts: 'PTS' }

// ── a player's sheet ────────────────────────────────────────────────────────
// pid: who (null: closed) · actions(card) → the foot's buttons (none yet)
export function PlayerSheet({ FR, F, pid, onClose, actions = null }) {
  const card = useMemo(() => { if (pid == null) return null; try { return FR.playerCard(F, pid) } catch { return null } }, [FR, F, pid])
  const kept = useRef(null)   // (the sheet keeps the man on it while it slides shut)
  if (card) kept.current = card
  const c = card ?? kept.current
  const stat = c?.stats?.season ?? {}
  const keys = Object.keys(stat).filter(k => stat[k] != null)
  const con = c?.contract
  const foot = c && actions ? actions(c) : null
  return (
    <FrSheet open={!!card} onClose={onClose} label={c?.name} foot={foot}
      head={c && <FrSheetHead name={c.name} photo={FR.photoUrl(c.photo)} big={c.ovr} line={[c.at ?? c.slot, c.num != null ? `#${c.num}` : null, `AGE ${c.age}`, c.devName ?? (c.exp === 0 ? 'ROOKIE' : null)].filter(Boolean).join(' · ')} />}>
      {c && <>
        {(c.inj || c.built || c.arch) && (
          <Panel>
            {c.arch && <div className="fr-kv"><span>{c.built ? `BUILT BY ${String(F.gm?.name ?? 'THE GM').toUpperCase()}` : 'TYPE'}</span><b className="is-text">{c.arch}</b></div>}
            {c.inj && <div className="fr-kv"><span>{c.inj.status}</span><b className="is-text fr-t-red">{c.inj.what}{c.inj.wk > 0 ? ` · ${c.inj.wk} ${c.inj.wk === 1 ? 'week' : 'weeks'}` : ''}</b></div>}
          </Panel>
        )}
        {c.traits?.length > 0 && (
          <Panel title="Ratings" meta={c.pts > 0 ? `${c.pts} ${c.pts === 1 ? 'POINT' : 'POINTS'} TO SPEND` : c.grade}>
            {c.traits.map(t => <GradeRow key={t.key} label={String(t.label).toUpperCase()} grade={t.grade} v={t.val} />)}
          </Panel>
        )}
        <Panel title="Contract" meta={c.rookie ? 'ROOKIE DEAL' : con?.tag ? 'FRANCHISE TAG' : null}>
          <div className="fr-kv"><span>SALARY</span><b>{FR.moneyText(con?.salary ?? c.salary ?? 0)}</b></div>
          <div className="fr-kv"><span>YEARS LEFT</span><b>{con?.yrs ?? c.yrs ?? 0}</b></div>
          <div className="fr-kv"><span>GUARANTEED LEFT</span><b>{FR.moneyText(con?.guar ?? c.guar ?? 0)}</b></div>
          {con?.cut && (con.cut.dead > 0 || con.cut.saves > 0) && <div className="fr-kv"><span>IF RELEASED</span><b className="is-text">{FR.moneyText(con.cut.dead)} dead · {FR.moneyText(con.cut.saves)} saved</b></div>}
        </Panel>
        <Panel title={`${F.year} season`} meta={keys.length ? null : 'NO GAMES YET'}>
          {keys.length > 0 ? (
            <div className="fr-table-wrap">
              <table className="fr-table fr-table--stat"><thead><tr>{keys.map(k => <th key={k} className="is-r">{STAT_LABEL[k] ?? k.toUpperCase()}</th>)}</tr></thead>
                <tbody><tr>{keys.map(k => <td key={k} className="is-r">{stat[k]}</td>)}</tr></tbody></table>
            </div>
          ) : c.line ? <div className="fr-kv"><span>LINE</span><b className="is-text">{c.line}</b></div> : null}
        </Panel>
        <Panel title="Mood" meta={String(c.moodWord ?? '').toUpperCase()}>
          <div className="fr-kv"><span>MORALE</span><b><Steps value={c.mood} label={`Morale ${Math.round(c.mood)} of 100`} /></b></div>
          {(c.drives ?? []).map(d => <div key={d} className="fr-kv"><span>{d}</span><b className="is-text">{FR.DRIVE_TEXT?.[d] ?? ''}</b></div>)}
          {(c.moodFactors ?? []).map((m, i) => <div key={i} className="fr-kv"><span>{m.d > 0 ? 'UP' : 'DOWN'}</span><b className="is-text">{m.text}</b></div>)}
        </Panel>
        {(c.college || c.bodyText || c.draft) && (
          <Panel title="Bio">
            {c.bodyText ? <div className="fr-kv"><span>SIZE</span><b className="is-text">{c.bodyText}</b></div> : null}
            {c.college && <div className="fr-kv"><span>COLLEGE</span><b className="is-text">{c.college}</b></div>}
            {c.draft && <div className="fr-kv"><span>DRAFT</span><b className="is-text">{c.draft}</b></div>}
          </Panel>
        )}
      </>}
    </FrSheet>
  )
}

export default function FrTeam({ FR, F }) {
  const wide = useWide()
  const rows = useMemo(() => FR.roster(F), [FR, F])
  const [side, setSide] = useState('all')
  const [pid, setPid] = useState(null)
  const shown = useMemo(() => (side === 'all' ? rows : rows.filter(r => SIDE[r.at ?? r.slot] === side)), [rows, side])
  const built = rows.filter(r => r.built).length, out = rows.filter(r => r.inj && r.inj.status !== 'QUESTIONABLE').length
  const cols = useMemo(() => {
    const name = r => <>{wide ? r.name : short(r.name)}{r.inj && <i className="is-out" title={`${r.inj.status}: ${r.inj.what}`}>{r.inj.status === 'QUESTIONABLE' ? 'Q' : r.inj.status}</i>}{wide && r.built && <i>BUILT</i>}</>
    const c = [
      { k: 'pos', label: 'POS', w: wide ? 56 : 40, cls: 'fr-t-pos', val: r => ORDER[r.at ?? r.slot] ?? 99, desc: false, render: r => r.at ?? r.slot },
      { k: 'name', label: 'PLAYER', cls: 'fr-t-name', val: r => r.short ?? r.name, render: name },
      ...(wide ? [{ k: 'num', label: 'NO.', align: 'r', w: 44, cls: 'fr-t-dim', val: r => r.num ?? 999, desc: false, render: r => r.num ?? '' }] : []),
      { k: 'age', label: 'AGE', align: 'r', w: wide ? 48 : 30, val: r => r.age },
      { k: 'ovr', label: 'OVR', align: 'r', w: wide ? 52 : 36, cls: 'fr-t-num', val: r => r.ovr },
      { k: 'dev', label: 'DEV', w: wide ? 96 : 44, cls: 'fr-t-lab fr-t-dim fr-t-gap', val: r => r.dev ?? -1, render: r => (r.devName ? (wide ? r.devName : DEV_SHORT[r.devName] ?? r.devName) : '–') },
      { k: 'sal', label: wide ? 'SALARY' : 'PAY', align: 'r', w: wide ? 84 : 50, val: r => r.salary, render: r => FR.moneyText(r.salary) },
      { k: 'yrs', label: 'YRS', align: 'r', w: wide ? 46 : 26, val: r => r.yrs },
      ...(wide ? [{ k: 'line', label: `${F.year}`, cls: 'fr-t-dim', render: r => r.line ?? '' }] : []),
      { k: 'mood', label: 'MOOD', align: 'r', w: wide ? 68 : 50, val: r => r.mood, render: r => <Steps value={r.mood} label={`${r.moodWord ?? 'Mood'}, ${Math.round(r.mood)} of 100`} /> },
    ]
    return c
  }, [FR, F.year, wide])
  return (
    <div className="fr-page">
      <Panel title="Roster" meta={[`${rows.length} MEN`, built ? `${built} BUILT` : null, out ? `${out} OUT` : null].filter(Boolean).join(' · ')}>
        <Seg label="Side of the ball" options={[['all', 'ALL'], ['off', 'OFFENSE'], ['def', 'DEFENSE'], ['st', 'SPECIAL']]} value={side} onChange={setSide} />
        <FrTable className="fr-roster" label="Roster" cols={cols} rows={shown} sort={{ k: 'pos', desc: false }} onRow={r => setPid(r.id)} rowClass={r => `${r.built ? 'is-mine' : ''}${r.starter ? '' : ' is-bench'}`} empty="NOBODY AT THAT SPOT" />
      </Panel>
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} />
    </div>
  )
}
