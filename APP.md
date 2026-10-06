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
6. **Add environment variables.** Go to the app → Environment variables and add a group called **supabase** containing:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Use the same values as the Cloudflare Pages settings.

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

## Android (optional)

1. Create a Google Play Console account ($25) and create the app.
2. Make an upload key and keep it safe. If you lose it, you have to ask Google to reset it:
   ```
   keytool -genkey -v -keystore build-a-player-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
3. In Codemagic go to Code signing identities → Android keystores and upload it with the reference name **build_a_player_upload**.
4. Run the **Android → Play Store bundle** workflow, then upload the `.aab` to Play Console → Testing → Internal testing.

## Still to do

- **Playwire in-app ads:** this needs their app SDK and ad unit IDs from your Playwire contact.
- **Selling Plus in the app:** Apple and Google in-app purchase, for example through RevenueCat.
  In the US, a link out to the web checkout is also allowed on iOS.
