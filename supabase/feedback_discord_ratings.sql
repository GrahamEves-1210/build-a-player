-- Ratings feedback → Discord #ratings-discussion (the rest stays in #suggestions-discussion: feedback_discord.sql)
-- Setup:
--   1. Discord: #ratings-discussion → Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL
--   2. Paste it below in place of PASTE_RATINGS_WEBHOOK_URL_HERE (keep the quotes)
--   3. Run all of this in the Supabase SQL editor. Safe to run again. Don't commit the URL.

delete from vault.secrets where name = 'feedback_discord_webhook_ratings';
select vault.create_secret('PASTE_RATINGS_WEBHOOK_URL_HERE', 'feedback_discord_webhook_ratings');

create or replace function public.feedback_to_discord()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  hook text;
begin
  if new.message like 'REPORT [%' then return new; end if;
  -- (a Ratings message goes to #ratings-discussion when that webhook is set; everything else, and Ratings without it, to #suggestions-discussion)
  if new.kind = 'ratings' then
    select decrypted_secret into hook from vault.decrypted_secrets where name = 'feedback_discord_webhook_ratings' limit 1;
  end if;
  if hook is null or hook not like 'https://discord.com/api/webhooks/%' then
    select decrypted_secret into hook from vault.decrypted_secrets where name = 'feedback_discord_webhook' limit 1;
  end if;
  if hook is null or hook not like 'https://discord.com/api/webhooks/%' then return new; end if;
  perform net.http_post(
    url := hook,
    body := jsonb_build_object(
      'username', 'Build-A-Player Feedback',
      'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', case new.kind when 'bug' then 'Bug' when 'idea' then 'Idea' when 'ratings' then 'Ratings' else 'Feedback' end,
        'description', left(new.message, 1500),
        'color', case new.kind when 'bug' then 15684432 when 'idea' then 6216664 when 'ratings' then 15911244 else 9741240 end,
        'footer', jsonb_build_object('text', concat_ws(' · ',
          coalesce(nullif(new.username, ''), 'Guest'),
          case new.app when 'bucket' then 'Basketball' when 'nfl' then 'Football' end,
          upper(nullif(new.position, '')))),
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

drop trigger if exists feedback_to_discord on public.feedback;
create trigger feedback_to_discord
  after insert on public.feedback
  for each row execute function public.feedback_to_discord();
