# Build-A-Player iOS & Android app

The app is the website wrapped with [Capacitor](https://capacitorjs.com): the same React code,
built with `npm run build:app` and copied into the native projects in `ios/` and `android/`.
It lives on the `app` branch. Builds run in the cloud on [Codemagic](https://codemagic.io), so no Mac is needed.

## What's different inside the app

All of this is switched by `IS_APP` in `src/lib/platform.js`. On the website none of it runs.

- **No web ads.** The Ramp script is left out of the app build, and the game runs ad-free.
  In-app ads will come from Playwire's app SDK once it's set up.
- **No Stripe.** The Plus "Subscribe" and "Manage Subscription" buttons are hidden, because
  the App Store and Google Play require their own in-app purchase. Existing Plus members keep their perks when they sign in.
- **Sharing a build** opens the phone's share sheet, which includes "Save Image".
- **API calls** go to `https://build-a-player.com` (set in `.env.app`).

## One-time setup

### 1. Apple

1. **Register the bundle ID.** Go to [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list) → Identifiers → **+** → App IDs → App.
   Use bundle ID `com.buildaplayer.app` and description "Build-A-Player".
2. **Create the app record.** Go to [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** → New App.
   Pick iOS, name it Build-A-Player, choose the bundle ID above and use SKU `buildaplayer`.
3. **Create an API key for Codemagic.** In App Store Connect go to Users and Access → Integrations → App Store Connect API → **+**.
   Name it "Codemagic" and give it the **App Manager** role. Download the `.p8` file, which can only be downloaded once.
   Note the **Key ID** and **Issuer ID**.

### 2. Codemagic

1. Sign up at [codemagic.io](https://codemagic.io) with GitHub and add the `build-a-player` repository.
2. **Connect Apple.** Go to Team settings → Team integrations → Developer Portal → Connect.
   Name the key exactly **Build-A-Player**, then paste the Issuer ID and Key ID and upload the `.p8`.
3. **Create the signing certificate.** Go to Team settings → codemagic.yaml settings → Code signing identities → iOS certificates → **Generate certificate**.
   Choose Apple Distribution. Codemagic creates and stores it, so no Mac is needed.
4. **Create the provisioning profile** on Apple's website, which works without a Mac. Go to [developer.apple.com](https://developer.apple.com/account/resources/profiles/list) → Profiles → **+**.
   Choose **App Store Connect** under Distribution, then the App ID `com.buildaplayer.app`, then the Apple Distribution certificate Codemagic just made (it has today's date).
   Name it "Build-A-Player App Store" and click Generate. You don't need to download it.
5. **Bring the profile into Codemagic.** Go back to Code signing identities → iOS provisioning profiles → **Fetch profiles**, then tick "Build-A-Player App Store" and save it.
No environment variables are needed: the Supabase URL and anon key (public values, already in the
website's JavaScript) live in `.env.app`, which the app build reads.

### 3. Website (before submitting to Apple)

Apple requires in-app account deletion. The app's **Delete account** button calls
`https://build-a-player.com/api/delete-account` (`functions/api/delete-account.js`),
so that function has to be live on the website before review. It uses the
`SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` variables Cloudflare already has.

## Building

1. Push the `app` branch to GitHub.
2. In Codemagic, click **Start new build**, choose branch `app` and workflow **iOS → TestFlight**. It takes about 15–20 minutes.
3. The build appears in App Store Connect → TestFlight. Install Apple's **TestFlight** app on your iPhone to try it.

## Submitting to the App Store

In App Store Connect → your app → the 1.0 version, fill in:

- **Screenshots:** 6.9" iPhone (1320 × 2868). Screenshots from the 6.5" size can be reused.
- **Description, keywords and support URL:** for example `https://build-a-player.com`.
- **Privacy policy URL:** `https://build-a-player.com/privacy`.
- **App Privacy:** collects email address, user ID, gameplay content and usage data (Google Analytics), all linked to the user. None of it is used for tracking.
- **Age rating questionnaire** and the **category:** Sports, with Games as secondary.
- **Review notes:** include a test account (email and password), so the reviewer can sign in,
  save seasons and see the Delete account button.

Then choose the TestFlight build and **Submit for Review**.

## Updating the app

- **Site changes** (rosters and so on): merge `main` into `app`, then start a new Codemagic build.
  The build number goes up automatically.
- **A new App Store version** (1.0 → 1.1): change `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`
  and `versionName` in `android/app/build.gradle`.
- **New icon or splash:** replace the files in `assets/`, run `npm run assets:app` and commit.

## Android (Google Play)

The upload key is already made: `F:\bap-keys\build-a-player-upload.jks`, with its password in
`build-a-player-upload.txt` next to it. Back that folder up somewhere safe and never commit it.
If it's ever lost, Google can reset the upload key (Play Console → Test and release → App integrity).

1. **Play Console account** ($25) at [play.google.com/console](https://play.google.com/console).
   A personal account has to run a closed test with at least 12 testers for 14 days in a row before
   it can publish to everyone. An organization account (needs a D-U-N-S number) skips that.
2. **Create the app:** name Build-A-Player, Game, Free.
3. **Codemagic:** Code signing identities → Android keystores → upload the `.jks`, reference name
   **build_a_player_upload**, keystore password and key password from the `.txt`, alias `upload`.
4. **Build:** Start new build → branch `app` → **Android → Play Store bundle**. Download the `.aab`.
5. **Upload:** Play Console → Test and release → Testing → Internal testing → Create release →
   upload the `.aab` and keep Play App Signing on. Add yourself as a tester and install it from the
   link. With a personal account, do the same under **Closed testing** with your 12+ testers and
   wait out the 14 days.
6. **App content** (Policy → App content):
   - **Privacy policy:** `https://build-a-player.com/privacy`
   - **Ads:** No (rewarded videos are off, `REWARDED_ON` in `lib/rewardedAd.js`). Change it to Yes when they go on.
   - **App access:** some features need an account. Give a test username and password.
   - **Target audience:** 13–15, 16–17 and 18+. Leave out under 13, or the Families rules apply.
   - **Content rating questionnaire:** Game; users can talk to each other (team chat in online games);
     digital purchases; no violence, gambling or sexual content.
   - **Data safety:** collects email address, user ID, purchase history, in-game content (chat
     messages, builds), app interactions, crash logs and diagnostics. All linked to the account, sent
     encrypted, none sold or used for tracking. Users can request deletion. **Deletion URL:**
     `https://build-a-player.com/privacy` (says how: Settings in the app, or the profile on the website).
   - **Financial features / government / health:** none. **News app:** no.
7. **Store listing:** everything is in `F:\bap-play-store`: `listing.txt` (name, short and full
   description, category, URLs), `icon-512.png`, `feature-graphic-1024x500.png` and six phone
   screenshots (1080 × 2160) in `screenshots/`. Category: Sports.
8. **Purchases:** coins and BAP Pro go through the Stripe web checkout, shown only to US players
   (`lib/storefront.js`, the phone's language and time zone). Google allows US apps to link out to
   their own checkout; if a review objects, the fallback is Google Play Billing through RevenueCat.
9. **Production:** after the testing, Production → Create release → the same build → Send for review.

New versions: start another Codemagic build (the version code goes up by itself) and upload it the same way.

## Still to do

- **Playwire in-app ads:** this needs their app SDK and ad unit IDs from your Playwire contact.
- **Selling outside the US in the app:** Apple and Google in-app purchase, for example through RevenueCat.
  In the US the app links out to the web checkout (iOS and Android).
