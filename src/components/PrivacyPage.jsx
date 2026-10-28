import LegalShell, { Sec, P, L, Mail, Ext } from './LegalShell'

const TOC = [['p-collect', 'What we collect'], ['p-use', 'How we use it'], ['p-public', 'What others see'], ['p-ads', 'Ads and cookies'], ['p-share', 'Who we share with'], ['p-choices', 'Your choices'], ['p-kids', 'Kids'], ['p-contact', 'Contact']]

export default function PrivacyPage({ onBack }) {
  return (
    <LegalShell eyebrow="BUILD-A-PLAYER" title="Privacy Policy" updated="Last updated October 25, 2026" onBack={onBack} toc={TOC}>
      <Sec id="p-summary" title="The short version">
        <L items={[
          'We collect what the game needs to save your progress, run leaderboards and online games, and fix bugs.',
          'We never sell your personal information.',
          'Your username, look and results are public on leaderboards and in online games. Your email is not.',
          'You can delete your account and its data at any time, right in the game.',
        ]} />
        <P>Build-A-Player is owned and operated by Playmaker Games LLC ("we", "us"). This policy covers the website (build-a-player.com) and the iOS and Android apps.</P>
      </Sec>

      <Sec id="p-collect" title="What we collect">
        <P><strong>Your account.</strong> If you sign up, we keep your email address, your username and your password (stored hashed by our database provider, never in plain text). If you sign in with Discord or Apple, we receive the basic details they share: an account ID, a username and an email address (Apple may give us a private relay address instead of your real one).</P>
        <P><strong>Your game.</strong> Builds and saved seasons with their stats, leaderboard entries, XP and level, coins and what you bought, the cosmetic items you own and wear, achievements, your card collection, Career saves (kept with your account so you can continue on another device), and your online ratings and match results.</P>
        <P><strong>Online games.</strong> While you're in a live game, your username, avatar, cosmetics and build are sent to the other players in that game. Team chat messages go live to the players in that game and aren't stored as a chat history. If someone reports a message, the message, the game's room code and the usernames involved are saved so we can review it.</P>
        <P><strong>Purchases.</strong> On the website and in the iOS app, coins, BAP Pro and the Builder Pass are paid through Stripe; in the Android app, through Google Play, with RevenueCat checking each purchase with Google. We receive what you bought, the amount, and a Stripe or Google Play purchase reference linked to your account. We never see or store your card number.</P>
        <P><strong>Feedback.</strong> Anything you send us through the feedback form or by email, with your username if you're signed in.</P>
        <P><strong>Usage and crashes.</strong> Google Analytics tells us which pages and screens are used, for how long, on what kind of device, and from roughly which country or region. When something breaks, the game sends a crash report: the error, technical details of where it happened, the page, the app version, the platform, your browser or device type, and your account ID if you're signed in.</P>
        <P><strong>On your device.</strong> The game keeps your build in progress, your settings and a random device ID (used so a live game can reconnect and only one runs at a time) in your device's storage. That stays on your device unless it's part of your saved progress.</P>
      </Sec>

      <Sec id="p-use" title="How we use it">
        <L items={[
          'To run the game: save and sync your progress, leaderboards, levels, coins, items and Career.',
          'To run online games: match you with other players and show them your name, look and build.',
          'To keep it fair: spot cheating, bots and tampered results, and act on chat reports.',
          'To process purchases and BAP Pro.',
          'To fix bugs and make the game better.',
          'To email you about your account and, now and then, about the game. Ask us and we\'ll stop the game emails.',
        ]} />
        <P>We don't sell or rent your personal information, and we don't use it to build advertising profiles.</P>
      </Sec>

      <Sec id="p-public" title="What other players see">
        <P>Your username, avatar and cosmetics, level, online rating, leaderboard results and the builds behind them are public: on leaderboards, profiles and share cards, and to the players in your online games. Your email address and payment details are never shown.</P>
      </Sec>

      <Sec id="p-ads" title="Ads and cookies">
        <P>The website uses cookies and similar storage for analytics (Google Analytics) and advertising. You can block cookies in your browser settings, but some features may stop working.</P>
        <P>All or partial advertising on this Website or App is managed by Playwire LLC. If Playwire publisher advertising services are used, Playwire LLC may collect and use certain aggregated and anonymized data for advertising purposes. To learn more about the types of data collected, how data is used and your choices as a user, please visit <Ext href="https://www.playwire.com/privacy-policy">https://www.playwire.com/privacy-policy</Ext>.</P>
        <P>Video ads that pay coins are optional and only play when you tap to watch one. They're served by Google (Google Ad Manager on the website, Google AdMob in the app), which may collect device and ad-interaction data under Google's own policy. The app does not track you across other companies' apps and websites.</P>
      </Sec>

      <Sec id="p-share" title="Who we share it with">
        <P>Only the services that run the game for us, each under its own privacy policy:</P>
        <L items={[
          <><Ext href="https://supabase.com/privacy">Supabase</Ext>: accounts, the database and live games</>,
          <><Ext href="https://www.cloudflare.com/privacypolicy/">Cloudflare</Ext>: hosting the website</>,
          <><Ext href="https://stripe.com/privacy">Stripe</Ext>: payments on the website and in the iOS app</>,
          <><Ext href="https://policies.google.com/privacy">Google Play</Ext> and <Ext href="https://www.revenuecat.com/privacy">RevenueCat</Ext>: payments in the Android app</>,
          <><Ext href="https://policies.google.com/privacy">Google</Ext>: Analytics, Ad Manager and AdMob</>,
          <><Ext href="https://www.playwire.com/privacy-policy">Playwire (Ramp)</Ext>: website ads</>,
          <>Discord and Apple: only if you sign in with them</>,
        ]} />
        <P>We may also share information if the law requires it, or to protect players and the Service from fraud or abuse.</P>
      </Sec>

      <Sec id="p-keep" title="How long we keep it">
        <P>Account and game data stays while your account exists. Crash reports and chat reports are kept only as long as we need them to fix the problem or review the report. When you delete your account, your account and game data are permanently deleted, and any BAP Pro subscription paid through Stripe is cancelled (one from Google Play is cancelled in Google Play).</P>
      </Sec>

      <Sec id="p-choices" title="Your choices and rights">
        <L items={[
          'Delete your account and its data: Settings in the app, or your profile on the website.',
          'Change your look in the game. To change your username, email us.',
          'Ask us for a copy of your data, or to correct it: email us.',
          'Turn off cookies in your browser, and skip the optional video ads.',
        ]} />
        <P>Depending on where you live (for example the EU, the UK or California), you may have more rights over your data, such as access, correction, deletion and objection. We honor these requests for every player, wherever they live. Email us and we'll answer within 30 days.</P>
      </Sec>

      <Sec id="p-kids" title="Kids">
        <P>Build-A-Player is for players 13 and older. We don't knowingly collect personal information from children under 13; if we learn we have, we delete it. Chat is filtered, strips links and contact details, and can be blocked and reported.</P>
      </Sec>

      <Sec id="p-security" title="Security">
        <P>Data is sent over encrypted connections, passwords are stored hashed, and access to our database is limited. No service is perfectly secure, so use a password you don't use anywhere else.</P>
      </Sec>

      <Sec id="p-changes" title="Changes">
        <P>We may update this policy. The new version goes on this page with a new date, and big changes are announced in the game.</P>
      </Sec>

      <Sec id="p-contact" title="Contact">
        <P>Questions or requests about your data: <Mail /></P>
      </Sec>
    </LegalShell>
  )
}
