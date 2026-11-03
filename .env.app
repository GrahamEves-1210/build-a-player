# Loaded only by `vite build --mode app` (npm run build:app — the iOS/Android build).
# The app's pages are served from inside the app, so API calls need the live site's address.
VITE_API_URL=https://build-a-player.com

# Public values (already shipped in the website's JS) — kept here so cloud builds need no env setup
VITE_SUPABASE_URL=https://byjazrdwrvsduplxkacr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_IcPIuNb6jeGIL_ZafEfyWg_sAfrDtGg
