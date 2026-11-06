-- Football Salary Cap, Change Position (QBSalaryCap.jsx): Infinite plays at RB, WR, TE, DB
-- and DL go into qb_salary_infinite_plays next to QB's, tagged with their position.
-- Existing rows (and every QB play, which doesn't send it) take the default, 'qb'.
-- Until this runs, a non-QB play's insert fails on the missing column and nothing is saved;
-- the QB boards read the table as they always have.
-- (LB isn't in the list yet: add it here when LB's salary board ships.)
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.qb_salary_infinite_plays
  add column if not exists pos text not null default 'qb';

alter table public.qb_salary_infinite_plays
  drop constraint if exists qb_salary_infinite_plays_pos_check;
alter table public.qb_salary_infinite_plays
  add constraint qb_salary_infinite_plays_pos_check check (pos in ('qb', 'rb', 'wr', 'te', 'db', 'dl'));

-- each position's board: its best scores first
create index if not exists qb_salary_infinite_plays_pos_score_idx
  on public.qb_salary_infinite_plays (pos, overall_score desc);
