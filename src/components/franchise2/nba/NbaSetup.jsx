import { useMemo } from 'react'
import { TEAM, DIVS, CONF_DIVS, DIV_OF, CONF_NAME, CONF_OF, buildTeams, teamOvr, depthOrder, photoOf, FIRST_YEAR, seasonText } from '../../../lib/franchise2/nba'
import { CAP_SIM } from '../../../lib/franchise2/nba'
import { sfx, haptic } from '../../../lib/juice'
import { IconClose, IconCaret } from '../../app/icons'
import { GamesSwitch } from '../../simFlow'
import { Chyron, KLogo, fkVars, TeamSlab, BigNum, Fact, LowerThird, Go } from '../kit'
import { LeagueRules } from '../Rules'
import { NbaBuildsStep, NbaNameStep } from './NbaBuilds'
import '../setup.css'

// BASKETBALL FRANCHISE, the setup: pick a team (the 30 by division), its card (the team's OVR, its best men, its
// payroll), then the league rules and key moments, and tip off.
const STEPS = [['team', 'Team'], ['builds', 'Players'], ['rules', 'Rules']]
const BACK = { card: 'team', builds: 'card', rules: 'builds' }
export const GAMES_MODES = [['advanced', 'ADVANCED'], ['simple', 'SIMPLE'], ['off', 'NONE']]
export const GAMES_WHAT = { advanced: 'Play the full mini game', simple: 'One tap to time it', off: 'Sim the play' }
export const CAP_WHAT = { on: 'The NBA cap and tax', off: 'No cap, no tax' }
// Key moments in the league rules' look (rules.css .fr-rule: the setup doesn't load the hub's season.css), three across
export const GAMES_CLS = { root: 'fr-rule', top: 'fr-rule-top', group: 'fr-rule-seg nb-seg3' }
const rulesIn = S => ({ cap: S.rules?.cap ?? true, inj: S.rules?.inj ?? true })

let PREVIEW = null
export function preview() {
  if (!PREVIEW) { const F = { seed: 'preview', nid: 1, year: FIRST_YEAR }; buildTeams(F, { dealOnLoad: CAP_SIM.dealOnLoad }); PREVIEW = F }
  return PREVIEW
}
const ORDER = Object.values(CONF_DIVS).flat().flatMap(d => DIVS[d])

export default function NbaSetup({ setup, owner, put, onStart, onBack, onBuild }) {
  const S = setup
  const step = S.step ?? 'team'
  const go = (patch, s) => { put({ ...S, ...patch }); if (s) sfx(s) }
  const naming = S.naming && S.builds?.[S.naming] ? S.naming : null
  const back = () => (naming ? go({ naming: null }, 'back') : step === 'team' ? onBack() : go({ step: BACK[step] }, 'back'))
  const at = step === 'rules' ? 2 : step === 'builds' ? 1 : 0
  return (
    <div className="fk-root fsu" style={S.team && step !== 'team' ? fkVars(S.team) : undefined}>
      <div className="fsu-top">
        <button type="button" className="fsu-x" onClick={back} aria-label={step === 'team' ? 'Close' : 'Back'}>
          {step === 'team' ? <IconClose size={16} /> : <IconCaret dir="left" size={18} />}
        </button>
        <ol className="fsu-steps" aria-label="New franchise">
          {STEPS.map(([k, label], i) => <li key={k} className={i < at ? 'is-done' : i === at ? 'is-on' : ''}><b>{i + 1}</b>{label}</li>)}
        </ol>
      </div>
      <div className="fsu-body" key={naming ? `n-${naming}` : step}>
        {naming && <NbaNameStep S={S} id={naming} owner={owner} onDone={x => go({ naming: null, builds: { ...S.builds, [naming]: { ...S.builds[naming], ...x } } }, 'claim')} />}
        {!naming && step === 'team' && <TeamWall pick={S.team} onPick={t => go({ team: t, step: 'card' }, 'tap')} rules={rulesIn(S)} onRules={r => go({ rules: { ...rulesIn(S), ...r } }, 'tap')} />}
        {!naming && step === 'card' && <TeamCard s={S.team} onPick={t => go({ team: t }, 'tap')} onGo={() => { go({ step: 'builds' }, 'whistle'); haptic('medium') }} />}
        {!naming && step === 'builds' && <NbaBuildsStep S={S} go={go} owner={owner} onBuild={onBuild} onNext={() => go({ step: 'rules' }, 'tap')} />}
        {!naming && step === 'rules' && <Rules S={S} go={go} owner={owner} onStart={onStart} />}
      </div>
    </div>
  )
}

function TeamWall({ pick, onPick, rules, onRules }) {
  return (
    <div className="fsu-wall">
      <Chyron tone="ink" title="Pick a team" sub="30 TEAMS · 6 DIVISIONS" />
      {Object.entries(CONF_DIVS).map(([c, ds]) => ds.map((d, i) => (
        <div key={d} className="fsu-div" style={{ '--d': `${i * 30}ms` }}>
          <span className="fsu-div-lbl">{`${CONF_NAME[c]} · ${d}`.toUpperCase()}</span>
          <div className="fsu-div-row nb-div-row">
            {DIVS[d].map(s => (
              <button key={s} type="button" className={`fsu-tm${pick === s ? ' is-on' : ''}`} style={fkVars(s)} onClick={() => onPick(s)} aria-label={TEAM[s].name}>
                <KLogo s={s} size={44} />
                <small>{s}</small>
              </button>
            ))}
          </div>
        </div>
      )))}
      {/* (the league rules from the start, as football's setup has them: the last step and the hub have them too) */}
      <section className="fsu-rules"><Chyron tone="ink" size="s" title="LEAGUE RULES" /><LeagueRules value={rules} capWhat={CAP_WHAT} onChange={onRules} /></section>
    </div>
  )
}

const money = v => `$${(Math.round(v * 10) / 10).toFixed(1)}M`
function TeamCard({ s, onPick, onGo }) {
  const F = preview()
  const ovr = teamOvr(F, s)
  const stars = depthOrder(F, s).slice().sort((a, b) => b.o - a.o).slice(0, 3)
  const pay = CAP_SIM.capSheet(F, s)
  const i = ORDER.indexOf(s)
  const prev = ORDER[(i + 29) % 30], next = ORDER[(i + 1) % 30]
  const rank = useMemo(() => Object.keys(TEAM).sort((a, b) => teamOvr(F, b) - teamOvr(F, a)).indexOf(s) + 1, [s]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fsu-card" key={s}>
      <div className="fsu-card-nav">
        <button type="button" onClick={() => onPick(prev)} aria-label={TEAM[prev].name}><IconCaret dir="left" size={14} /><KLogo s={prev} size={22} />{prev}</button>
        <span>{DIV_OF[s].toUpperCase()}</span>
        <button type="button" onClick={() => onPick(next)} aria-label={TEAM[next].name}>{next}<KLogo s={next} size={22} /><IconCaret dir="right" size={14} /></button>
      </div>
      <TeamSlab s={s} size="l" sub={`${CONF_NAME[CONF_OF[s]].toUpperCase()} CONFERENCE`} />
      <div className="fsu-card-nums">
        <BigNum v={ovr} label="TEAM OVR" size={58} />
        <Fact v={`${rank}${ORD(rank)}`} label="IN THE NBA" size={40} />
        <Fact v={money(pay.pay)} label="PAYROLL" size={40} />
      </div>
      <Chyron tone="ink" size="s" title="Best players" />
      <div className="fsu-stars">
        {stars.map((p, k) => <LowerThird key={p.i} name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={photoOf(p.n)} team={s} size="s" line={`AGE ${p.ag}`} delay={120 + k * 60} />)}
      </div>
      <div className="fsu-acts"><Go onClick={onGo}>{`Take over the ${TEAM[s].nick}`}</Go></div>
    </div>
  )
}
const ORD = n => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')

function Rules({ S, go, owner, onStart }) {
  const rules = rulesIn(S)
  return (
    <div className="fsu-card nb-rules">
      <TeamSlab s={S.team} size="m" sub={`${seasonText(FIRST_YEAR)} · GM ${owner.toUpperCase()}`} />
      <Chyron tone="ink" size="s" title="League rules" />
      <LeagueRules value={rules} nick={TEAM[S.team].nick} capWhat={CAP_WHAT} onChange={r => go({ rules: { ...rules, ...r } })} />
      <GamesSwitch mode={S.games ?? 'advanced'} modes={GAMES_MODES} what={GAMES_WHAT} title="Key moments" sub="the last possession of a close game"
        onPick={m => go({ games: m })} cls={GAMES_CLS} />
      <div className="fsu-acts"><Go onClick={onStart}>Tip off</Go></div>
    </div>
  )
}
