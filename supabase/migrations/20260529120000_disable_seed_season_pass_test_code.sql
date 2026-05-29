-- Disable the seed/test code without changing max_redemptions: redeem_season_pass
-- rejects inactive codes before redemption limits, and max_redemptions must stay
-- null or positive per season_pass_redeem_codes_max_redemptions_check.
update public.season_pass_redeem_codes
set active = false
where code = 'ARENA-S1-TEST';
