-- Release fixtures are intentionally created after reset by
-- scripts/seed-release-fixtures.mjs. Keeping this file present makes the
-- canonical local reset deterministic without silently depending on a
-- missing seed glob.
select 'Action Arena canonical migrations applied; release fixtures run separately.' as seed_status;
