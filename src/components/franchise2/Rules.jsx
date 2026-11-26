import { GamesSwitch as Switch } from '../simFlow'
import './rules.css'

// THE LEAGUE RULES (lib/franchise2/rules.js): the salary cap and injuries, each on or off. The same two switches on
// the setup's last screen and on the hub beside Key moments (Career's switch, simFlow.jsx GamesSwitch, in Key moments' look).
//   value: { cap, inj } (true: on), onChange(patch)
const ONOFF = [['on', 'ON'], ['off', 'OFF']]
const CLS = { root: 'fr-rule', top: 'fr-rule-top', group: 'fr-rule-seg' }
const CAP_WHAT = { on: 'The NFL cap', off: 'Sign anyone' }
const INJ_WHAT = { on: 'Players get hurt', off: 'Nobody gets hurt' }
const SANDBOX_WHAT = { on: 'Builds into the draft', off: 'The real league' }
export function LeagueRules({ value, onChange, nick, className = '', capWhat = CAP_WHAT }) {
  return (
    <div className={`fr-rules ${className}`}>
      <Switch mode={value.cap ? 'on' : 'off'} modes={ONOFF} what={capWhat} title="Salary cap" sub="across the league"
        onPick={m => onChange({ cap: m === 'on' })} cls={CLS} />
      <Switch mode={value.inj ? 'on' : 'off'} modes={ONOFF} what={INJ_WHAT} title="Injuries" sub="across the league"
        onPick={m => onChange({ inj: m === 'on' })} cls={CLS} />
      {/* (Sandbox: where the league has one, value.sandbox there) */}
      {value.sandbox != null && <Switch mode={value.sandbox ? 'on' : 'off'} modes={ONOFF} what={SANDBOX_WHAT} title="Sandbox" sub="your builds in the draft"
        onPick={m => onChange({ sandbox: m === 'on' })} cls={CLS} />}
    </div>
  )
}
