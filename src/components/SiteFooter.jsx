import { useState } from 'react'
import { supabase } from '../lib/supabase'
import FeedbackModal from './FeedbackModal'

const HoopU = () => (
  <svg className="hoop-u-svg" viewBox="0 0 68 90" fill="none" aria-hidden="true">
    <circle cx="34" cy="14" r="14.4" fill="#f97316"/>
    <path d="M8 24 L18 88 L50 88 L60 24" stroke="white" strokeWidth="6" strokeLinejoin="round" fill="none"/>
    <line x1="17" y1="25" x2="38" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="27" y1="25" x2="48" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="41" y1="25" x2="20" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="51" y1="25" x2="30" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="5" y1="26" x2="63" y2="26" stroke="white" strokeWidth="5" strokeLinecap="round"/>
  </svg>
)

export default function SiteFooter({ sport = 'nfl', onDepthChart, onWiki }) {
  const isBucket = sport === 'bucket'
  // null = closed; otherwise holds the signed-in user (or false when signed out)
  const [feedbackUser, setFeedbackUser] = useState(null)
  const openFeedback = async () => {
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    setFeedbackUser(data?.session?.user ?? false)
  }

  return (
    <footer className="splash-site-footer">
      <div className="splash-site-footer-cols">
        <div className="splash-site-footer-col splash-site-footer-brand">
          <div className="splash-site-footer-logo">
            {isBucket ? <>BUILD-A-B<HoopU />CKET</> : 'BUILD-A-PLAYER'}
          </div>
          <div className="splash-site-footer-blurb">
            {isBucket ? 'Fan-made NBA player builder. Not affiliated with the NBA, the NBPA, or any of their members.' : 'Fan-made NFL player builder. Not affiliated with the NFL, the NFLPA, or any of their members.'}
          </div>
        </div>
        <div className="splash-site-footer-col">
          <div className="splash-site-footer-head">Games</div>
          {isBucket ? (
            <a className="splash-site-footer-link" href="/">Build-A-Player</a>
          ) : (
            <a className="splash-site-footer-link" href="/bucket">Build-A-Bucket</a>
          )}
          <a className="splash-site-footer-link" href="https://32-0game.com" target="_blank" rel="noopener noreferrer">32-0</a>
          {onDepthChart ? (
            <button className="splash-site-footer-link splash-site-footer-link--btn" onClick={onDepthChart}>Depth Chart Mini-Game</button>
          ) : (
            <a className="splash-site-footer-link" href="/">Depth Chart Mini-Game</a>
          )}
        </div>
        <div className="splash-site-footer-col">
          <div className="splash-site-footer-head">Info</div>
          <a className="splash-site-footer-link" href="/?about">About</a>
          <a className="splash-site-footer-link" href="/privacy">Privacy Policy</a>
          <a className="splash-site-footer-link" href="/terms">Terms</a>
          <button className="splash-site-footer-link splash-site-footer-link--btn" onClick={openFeedback}>Send Feedback</button>
          {onWiki
            ? <button className="splash-site-footer-link splash-site-footer-link--btn" onClick={onWiki}>Wiki</button>
            : <a className="splash-site-footer-link" href="/wiki">Wiki</a>}
        </div>
        <div className="splash-site-footer-col">
          <div className="splash-site-footer-head">Connect</div>
          <a className="splash-site-footer-link" href="mailto:buildaplayer@outlook.com">Email</a>
          <div className="splash-site-footer-social">
            <a className="splash-site-footer-social-btn splash-site-footer-social-btn--x" href="https://x.com/Build_A_Player" target="_blank" rel="noopener noreferrer" aria-label="Follow on X">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.737-8.835L1.254 2.25H8.08l4.265 5.638L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a className="splash-site-footer-social-btn splash-site-footer-social-btn--discord" href="https://discord.gg/zdZBu2VjUD" target="_blank" rel="noopener noreferrer" aria-label="Join our Discord">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
      <div className="splash-site-footer-bottom">
        <span>{isBucket ? 'Build-A-Bucket' : 'Build-A-Player'} {new Date().getFullYear()}</span>
        <a href="https://www.playwire.com/contact-direct-sales" rel="noopener" target="_blank" className="splash-site-footer-playwire">
          <img src="https://www.playwire.com/hubfs/Powered-by-Playwire-Badges/Ads-Powered-by-playwire-2021-standalone-small-white-300px.png" alt="Ads Powered by Playwire" width="140" height="39" loading="lazy" />
        </a>
      </div>
      {feedbackUser !== null && (
        <FeedbackModal user={feedbackUser || null} isBucket={isBucket} onClose={() => setFeedbackUser(null)} />
      )}
    </footer>
  )
}
