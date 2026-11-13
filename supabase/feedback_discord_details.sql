-- Feedback → Discord, with more detail on each post: the platform (device, browser, app or website, screen size),
-- the page it was sent from, and whether the player was signed in. Replaces only the trigger function from
-- feedback_discord_routes.sql: the webhooks (vault secrets) and the channel routing stay as they are.
-- Run all of this in the Supabase SQL editor. Safe to run again. No URLs or secrets in this file.
--
-- The site puts the platform at the front of user_agent: "[iPhone · Safari · website · 390x844] Mozilla/…"
-- (src/components/FeedbackModal.jsx). Older clients without it get a best guess from the user agent.

create or replace function public.feedback_to_discord()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  hook text;
  ua text := coalesce(new.user_agent, '');
  plat text;
  sport text;
begin
  if new.message like 'REPORT [%' then return new; end if;
  if new.kind in ('ratings', 'bug') then
    select decrypted_secret into hook from vault.decrypted_secrets
      where name = case new.kind when 'ratings' then 'feedback_discord_webhook_ratings' else 'feedback_discord_webhook_bugs' end limit 1;
  end if;
  if hook is null or hook not like 'https://discord.com/api/webhooks/%' then
    select decrypted_secret into hook from vault.decrypted_secrets where name = 'feedback_discord_webhook' limit 1;
  end if;
  if hook is null or hook not like 'https://discord.com/api/webhooks/%' then return new; end if;

  plat := substring(ua from '^\[([^\]]+)\]');
  if plat is null then
    plat := concat_ws(' · ',
      case when ua ~* 'ipad' then 'iPad' when ua ~* 'iphone|ipod' then 'iPhone' when ua ~* 'android' then 'Android'
           when ua ~* 'cros' then 'Chromebook' when ua ~* 'windows' then 'Windows' when ua ~* 'macintosh' then 'Mac'
           when ua ~* 'linux' then 'Linux' end,
      case when ua ~* 'edga?/' then 'Edge' when ua ~* 'samsungbrowser' then 'Samsung Internet' when ua ~* 'firefox|fxios' then 'Firefox'
           when ua ~* 'crios|chrome/' then 'Chrome' when ua ~* 'safari/' then 'Safari' end);
  end if;
  sport := case
    when new.page like '/bucket%' then 'Basketball'
    when new.page like '/soccer%' then 'Soccer'
    when new.page like '/baseball%' then 'Baseball'
    when new.app = 'bucket' then 'Basketball'
    else 'Football' end;

  perform net.http_post(
    url := hook,
    body := jsonb_build_object(
      'username', 'Build-A-Player Feedback',
      'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', case new.kind when 'bug' then 'Bug' when 'idea' then 'Idea' when 'ratings' then 'Ratings' else 'Feedback' end,
        'description', left(new.message, 1500),
        'color', case new.kind when 'bug' then 15684432 when 'idea' then 6216664 when 'ratings' then 15911244 else 9741240 end,
        'fields', jsonb_build_array(
          jsonb_build_object('name', 'Platform', 'value', coalesce(nullif(plat, ''), 'Unknown'), 'inline', true),
          jsonb_build_object('name', 'Game', 'value', concat_ws(' · ', sport, upper(nullif(new.position, ''))), 'inline', true),
          jsonb_build_object('name', 'Page', 'value', coalesce(nullif(new.page, ''), '/'), 'inline', true),
          jsonb_build_object('name', 'Player', 'value',
            case when new.user_id is not null then coalesce(nullif(new.username, ''), 'Signed in, no username') else 'Guest' end, 'inline', true)
        ),
        'timestamp', to_jsonb(new.created_at)
      ))
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  return new;
end;
$$;
revoke all on function public.feedback_to_discord() from public, anon, authenticated;
