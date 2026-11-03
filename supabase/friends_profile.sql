-- ════════════════════════════════════════════════════════════════════════════
-- Profile → Friends: "Remove friend"
-- ════════════════════════════════════════════════════════════════════════════
-- The friend list (src/components/app/FriendsSection.jsx, src/lib/friends.js)
-- uses the same friend_requests table as the 1v1 lobby (VersusLobby.jsx). The
-- lobby only ever inserts and updates rows; removing a friend deletes the
-- pair's rows, which needs a DELETE policy if row level security is on.
--
-- Without this, Remove friend falls back to setting status = 'removed' (works
-- only where the existing update policy allows that player to update the row,
-- usually the one who received the request) and otherwise shows an error.
--
-- Safe to run more than once. Run in the Supabase SQL editor.

drop policy if exists "either friend can remove" on public.friend_requests;
create policy "either friend can remove" on public.friend_requests
  for delete using (auth.uid()::text = from_id::text or auth.uid()::text = to_id::text);
