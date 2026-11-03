import { useState } from 'react'
import { connectDiscord, hasDiscord, discordError } from '../lib/discord'
import { IconDiscord } from './Navbar'

// Profile button: link Discord to an existing account, which also joins the
// server (finishDiscordSignIn runs when Discord sends them back).
export default function ConnectDiscord({ user }) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState(null)

  if (hasDiscord(user)) return <div className="prf-discord-linked"><IconDiscord /> Discord connected</div>

  const handleConnect = async () => {
    setBusy(true); setError(null)
    const { error } = await connectDiscord()   // leaves for Discord on success
    if (error) { setError(discordError(error)); setBusy(false) }
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
