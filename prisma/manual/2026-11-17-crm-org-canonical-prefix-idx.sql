-- Prefix lookups on CrmOrganization's normalized name (findOrgByStrictKey, src/lib/crm/org-lookup.ts): LIKE 'key%' can use a
-- text_pattern_ops index whatever the database collation. Replaces reading every organization to find one by name.
-- Additive; built without blocking writes (run on its own, not in a transaction).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CrmOrganization_canonical_prefix_idx" ON "CrmOrganization" ("canonicalNameNormalized" text_pattern_ops);
