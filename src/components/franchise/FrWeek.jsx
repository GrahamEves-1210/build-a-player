import { useMemo, useState } from 'react'
import { Bug, FrShell, Panel, FrTable, Seg, Logo } from './frUi'
import { sfx } from '../../lib/juice'

// FRANCHISE: the week just played, plainly. What PLAY WEEK shows when the engine has played the GM's game itself:
// while the game day (./gameday/GameDay.jsx) isn't in the tree, on a bye, and for a team that's out. The final,
// the box score, the league's scores, the injuries and the headlines, all from FR.lastWeek(F).
// BoxScore is also what LEAGUE opens for any played game.

const nameCol = { k: 'name', label: 'PLAYER', cls: 'fr-t-name', render: r => <>{r.name}{r.built && <i>BUILT</i>}</> }
const num = (k, label, w = 38) => ({ k, label, align: 'r', w, render: r => r[k] ?? 0 })
const TABLES = [
  ['passing', 'Passing', [{ k: 'ca', label: 'C/ATT', align: 'r', w: 54, render: r => `${r.cmp}/${r.att}` }, num('yds', 'YDS'), num('td', 'TD', 30), num('int', 'INT', 32)]],
  ['rushing', 'Rushing', [num('att', 'CAR'), num('yds', 'YDS'), num('td', 'TD', 30), num('long', 'LONG', 44)]],
  ['receiving', 'Receiving', [num('rec', 'REC'), num('yds', 'YDS'), num('td', 'TD', 30), num('long', 'LONG', 44)]],
  ['defense', 'Defense', [num('tkl', 'TKL'), num('sack', 'SACK', 44), num('int', 'INT', 32), num('ff', 'FF', 30)]],
  ['kicking', 'Kicking', [{ k: 'fg', label: 'FG', align: 'r', w: 44, render: r => `${r.fgm}/${r.fga}` }, num('long', 'LONG', 44), { k: 'xp', label: 'XP', align: 'r', w: 44, render: r => `${r.xpm}/${r.xpa}` }, num('pts', 'PTS')]],
]
const TOTALS = [['yds', 'TOTAL YARDS'], ['passYds', 'PASSING'], ['rushYds', 'RUSHING'], ['firstDowns', 'FIRST DOWNS'], ['third', 'THIRD DOWNS'], ['to', 'TURNOVERS'], ['sacks', 'SACKS'], ['top', 'POSSESSION']]

// the line score: both clubs by quarter
export function LineScore({ box }) {
  const n = Math.max(box.home.quarters?.length ?? 0, box.away.quarters?.length ?? 0, 4)
  const qs = Array.from({ length: n }, (_, i) => (i < 4 ? String(i + 1) : 'OT'))
  return (
    <div className="fr-table-wrap">
      <table className="fr-table fr-line">
        <thead><tr><th>FINAL{box.ot ? ' · OT' : ''}</th>{qs.map(q => <th key={q} className="is-r">{q}</th>)}<th className="is-r">T</th></tr></thead>
        <tbody>
          {[box.away, box.home].map(t => (
            <tr key={t.team.short} className={t.score > (t === box.away ? box.home : box.away).score ? 'is-won' : undefined}>
              <td><span className="fr-t-team"><Logo team={t.team.short} size={24} />{t.team.short}</span></td>
              {qs.map((q, i) => <td key={q} className="is-r fr-t-dim">{t.quarters?.[i] ?? 0}</td>)}
              <td className="is-r fr-t-num">{t.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export function BoxScore({ FR, box, mine = null }) {
  const [side, setSide] = useState(mine && box.home.team.short === mine ? 'home' : mine ? 'away' : 'away')
  const t = box[side]
  return (
    <>
      <Panel><LineScore box={box} /></Panel>
      <Panel title="Team stats">
        <div className="fr-table-wrap">
          <table className="fr-table fr-totals"><thead><tr><th className="is-r">{box.away.team.short}</th><th className="is-c"> </th><th>{box.home.team.short}</th></tr></thead>
            <tbody>{TOTALS.filter(([k]) => box.away.totals?.[k] != null).map(([k, label]) => <tr key={k}><td className="is-r fr-t-num">{box.away.totals[k]}</td><td className="is-c fr-t-lab fr-t-dim">{label}</td><td className="fr-t-num">{box.home.totals[k]}</td></tr>)}</tbody></table>
        </div>
      </Panel>
      <Panel title="Box score">
        <Seg label="Team" options={[['away', box.away.team.name.toUpperCase()], ['home', box.home.team.name.toUpperCase()]]} value={side} onChange={setSide} />
        {TABLES.map(([k, label, cols]) => (t[k]?.length ? <FrTable key={k} label={label} cols={[{ ...nameCol, label: label.toUpperCase() }, ...cols]} rows={k === 'receiving' ? t[k].filter(r => r.rec > 0) : t[k]} rowKey={r => r.id ?? r.name} rowClass={r => (r.built ? 'is-mine' : null)} /> : null))}
      </Panel>
    </>
  )
}

export default function FrWeek({ FR, F, hub, onDone }) {
  const wk = useMemo(() => { try { return FR.lastWeek(F) } catch { return null } }, [FR, F])
  const us = hub.team
  const g = wk?.user?.game, box = wk?.user?.box
  const won = g ? (g.home.short === us.short ? g.hs > g.as : g.as > g.hs) : null
  const cells = g
    ? [{ label: wk.label ?? `WEEK ${wk.week}`, value: g.hs === g.as ? 'TIE' : won ? 'WIN' : 'LOSS' }, { label: 'FINAL', value: `${g.home.short === us.short ? g.hs : g.as}-${g.home.short === us.short ? g.as : g.hs}${g.ot ? ' OT' : ''}` }, { label: 'RECORD', value: hub.record.text }]
    : [{ label: wk?.label ?? 'THE WEEK', value: 'BYE' }, { label: 'RECORD', value: hub.record.text }]
  return (
    <FrShell mainKey="week" bug={<Bug team={us.short} cells={cells} />} cta={<button className="fr-btn" onClick={() => { sfx('tap'); onDone() }}>BACK TO THE HUB</button>}>
      <div className="fr-page">
        <div className="fr-cols">
          <div className="fr-col">
            {box ? <BoxScore FR={FR} box={box} mine={us.short} /> : <Panel title={wk?.label ?? 'The week'}><div className="fr-empty">{g ? 'NO BOX SCORE FOR THIS GAME' : `THE ${us.nick.toUpperCase()} WERE OFF`}</div></Panel>}
          </div>
          <div className="fr-col">
            {wk?.user?.potg?.player && <Panel title="Player of the game"><div className="fr-kv"><span>{String(wk.user.potg.player.name).toUpperCase()}</span><b className="is-text">{wk.user.potg.line}</b></div></Panel>}
            {wk?.injuries?.filter(i => i.user).length > 0 && (
              <Panel title="Injuries">{wk.injuries.filter(i => i.user).map(i => <div key={i.id} className="fr-kv"><span>{String(i.name).toUpperCase()} · {i.slot}</span><b className="is-text fr-t-red">{i.what}{i.wk > 0 ? ` · ${i.wk} wk` : ''}</b></div>)}</Panel>
            )}
            {wk?.scores?.length > 0 && (
              <Panel title="Around the league" meta={wk.label}>
                <FrTable label="Scores" rowKey={r => r.id} rowClass={r => (r.user ? 'is-mine' : null)} rows={wk.scores}
                  cols={[{ k: 'a', label: 'AWAY', render: r => <span className={`fr-t-team${r.as < r.hs ? ' fr-t-dim' : ''}`}><Logo team={r.away.short} size={20} />{r.away.short}</span> }, { k: 'as', label: '', align: 'r', w: 34, cls: 'fr-t-num', render: r => r.as },
                    { k: 'h', label: 'HOME', render: r => <span className={`fr-t-team${r.hs < r.as ? ' fr-t-dim' : ''}`}><Logo team={r.home.short} size={20} />{r.home.short}</span> }, { k: 'hs', label: '', align: 'r', w: 34, cls: 'fr-t-num', render: r => r.hs },
                    { k: 'ot', label: '', align: 'r', w: 30, cls: 'fr-t-lab fr-t-dim', render: r => (r.ot ? 'OT' : '') }]} />
              </Panel>
            )}
            {wk?.headlines?.length > 0 && <Panel title="Headlines">{wk.headlines.slice(0, 6).map((n, i) => <p key={n.id ?? i} className="fr-read fr-read--row">{n.head ?? n.text ?? n}</p>)}</Panel>}
          </div>
        </div>
      </div>
    </FrShell>
  )
}
