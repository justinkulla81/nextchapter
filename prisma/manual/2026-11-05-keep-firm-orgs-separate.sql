-- 2026-11-05: keep 19 organizations from being re-linked to a company by name.
-- The nightly company-graph job (src/lib/companies/company-graph-sync.ts) links every unlinked CRM organization whose name exactly
-- matches a company, except one marked companyLinkState = 'KEPT_SEPARATE' ("never revisited"). Un-linking alone did not hold: at
-- 11:40 UTC the job re-linked all 19 (state AUTO). These are marked kept separate instead:
--   * Tempus LLC (a small crawled search firm) matched the employer Tempus, whose 212 postings then counted as the firm's searches.
--   * 18 duplicates retired in 2026-11-05-clean-search-firm-names.sql matched the crawler's own "Careers | ..." company rows, which
--     would list them in the directory again as staffing companies.
-- Each statement must change exactly one row or the whole block aborts.
DO $$
DECLARE n int;
BEGIN
  UPDATE "CrmOrganization" SET "companyId" = NULL, "companyLinkState" = 'KEPT_SEPARATE', "updatedAt" = now()
    WHERE id IN (
    'cma3f133d4224d40b6bd3c45660765e3f1',
    'cmbb66e1cdeef64e7bb78889e4ef189ca9',
    'cmebac0d2bda7a4c8aaeb5f435b1f28f5d',
    'cm34a959af5e2d4878aa5a639c602821d3',
    'cmfe0f596bb27a49a8abb75c3f5379ea16',
    'cm98cef2bdaef64eba8a8ba6a7773907f1',
    'cm342802220e8d4a288adb156aa3bb153d',
    'cm7bb3794caf814eac831d38b026f4ee30',
    'cmf16e5fe729784a06b150c96dfb536b84',
    'cmv25kozy001kq2lfobrmuasq',
    'cmce77d7ab8a684087b0012ca2dbc1c096',
    'cm64beb9ade0df48e7a0ba3c55090d2b7d',
    'cm27c20bae9cf142b38274a4cc83f2b03f',
    'cmc20e8f84baf94326aefc1ec0c56f9aa1',
    'cm3078bc6634cf4739bae577e1ed381637',
    'cmv263c4x01cdq2pzxeym39vh',
    'cmv26etd202clq2pzqgqo7m45',
    'cmv25uois00l9q2pzdixcj3va',
    'cmtx1o90v01t2q2bmilt74bbr'
    ) AND "companyLinkState" = 'AUTO';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 19 THEN RAISE EXCEPTION 'expected 19 organizations, changed %', n; END IF;
END $$;

-- REVERT (restores the links as the nightly job had set them). Not applied.
-- UPDATE "CrmOrganization" o SET "companyId" = v.cid, "companyLinkState" = 'AUTO', "updatedAt" = now()
--   FROM (VALUES
--     ('cma3f133d4224d40b6bd3c45660765e3f1', 'cmv26ukou01g7i3065p3blmrx'),
--     ('cmbb66e1cdeef64e7bb78889e4ef189ca9', 'cmv270grk01z8i306z37lrdwi'),
--     ('cmebac0d2bda7a4c8aaeb5f435b1f28f5d', 'cmv26hd5a0017lf067pziuejj'),
--     ('cm34a959af5e2d4878aa5a639c602821d3', 'cmv26wdt301pmi306fo2yxcf7'),
--     ('cmfe0f596bb27a49a8abb75c3f5379ea16', 'cmv27d5tm051hi306po5bzs09'),
--     ('cm98cef2bdaef64eba8a8ba6a7773907f1', 'cmv27sbhb08kbi306f4sg4ajv'),
--     ('cm342802220e8d4a288adb156aa3bb153d', 'cmv26h8dt0011lf0676vmr0hn'),
--     ('cm7bb3794caf814eac831d38b026f4ee30', 'cmv26h7mu0010lf06khk4fbtq'),
--     ('cmf16e5fe729784a06b150c96dfb536b84', 'cmv2705id01yyi3065magm977'),
--     ('cmv25kozy001kq2lfobrmuasq', 'cmv26h3vj000vlf06z4okiwde'),
--     ('cmce77d7ab8a684087b0012ca2dbc1c096', 'cmv27czl5051ei3064p9iczog'),
--     ('cm64beb9ade0df48e7a0ba3c55090d2b7d', 'cmv27005301yti306kvvjnztj'),
--     ('cm27c20bae9cf142b38274a4cc83f2b03f', 'cmv26qluf00p8i306indg48m2'),
--     ('cmc20e8f84baf94326aefc1ec0c56f9aa1', 'cmv27cwz7051ci3062a0yxbpc'),
--     ('cm3078bc6634cf4739bae577e1ed381637', 'cmv27rzp608k5i306typrxsq8'),
--     ('cmv263c4x01cdq2pzxeym39vh', 'cmv271ef302f1i306n42om7nc'),
--     ('cmv26etd202clq2pzqgqo7m45', 'cmv83l7xw03ubju06f0pe6lv7'),
--     ('cmv25uois00l9q2pzdixcj3va', 'cmuzvobg001dzq2ruo2h77nqe'),
--     ('cmtx1o90v01t2q2bmilt74bbr', 'cmvdnkdvd043ijm08zp4zgovp')
--   ) AS v(oid, cid) WHERE o.id = v.oid;
