import { useState } from 'react'
import { IS_APP } from '../../lib/platform'
import { isMuted, setMuted, hapticsOff, setHapticsOff, haptic } from '../../lib/juice'
import { reduceMotion, setReduceMotion, dockHidden, setDockHidden } from '../../lib/settings'
import { NOTIF_KINDS, notifPrefs, setNotifPref } from '../../lib/notify'
import DeleteAccount from '../DeleteAccount'
import { supabase } from '../../lib/supabase'
import { contactEmailOf, saveContactEmail, maskEmail } from '../../lib/contactEmail'
import { useProgress } from '../../lib/progress'
import { IconChat, IconDiscord, IconPlay } from './icons'
import { AnimatePresence, motion as m } from 'motion/react'
import { EASE_OUT } from '../../lib/motion'

// More → Settings: sound, haptics, motion, notifications, the tutorial again,
// help, and the account (delete it here — the App Store requires it in-app).

const FAQ = [
  ['How do I save my builds and seasons?', 'Sign in. Seasons, cards, coins and your Career save to your account and follow you between the app and the website.'],
  ['What is Sandbox?', 'Change any player\'s ratings and build whoever you want. Sandbox seasons are just for fun: they don\'t save or reach the leaderboards.'],
  ['How do I get coins?', 'Seasons, wins, titles and awards pay coins, and so do missions, login streaks, new cards, levels, the daily drop and up to 3 videos a day in the shop\'s Get Coins tab.'],
  ['How do I cancel BAP Pro?', 'Pro is billed through Stripe on build-a-player.com. Sign in there, open your profile and choose Manage subscription.'],
  ['Something broke. What do I do?', 'Send us a message below with what you tapped and what happened. Screenshots help in the Discord.'],
]

// Account → the email password resets go to (lib/contactEmail.js)
function ResetEmail() {
  const user = useProgress().user
  const [saved, setSaved] = useState(() => contactEmailOf(user))
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async e => {
    e.preventDefault()
    setBusy(true); setErr('')
    const problem = await saveContactEmail(val)
    setBusy(false)
    if (problem) { setErr(problem); return }
    setSaved(val.trim()); setOpen(false); haptic('success')
  }
  return (
    <div className={`sx-email${!saved ? ' is-missing' : ''}`}>
      <button className="sx-row" onClick={() => { setOpen(o => !o); setVal(saved || ''); setErr('') }} aria-expanded={open}>
        <span className="sx-txt"><b>Email for password resets</b><small>{saved ? maskEmail(saved) : 'None yet: add one so a forgotten password can be reset'}</small></span>
        <span className="sx-chev" aria-hidden="true">{open ? '−' : saved ? 'EDIT' : 'ADD'}</span>
      </button>
      {open && (
        <form className="sx-email-form" onSubmit={save}>
          <input type="email" value={val} onChange={e => setVal(e.target.value)} placeholder="name@example.com" autoComplete="email" inputMode="email" aria-label="Email for password resets" />
          <button className="ag-btn" type="submit" disabled={busy}>{busy ? 'SAVING…' : 'SAVE'}</button>
          {err && <p className="sx-email-err" role="alert">{err}</p>}
          <p className="sx-email-note">Only the account can see it. It's used for password resets, nothing public.</p>
        </form>
      )}
    </div>
  )
}

function Toggle({ label, sub, on, onFlip }) {
  return (
    <button className={`sx-row${on ? ' is-on' : ''}`} role="switch" aria-checked={on} onClick={() => onFlip(!on)}>
      <span className="sx-txt"><b>{label}</b>{sub && <small>{sub}</small>}</span>
      <span className="ag-sound-switch" aria-hidden="true"><span className="ag-sound-knob" /></span>
    </button>
  )
}

export default function AppSettings({ signedIn, onFeedback, onClose }) {
  const [sound, setSound] = useState(() => !isMuted())
  const [haptics, setHaptics] = useState(() => !hapticsOff())
  const [motion, setMotion] = useState(reduceMotion)
  const [dock, setDock] = useState(() => !dockHidden())
  const [notifs, setNotifs] = useState(notifPrefs)
  const [faq, setFaq] = useState(null)

  const flipNotif = async (id, on) => { setNotifs(n => ({ ...n, [id]: on })); await setNotifPref(id, on); setNotifs(notifPrefs()) }
  const replay = () => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('bap:tutorial')), 250) }

  return (
    <div className="sx">
      <div className="sx-group">
        <span className="ag-eyebrow">GAME</span>
        <Toggle label="Sound" on={sound} onFlip={v => { setMuted(!v); setSound(v); window.dispatchEvent(new CustomEvent('bap:sound')) }} />
        {IS_APP && <Toggle label="Haptics" sub="Taps and buzzes on the phone" on={haptics} onFlip={v => { setHapticsOff(!v); setHaptics(v); if (v) haptic('medium') }} />}
        <Toggle label="Reduce motion" sub="Fewer animations and effects" on={motion} onFlip={v => { setReduceMotion(v); setMotion(v) }} />
        <Toggle label="Bottom navigation" sub="Off: more room on screen. The menu button on Home still gets you everywhere" on={dock} onFlip={v => { setDockHidden(!v); setDock(v) }} />
        <button className="sx-row" onClick={replay}>
          <span className="sx-txt"><b>Replay the tutorial</b><small>The basics and every mode, then a guided game</small></span>
          <IconPlay size={16} />
        </button>
      </div>

      {IS_APP && (
        <div className="sx-group">
          <span className="ag-eyebrow">NOTIFICATIONS</span>
          {NOTIF_KINDS.map(k => <Toggle key={k.id} label={k.label} on={!!notifs[k.id]} onFlip={v => flipNotif(k.id, v)} />)}
        </div>
      )}

      <div className="sx-group">
        <span className="ag-eyebrow">HELP</span>
        {FAQ.map(([q, a], i) => (
          <div key={q} className={`sx-faq${faq === i ? ' is-open' : ''}`}>
            <button className="sx-row" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)}>
              <span className="sx-txt"><b>{q}</b></span>
              <span className="sx-chev" aria-hidden="true">{faq === i ? '−' : '+'}</span>
            </button>
            <AnimatePresence initial={false}>
              {faq === i && (
                <m.div key="a" className="sx-answer-wrap" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE_OUT }}>
                  <p className="sx-answer">{a}</p>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        ))}
        <div className="sx-contact">
          <button className="sx-row" onClick={onFeedback}><IconChat size={17} /><span className="sx-txt"><b>Contact us</b><small>Bugs, ideas, account help</small></span></button>
          <button className="sx-row" onClick={() => window.open('https://discord.gg/zdZBu2VjUD', '_blank')}><IconDiscord size={17} /><span className="sx-txt"><b>Discord</b><small>Ask the community</small></span></button>
        </div>
      </div>

      {signedIn && (
        <div className="sx-group">
          <span className="ag-eyebrow">ACCOUNT</span>
          <ResetEmail />
          <button className="sx-row" onClick={async () => { await supabase?.auth.signOut().catch(() => {}); onClose() }}><span className="sx-txt"><b>Sign out</b></span></button>
          <div className="sx-delete"><DeleteAccount onDeleted={onClose} /></div>
        </div>
      )}
    </div>
  )
}
