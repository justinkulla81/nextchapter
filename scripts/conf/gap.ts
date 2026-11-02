import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const q = async (label: string, sql: string) => { console.log('\n## ' + label); console.table(await p.$queryRawUnsafe(sql)) }
  await q('crm orgs by type', `select t::text, count(*)::int n, count(website)::int with_site from "CrmOrganization", unnest("orgTypes") t group by 1 order by 2 desc`)
  await q('assoc-like crm orgs', `select count(*)::int n, count(website)::int with_site from "CrmOrganization" where name ~* '(association|society|institute of|council|federation|alliance|guild|chamber|league|academy of|college of)' `)
  await q('assoc-like w/o conference (host match)', `
   with ev as (select split_part("urlKey",'/',1) h, lower(organizer) o from "ConferenceEvent")
   select count(*)::int n from "CrmOrganization" c where website is not null and name ~* '(association|society|institute of|council|federation|alliance|guild|league|academy of|college of)'
   and not exists (select 1 from ev where ev.h = regexp_replace(lower(regexp_replace(c.website,'^https?://(www\\.)?','')),'[/?#].*$','') or ev.o = lower(c.name))`)
  await q('sample', `
   with ev as (select split_part("urlKey",'/',1) h, lower(organizer) o from "ConferenceEvent")
   select name, website, "usState", industry from "CrmOrganization" c where website is not null and name ~* '(association|society|institute of|council|federation|alliance|guild|league)'
   and not exists (select 1 from ev where ev.h = regexp_replace(lower(regexp_replace(c.website,'^https?://(www\\.)?','')),'[/?#].*$','') or ev.o = lower(c.name)) order by random() limit 25`)
  await q('industry of assoc-like crm gaps', `
   with ev as (select split_part("urlKey",'/',1) h, lower(organizer) o from "ConferenceEvent")
   select coalesce(industry,'(none)') industry, count(*)::int n from "CrmOrganization" c where website is not null and name ~* '(association|society|institute of|council|federation|alliance|guild|league)'
   and not exists (select 1 from ev where ev.h = regexp_replace(lower(regexp_replace(c.website,'^https?://(www\\.)?','')),'[/?#].*$','') or ev.o = lower(c.name)) group by 1 order by 2 desc limit 30`)
  await q('association pages', `select count(*)::int n from (select lower(organizer) from "ConferenceEvent" where published group by 1 having count(*)>=2) x`)
  await q('tables', `select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%assoc%' or table_name ilike '%event%' or table_name ilike '%conference%')`)
}
main().finally(() => p.$disconnect())
