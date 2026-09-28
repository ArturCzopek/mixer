-- Preserve the winning tally when a later 1:1 swap removes a voter's ballot.
create function public.record_vote_winner_count() returns trigger
language plpgsql volatile
set search_path = ''
as $$
begin
  if old.status = 'voting' and new.status = 'locked' then
    update public.mixes
    set vote_result = jsonb_set(
      coalesce(vote_result, '{}'::jsonb),
      '{winnerVotes}',
      to_jsonb((
        select count(*)::integer from public.votes
        where mix_id = new.id and variant_id = new.chosen_variant_id
      )), true
    )
    where id = new.id;
  end if;
  return null;
end;
$$;

create trigger mixes_vote_winner_count
  after update of status on public.mixes
  for each row execute function public.record_vote_winner_count();

revoke execute on function public.record_vote_winner_count() from public, anon, authenticated;
