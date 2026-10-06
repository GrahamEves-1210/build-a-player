import { useState } from 'react'
import { connectDiscord, hasDiscord } from '../lib/discord'
import { IconDiscord } from './Navbar'
import { IS_APP } from '../lib/platform'

// Profile button: link Discord to an existing account, which also joins the
// server (finishDiscordSignIn runs when Discord sends them back).
export default function ConnectDiscord({ user }) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState(null)

  if (IS_APP) return null   // Discord linking returns to a web URL — website only for now
  if (hasDiscord(user)) return <div className="prf-discord-linked"><IconDiscord /> Discord connected</div>

  const handleConnect = async () => {
    setBusy(true); setError(null)
    const { error } = await connectDiscord()   // leaves for Discord on success
    if (error) { setError('Could not connect Discord. Try again.'); setBusy(false) }
  }

  return (
    <>
      <button className="auth-discord" onClick={handleConnect} disabled={busy}>
        <IconDiscord />
        <span>{busy ? 'Opening Discord…' : 'Connect Discord & join the server'}</span>
      </button>
      {error && <div className="auth-error">{error}</div>}
    </>
  )
}
