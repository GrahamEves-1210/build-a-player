import { IS_APP, APP_LOOK } from '../lib/platform'
import { IconArrow } from './app/icons'

// The frame the About, Privacy and Terms pages share. In the app look (the app
// and the new website) it's an app screen: fixed to the window and scrolling on
// its own (the page itself never scrolls there), a back button, the sections as
// cards. The classic site keeps the old about page.
export default function LegalShell({ eyebrow, title, updated, onBack, wide = false, children }) {
  if (!(IS_APP || APP_LOOK)) {
    return (
      <div className="about-page">
        <div className="about-inner">
          <button className="prf-top-back" onClick={onBack}>← Back</button>
          <div className="about-header">
            <div className="about-title">{title}</div>
            {updated && <div className="about-subtitle">{updated}</div>}
          </div>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className={`ag-screen lg${wide ? ' lg--wide' : ''}`}>
      <div className="lg-head">
        <button className="lg-back" onClick={onBack} aria-label="Back"><IconArrow size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="lg-head-txt">
          {eyebrow && <span className="ag-eyebrow">{eyebrow}</span>}
          <h1 className="ag-h1">{title}</h1>
          {updated && <small className="lg-updated">{updated}</small>}
        </div>
      </div>
      <div className="lg-body">{children}</div>
    </div>
  )
}

// One section: a card in the app look, the classic section elsewhere
export function Sec({ id, title, children }) {
  return (
    <section id={id} className="about-section lg-sec">
      {title && <h2 className="about-section-title">{title}</h2>}
      {children}
    </section>
  )
}
export const P = ({ children }) => <p className="about-body">{children}</p>
export const L = ({ items }) => <ul className="about-list">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
export const Mail = () => <a href="mailto:buildaplayer@outlook.com" className="about-link">buildaplayer@outlook.com</a>
export const Ext = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="about-link">{children}</a>
