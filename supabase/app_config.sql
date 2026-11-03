-- ════════════════════════════════════════════════════════════════════════════
-- App config: minimum / latest app version and the store links
-- ════════════════════════════════════════════════════════════════════════════
-- Read by src/lib/versionCheck.js (shown by components/app/UpdateGate.jsx):
--   min_version     below this the app blocks with "Update required"
--   latest_version  below this a dismissible "Update available" card (once per version)
--   min_version_ios / min_version_android / latest_version_ios /
--   latest_version_android   optional per-platform overrides
--   ios_store_url / android_store_url   where the Update button goes
-- Versions compare as numbers part by part (1.10.0 > 1.9.3) against the app's
-- MARKETING_VERSION (iOS) / versionName (Android).
--
-- Public read; only the dashboard (service role) can change values.
-- Safe to run more than once. Run in the Supabase SQL editor.

create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists "anyone can read app config" on public.app_config;
create policy "anyone can read app config" on public.app_config
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

-- Starting values: nothing is forced. Replace the App Store id once the app is live.
insert into public.app_config (key, value) values
  ('min_version',       '1.0'),
  ('latest_version',    '1.0'),
  ('ios_store_url',     'https://apps.apple.com/app/build-a-player/id0000000000'),
  ('android_store_url', 'https://play.google.com/store/apps/details?id=com.buildaplayer.app')
on conflict (key) do nothing;

-- To force an update:   update app_config set value = '1.2.0', updated_at = now() where key = 'min_version';
-- To nudge an update:   update app_config set value = '1.3.0', updated_at = now() where key = 'latest_version';
