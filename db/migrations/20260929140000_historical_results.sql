-- Explicit provenance for archived evenings and manually entered results with historical stats.
alter table public.mixes
  add column archive_source text,
  add column archive_key text,
  add constraint mixes_archive_pair_check check (
    (archive_source is null and archive_key is null)
    or (length(btrim(archive_source)) between 1 and 40
        and length(btrim(archive_key)) between 1 and 100)
  );
create unique index mixes_group_archive_key_unique
  on public.mixes (group_id, archive_key) where archive_key is not null;

alter table public.matches
  add column stats_origin text,
  add column source_reference text,
  add constraint matches_stats_origin_check check (
    stats_origin is null or (source = 'manual' and stats_origin = 'popflash')
  ),
  add constraint matches_source_reference_check check (
    source_reference is null or length(btrim(source_reference)) between 1 and 100
  );
create unique index matches_mix_source_reference_unique
  on public.matches (mix_id, source_reference) where source_reference is not null;
