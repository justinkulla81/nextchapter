-- One Louisville (formerly Greater Louisville Inc.; greaterlouisville.com redirects to onelouisville.org): Louisville's metro chamber
-- and economic development organization, which runs Live in Lou. It was missing from the state-directory list. Applied 2026-11-17.
INSERT INTO "LocalPartnerOrg" (id, kind, name, state, city, counties, website, source, "sourceUrl", confidence, "updatedAt")
VALUES ('edo-KY-onelouisville', 'LOCAL_EDO', 'One Louisville', 'KY', 'Louisville', ARRAY['jefferson'], 'https://onelouisville.org', 'RESEARCH', 'https://onelouisville.org', 'high', now())
ON CONFLICT (id) DO NOTHING;
