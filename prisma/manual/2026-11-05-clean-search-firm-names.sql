-- 2026-11-05: clean the names of 30 crawled search firms and merge their duplicates.
--
-- The crawler read a firm's name off its careers page, so 31 CRM organizations were created as "Careers | Roberts Recruiting",
-- "Optima Search | Europe & America", "PReP Intl = INTL-PREQUALIFIED READY EMPLOYEES FOR POWER INTL, LLC" and the like.
--   * 12 had no clash: renamed in place (name and canonicalNameNormalized, so the page address changes too).
--   * 18 duplicated an organization that already existed under the clean name. canonicalNameNormalized is unique, so a rename
--     was impossible: the search-firm row moves to the existing organization (tagged SEARCH_FIRM with the BD goal, as
--     tagFirmOrg does), and the duplicate is left in place but inert (SEARCH_FIRM type and company link removed, note added).
--   * Keystone Automotive Operations (cm0d37baa87f3d41c08088a262232d1a14) is left alone: the existing organization is an
--     employer and the crawled page looks like its own careers site, so it is not tagged as a recruiter.
-- SearchFirm.name keeps the raw crawled name: the firm's postings are matched on it (sourceName). Old page addresses
-- redirect (src/lib/search-firms/renamed-firms.json, read by next.config.ts). Every statement must change exactly one row,
-- or the whole block aborts. Applied to production on 2026-11-05 through the Supabase connector.

DO $$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('cmv26816d01qyq2pzqhvi9k8b', 'Advanced Placement, LLC (now', 'advanced placement llc now', 'Advanced Placement, LLC', 'advanced placement'),
      ('cm4cfe5759fa8948d49d86dd9b790d4b6d', 'Careers | Engaging Talent', 'careers engaging talent', 'Engaging Talent', 'engaging talent'),
      ('cm70fd0edaa47144f98e6130bfda4fd944', 'Careers | Partnership with Children', 'careers partnership with children', 'Partnership with Children', 'partnership with children'),
      ('cmbf1d03c133de429e833d8e06666afa4a', 'Careers | Staff Connect', 'careers staff connect', 'Staff Connect', 'staff connect'),
      ('cmffd24dd0fa2447f7b1b41b8808fe9751', 'Careers | Synergy Jobs (Pty)', 'careers synergy jobs pty', 'Synergy Jobs', 'synergy jobs'),
      ('cm8c96607ed1ae4b539390c694e14e3b49', 'Careers | Vitaver and Associates', 'careers vitaver and associates', 'Vitaver and Associates', 'vitaver and associates'),
      ('cmv2632o401bjq2pzx7rtd22x', 'Integrat8staff | Job and Temp Staffing Agency in Los Angeles', 'integrat8staff job and temp staffing agency in los angeles', 'Integrat8staff', 'integrat8staff'),
      ('cmvkf196l000iq2xuqt5i19gw', 'Optima Search | Europe & America', 'optima search europe & america', 'Optima Search', 'optima search'),
      ('cmv25xzks00vmq2pzbzmmigdi', 'PReP Intl = INTL-PREQUALIFIED READY EMPLOYEES FOR POWER INTL, LLC', 'prep intl intl prequalified ready employees for power intl', 'PReP Intl', 'prep intl'),
      ('cmv266w5201ndq2pz8mcx1hww', 'Recruiting Firm', 'recruiting firm', 'Barker Search', 'barker search'),
      ('cmv266zvf01npq2pzbb0iaxn2', 'RightStaff | Staffing Solutions Partner', 'rightstaff staffing solutions partner', 'RightStaff', 'rightstaff'),
      ('cmv25xa3100teq2pzfjap3qxl', 'Teilur Talent Nearshore Staffing Agency for LATAM Tech Talent', 'teilur talent nearshore staffing agency for latam tech talent', 'Teilur Talent', 'teilur talent')
    ) AS t(id, old_name, old_canon, new_name, new_canon)
  LOOP
    UPDATE "CrmOrganization" SET name = r.new_name, "canonicalNameNormalized" = r.new_canon, "updatedAt" = now()
      WHERE id = r.id AND name = r.old_name AND "canonicalNameNormalized" = r.old_canon;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'rename of % not applied (% rows)', r.id, n; END IF;
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
      ('cma3f133d4224d40b6bd3c45660765e3f1', 'cmv25o7zz0014q2pzq5ip8ffu', 'Careers', 'Jobskey'),
      ('cmbb66e1cdeef64e7bb78889e4ef189ca9', 'cmc9b08b2e6709477695198281772fc328', 'Careers | Apex Staffing', 'Apex Staffing'),
      ('cmebac0d2bda7a4c8aaeb5f435b1f28f5d', 'cm30e7dcfce4de47e5aa7a47104156d3f2', 'Careers | Blue Ridge Executive Search', 'Blue Ridge Executive Search'),
      ('cm34a959af5e2d4878aa5a639c602821d3', 'cmf5c2e964465c42b4b22e75fdabcffa65', 'Careers | Chelsea Search Group', 'Chelsea Search Group'),
      ('cmfe0f596bb27a49a8abb75c3f5379ea16', 'cmvuvskys00half08crs806gb', 'Careers | McCloskey Partners', 'McCloskey Partners'),
      ('cm98cef2bdaef64eba8a8ba6a7773907f1', 'cmvooqzaz0fgmq29udb6kklod', 'Careers | Med Career Solutions', 'Med Career Solutions'),
      ('cm342802220e8d4a288adb156aa3bb153d', 'cmvoos7ob0kdjq29uakbwj96t', 'Careers | MK Consulting Group', 'MK Consulting Group'),
      ('cm7bb3794caf814eac831d38b026f4ee30', 'cmd40fc12e26c44838965c6d7e3154e7da', 'Careers | Nenni and Associates', 'Nenni and Associates'),
      ('cmf16e5fe729784a06b150c96dfb536b84', 'cmf9cbef6dc2084b409e50776ce1af34bc', 'Careers | NOW Hiring Heroes', 'NOW Hiring Heroes'),
      ('cmv25kozy001kq2lfobrmuasq', 'cmb5199d828d64476fab8ed3c29f2dffcb', 'Careers | Roberts Recruiting', 'Roberts Recruiting'),
      ('cmce77d7ab8a684087b0012ca2dbc1c096', 'cmvoo7yj401yoq2hakx44b6nx', 'Careers | Rubix Recruiting', 'Rubix Recruiting'),
      ('cm64beb9ade0df48e7a0ba3c55090d2b7d', 'cmd35a3a5d75254d5480b29c68ecde5667', 'Careers | Specialty Medical Staffing', 'Specialty Medical Staffing'),
      ('cm27c20bae9cf142b38274a4cc83f2b03f', 'cmvooq0pi0cdeq29uh8poqht6', 'Careers | Talon Recruiting', 'Talon Recruiting'),
      ('cmc20e8f84baf94326aefc1ec0c56f9aa1', 'cmvooombx08lcq29un6qhjbv6', 'Careers | Tekla Research', 'Tekla Research'),
      ('cm3078bc6634cf4739bae577e1ed381637', 'cmvooqzld0gpiq29umlxvp5tz', 'Careers | VW International', 'VW International'),
      ('cmv263c4x01cdq2pzxeym39vh', 'cmvooqzdj0fy6q29url98fqwk', 'National recruiting and consulting firm. C-suite through associate', 'Riderflex'),
      ('cmv26etd202clq2pzqgqo7m45', 'cmvoolbar01dmq29uatitfqdo', 'StaffBuffalo | Recruiting | Talent Optimization | Human Resources | HR', 'StaffBuffalo'),
      ('cmtx1o90v01t2q2bmilt74bbr', 'cmc6af846a65c44da5aedddee3d28466fa', 'The Barton Partnership | B Corp™', 'The Barton Partnership')
    ) AS t(dup_id, keep_id, dup_name, clean_name)
  LOOP
    UPDATE "SearchFirm" SET "crmOrgId" = r.keep_id WHERE "crmOrgId" = r.dup_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'search-firm row of % not moved (% rows)', r.dup_id, n; END IF;

    UPDATE "CrmOrganization" SET
      "orgTypes" = CASE WHEN 'SEARCH_FIRM' = ANY("orgTypes"::text[]) THEN "orgTypes" ELSE array_append("orgTypes", 'SEARCH_FIRM') END,
      goals = CASE WHEN 'BD' = ANY(goals::text[]) THEN goals ELSE array_append(goals, 'BD') END,
      "updatedAt" = now()
      WHERE id = r.keep_id AND name = r.clean_name;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'organization % not tagged (% rows)', r.keep_id, n; END IF;

    UPDATE "CrmOrganization" SET
      "orgTypes" = array_remove("orgTypes", 'SEARCH_FIRM'),
      "companyId" = NULL,
      notes = COALESCE(notes || E'\n', '') || 'Duplicate of "' || r.clean_name || '" (crawler page title as name); search-firm row moved there 2026-11-05.',
      "updatedAt" = now()
      WHERE id = r.dup_id AND name = r.dup_name;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'duplicate % not retired (% rows)', r.dup_id, n; END IF;
  END LOOP;
END $$;

-- REVERT (run as a whole; restores the exact earlier state). Not applied.
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN SELECT * FROM (VALUES
--       ('cmv26816d01qyq2pzqhvi9k8b', 'Advanced Placement, LLC (now', 'advanced placement llc now', 'Advanced Placement, LLC', 'advanced placement'),
--       ('cm4cfe5759fa8948d49d86dd9b790d4b6d', 'Careers | Engaging Talent', 'careers engaging talent', 'Engaging Talent', 'engaging talent'),
--       ('cm70fd0edaa47144f98e6130bfda4fd944', 'Careers | Partnership with Children', 'careers partnership with children', 'Partnership with Children', 'partnership with children'),
--       ('cmbf1d03c133de429e833d8e06666afa4a', 'Careers | Staff Connect', 'careers staff connect', 'Staff Connect', 'staff connect'),
--       ('cmffd24dd0fa2447f7b1b41b8808fe9751', 'Careers | Synergy Jobs (Pty)', 'careers synergy jobs pty', 'Synergy Jobs', 'synergy jobs'),
--       ('cm8c96607ed1ae4b539390c694e14e3b49', 'Careers | Vitaver and Associates', 'careers vitaver and associates', 'Vitaver and Associates', 'vitaver and associates'),
--       ('cmv2632o401bjq2pzx7rtd22x', 'Integrat8staff | Job and Temp Staffing Agency in Los Angeles', 'integrat8staff job and temp staffing agency in los angeles', 'Integrat8staff', 'integrat8staff'),
--       ('cmvkf196l000iq2xuqt5i19gw', 'Optima Search | Europe & America', 'optima search europe & america', 'Optima Search', 'optima search'),
--       ('cmv25xzks00vmq2pzbzmmigdi', 'PReP Intl = INTL-PREQUALIFIED READY EMPLOYEES FOR POWER INTL, LLC', 'prep intl intl prequalified ready employees for power intl', 'PReP Intl', 'prep intl'),
--       ('cmv266w5201ndq2pz8mcx1hww', 'Recruiting Firm', 'recruiting firm', 'Barker Search', 'barker search'),
--       ('cmv266zvf01npq2pzbb0iaxn2', 'RightStaff | Staffing Solutions Partner', 'rightstaff staffing solutions partner', 'RightStaff', 'rightstaff'),
--       ('cmv25xa3100teq2pzfjap3qxl', 'Teilur Talent Nearshore Staffing Agency for LATAM Tech Talent', 'teilur talent nearshore staffing agency for latam tech talent', 'Teilur Talent', 'teilur talent')
--     ) AS t(id, old_name, old_canon, new_name, new_canon)
--   LOOP
--     UPDATE "CrmOrganization" SET name = r.old_name, "canonicalNameNormalized" = r.old_canon, "updatedAt" = now() WHERE id = r.id AND name = r.new_name;
--   END LOOP;
--   FOR r IN SELECT * FROM (VALUES
--       ('cma3f133d4224d40b6bd3c45660765e3f1', 'cmv25o7zz0014q2pzq5ip8ffu', 'sf:jobskey2', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv26ukou01g7i3065p3blmrx', ARRAY['SEARCH_FIRM']::text[], ARRAY['BD']::text[]),
--       ('cmbb66e1cdeef64e7bb78889e4ef189ca9', 'cmc9b08b2e6709477695198281772fc328', 'sf:apexstaffing', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv270grk01z8i306z37lrdwi', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmebac0d2bda7a4c8aaeb5f435b1f28f5d', 'cm30e7dcfce4de47e5aa7a47104156d3f2', 'sf:blueridgeexecutivesearch', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv26hd5a0017lf067pziuejj', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cm34a959af5e2d4878aa5a639c602821d3', 'cmf5c2e964465c42b4b22e75fdabcffa65', 'sf:chelseasearchgroup', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv26wdt301pmi306fo2yxcf7', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmfe0f596bb27a49a8abb75c3f5379ea16', 'cmvuvskys00half08crs806gb', 'sf:mccloskeypartnersllc', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv27d5tm051hi306po5bzs09', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cm98cef2bdaef64eba8a8ba6a7773907f1', 'cmvooqzaz0fgmq29udb6kklod', 'sf:medcareersolutions', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv27sbhb08kbi306f4sg4ajv', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cm342802220e8d4a288adb156aa3bb153d', 'cmvoos7ob0kdjq29uakbwj96t', 'sf:mkconsultinggroup', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv26h8dt0011lf0676vmr0hn', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cm7bb3794caf814eac831d38b026f4ee30', 'cmd40fc12e26c44838965c6d7e3154e7da', 'sf:nenniandassociates', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv26h7mu0010lf06khk4fbtq', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmf16e5fe729784a06b150c96dfb536b84', 'cmf9cbef6dc2084b409e50776ce1af34bc', 'sf:nowhiringheroes', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv2705id01yyi3065magm977', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmv25kozy001kq2lfobrmuasq', 'cmb5199d828d64476fab8ed3c29f2dffcb', 'sf:robertsrecruiting', ARRAY['SEARCH_FIRM']::text[], 'cmv26h3vj000vlf06z4okiwde', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmce77d7ab8a684087b0012ca2dbc1c096', 'cmvoo7yj401yoq2hakx44b6nx', 'sf:rubixrecruiting', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv27czl5051ei3064p9iczog', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cm64beb9ade0df48e7a0ba3c55090d2b7d', 'cmd35a3a5d75254d5480b29c68ecde5667', 'sf:specialtymedicalstaffing', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv27005301yti306kvvjnztj', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cm27c20bae9cf142b38274a4cc83f2b03f', 'cmvooq0pi0cdeq29uh8poqht6', 'sf:talonrecruiting', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv26qluf00p8i306indg48m2', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmc20e8f84baf94326aefc1ec0c56f9aa1', 'cmvooombx08lcq29un6qhjbv6', 'sf:teklaresearch', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv27cwz7051ci3062a0yxbpc', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cm3078bc6634cf4739bae577e1ed381637', 'cmvooqzld0gpiq29umlxvp5tz', 'sf:vwirecruit', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmv27rzp608k5i306typrxsq8', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmv263c4x01cdq2pzxeym39vh', 'cmvooqzdj0fy6q29url98fqwk', 'sf:riderflex', ARRAY['SEARCH_FIRM']::text[], 'cmv271ef302f1i306n42om7nc', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmv26etd202clq2pzqgqo7m45', 'cmvoolbar01dmq29uatitfqdo', 'sf:staffbuffalo', ARRAY['SEARCH_FIRM']::text[], 'cmv83l7xw03ubju06f0pe6lv7', ARRAY['EMPLOYER']::text[], ARRAY[]::text[]),
--       ('cmtx1o90v01t2q2bmilt74bbr', 'cmc6af846a65c44da5aedddee3d28466fa', 'sf:bartonpartnership', ARRAY['EMPLOYER','SEARCH_FIRM']::text[], 'cmvdnkdvd043ijm08zp4zgovp', ARRAY['EMPLOYER','VENDOR']::text[], ARRAY[]::text[])
--     ) AS t(dup_id, keep_id, source_key, dup_types, dup_company, keep_types, keep_goals)
--   LOOP
--     UPDATE "SearchFirm" SET "crmOrgId" = r.dup_id WHERE "sourceKey" = r.source_key AND "crmOrgId" = r.keep_id;
--     UPDATE "CrmOrganization" SET "orgTypes" = r.keep_types::"CrmOrgType"[], goals = r.keep_goals::"CrmGoal"[], "updatedAt" = now() WHERE id = r.keep_id;
--     UPDATE "CrmOrganization" SET "orgTypes" = r.dup_types::"CrmOrgType"[], "companyId" = r.dup_company,
--       notes = NULLIF(regexp_replace(notes, E'\\n?Duplicate of ".*" \\(crawler page title as name\\); search-firm row moved there 2026-11-05\\.$', ''), ''),
--       "updatedAt" = now() WHERE id = r.dup_id;
--   END LOOP;
-- END $$;
