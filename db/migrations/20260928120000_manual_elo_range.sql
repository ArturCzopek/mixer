-- Keep per-group manual ELO within the range approved by Artur on 2026-09-28.
alter table public.group_members
  drop constraint group_members_manual_skill_override_check;

alter table public.group_members
  add constraint group_members_manual_skill_override_check
  check (manual_skill_override between 600 and 2500);
