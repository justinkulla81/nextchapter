-- 2026-11-05: two crawled "search firms" are employers, so they lose the SEARCH_FIRM type.
-- Keystone Automotive Operations: its board (keystonerecruiting.catsone.com) lists its own sales and credit jobs, also posted under its
-- parent LKQ. Partnership with Children: a New York non-profit's own roles (after-school group leader, social work director).
-- Their crawled rows stay (the sync keeps updating them); src/lib/search-firms/not-recruiters.ts keeps them out of the directory,
-- the role pages and the recommendations. Each statement must change exactly one row.
DO $$
DECLARE n int;
BEGIN
  UPDATE "CrmOrganization" SET "orgTypes" = array_remove("orgTypes", 'SEARCH_FIRM'), "updatedAt" = now()
    WHERE id = 'cm0d37baa87f3d41c08088a262232d1a14' AND name = 'Careers | Keystone Automotive Operations';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Keystone not updated (% rows)', n; END IF;
  UPDATE "CrmOrganization" SET "orgTypes" = array_remove("orgTypes", 'SEARCH_FIRM'), "updatedAt" = now()
    WHERE id = 'cm70fd0edaa47144f98e6130bfda4fd944' AND name = 'Partnership with Children';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Partnership with Children not updated (% rows)', n; END IF;
END $$;
-- Revert: UPDATE "CrmOrganization" SET "orgTypes" = array_append("orgTypes", 'SEARCH_FIRM') WHERE id IN ('cm0d37baa87f3d41c08088a262232d1a14','cm70fd0edaa47144f98e6130bfda4fd944');
