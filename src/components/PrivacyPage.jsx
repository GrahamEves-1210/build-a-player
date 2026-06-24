export default function PrivacyPage({ onBack }) {
  return (
    <div className="about-page">
      <div className="about-inner">

        <div className="about-header">
          <div className="about-title">Privacy <em>Policy</em></div>
          <div className="about-subtitle">Last updated: June 24, 2026</div>
        </div>

        <section className="about-section">
          <h2 className="about-section-title">Information We Collect</h2>
          <p className="about-body">
            <strong>Analytics.</strong> We use Google Analytics to collect anonymized data about how visitors use the site — pages visited, session duration, device type, and general location (country/region). This data does not identify you personally.
          </p>
          <p className="about-body">
            <strong>Accounts.</strong> If you create an account, we store your email address and the simulation results you choose to save (wins, losses, stats, and build data). This information is stored securely via Supabase and is not sold to third parties.
          </p>
          <p className="about-body">
            <strong>Local storage.</strong> Your in-progress build may be stored in your browser's local storage to preserve your session. This data stays on your device and is not transmitted to our servers.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Cookies</h2>
          <p className="about-body">
            We use cookies for analytics (Google Analytics) and advertising (Google AdSense). By using this site you consent to the use of cookies in accordance with this policy. You can disable cookies in your browser settings at any time, though some features may not function correctly.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Third-Party Services</h2>
          <p className="about-body">
            This site uses the following third-party services, each governed by their own privacy policies:
          </p>
          <ul className="about-list">
            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="about-link">Google Analytics</a></li>
            <li><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="about-link">Supabase</a></li>
          </ul>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Children's Privacy</h2>
          <p className="about-body">
            This site is not directed at children under 13. We do not knowingly collect personal information from children under 13.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Changes to This Policy</h2>
          <p className="about-body">
            We may update this policy from time to time. Changes will be posted on this page with an updated date.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Contact</h2>
          <p className="about-body">
            Questions? Reach us at <a href="mailto:buildaplayer@outlook.com" className="about-link">buildaplayer@outlook.com</a>
          </p>
        </section>

        <button className="about-back-btn" onClick={onBack}>
          ← Back
        </button>

      </div>
    </div>
  )
}
