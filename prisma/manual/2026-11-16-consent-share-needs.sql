-- A member can let a workforce program see the help they said they need (money pressures such as rent, childcare and
-- health coverage, and barriers such as getting to work), so the program can match them to benefits.
-- Default off: no row means not shared. Additive; applied to production 2026-11-16.
ALTER TYPE "InstitutionConsentScope" ADD VALUE IF NOT EXISTS 'SHARE_NEEDS';
