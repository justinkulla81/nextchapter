// Computes the 0-100 fit score (src/lib/geo/partner-scoring.ts) for WIOA boards,
// American Job Centers, EDA districts, state agencies, local EDOs and nonprofit leads.
//   npx tsx scripts/geo/score-partners.ts [--apply]
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { countyKey } from '../../src/lib/workforce/places'
import { scorePartner, type AreaSignal, type FitScore, type PartnerKind } from '../../src/lib/geo/partner-scoring'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { contactStrength, strongerContact, type ContactStrength } from '../../src/lib/crm/contact-strength'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

type Area = { id: string; level: string; state: string; name: string; laborForce: number | null; whiteCollarShare: number | null; layoffs12mo: number; layoffs90d: number; wcUnemploymentEst: number | null }

function combine(areas: Area[]): AreaSignal {
  if (areas.length === 0) return {}
  const lf = areas.reduce((s, a) => s + (a.laborForce ?? 0), 0)
  const w = (f: (a: Area) => number | null) => {
    const xs = areas.filter((a) => f(a) != null && (a.laborForce ?? 0) > 0)
    const d = xs.reduce((s, a) => s + (a.laborForce ?? 0), 0)
    return d > 0 ? xs.reduce((s, a) => s + (f(a) as number) * (a.laborForce ?? 0), 0) / d : null
  }
  return { laborForce: lf || null, whiteCollarShare: w((a) => a.whiteCollarShare), wcUnemploymentEst: w((a) => a.wcUnemploymentEst),
    layoffs12mo: areas.reduce((s, a) => s + a.layoffs12mo, 0), layoffs90d: areas.reduce((s, a) => s + a.layoffs90d, 0) }
}

async function writeScores(table: string, idCol: string, rows: { id: string; s: FitScore }[]) {
  if (!apply || rows.length === 0) return
  for (let i = 0; i < rows.length; i += 500) {
    const c = rows.slice(i, i + 500)
    await prisma.$executeRawUnsafe(
      `update "${table}" t set "fitScore" = v.s, "fitBreakdown" = v.b::jsonb, "fitScoredAt" = now()
       from (select unnest($1::text[]) id, unnest($2::float8[]) s, unnest($3::text[]) b) v where t."${idCol}" = v.id`,
      c.map((r) => r.id), c.map((r) => r.s.total), c.map((r) => JSON.stringify({ coverage: r.s.coverage, parts: r.s.parts })))
  }
}
const dist = (name: string, rows: { s: FitScore }[]) => {
  const t = rows.map((r) => r.s.total).sort((a, b) => a - b)
  console.log(`${name.padEnd(22)} n=${String(t.length).padStart(5)}  min ${t[0]}  median ${t[Math.floor(t.length / 2)]}  p90 ${t[Math.floor(t.length * 0.9)]}  max ${t[t.length - 1]}`)
}

type Strength = ContactStrength
const best = strongerContact
/** Mailbox providers and shared government domains say nothing about who works at a given body. */
const SHARED_DOMAIN = /(^|\.)(gmail|yahoo|outlook|hotmail|aol|icloud|me|live|msn|comcast|proton(mail)?)\.(com|me)$|\.(gov|us|mil)$/i
const domainOf = (url: string | null): string | null => {
  if (!url) return null
  try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^(www\d?|home|web)\./, '') } catch { return null }
}

async function main() {
  // Contacts in the CRM: by organization name, and by the address a person writes from.
  const byOrgName = new Map<string, Strength>()
  const byDomain = new Map<string, Strength>()
  // Raw SQL so the script does not depend on how fresh the generated client is.
  type P = { warmth: string; connectedAt: Date | null; linkedinDegree: string | null; firstRepliedAt: Date | null; lastTouchedAt: Date | null; touchCount: number; notes: string | null }
  const affs = await prisma.$queryRaw<(P & { name: string })[]>`
    select o.name, p.warmth::text as warmth, p."connectedAt", p."linkedinDegree", p."firstRepliedAt", p."lastTouchedAt", p."touchCount", p.notes
    from "CrmAffiliation" a join "CrmOrganization" o on o.id = a."orgId" join "CrmPerson" p on p.id = a."personId"
    where a."isCurrent" = true and p."deletedAt" is null`
  for (const a of affs) {
    const k = normalizeOrgName(a.name)
    const st = contactStrength(a)
    if (k && st) byOrgName.set(k, best(byOrgName.get(k), st)!)
  }
  const people = await prisma.$queryRaw<(P & { email: string | null; emails: string[] })[]>`
    select email, emails, warmth::text as warmth, "connectedAt", "linkedinDegree", "firstRepliedAt", "lastTouchedAt", "touchCount", notes
    from "CrmPerson" where "deletedAt" is null and email is not null`
  for (const p of people) {
    const st = contactStrength(p)
    if (!st) continue
    for (const e of new Set([p.email, ...p.emails].filter(Boolean) as string[])) {
      const d = e.split('@')[1]?.toLowerCase().trim()
      if (d && !SHARED_DOMAIN.test(d)) byDomain.set(d, best(byDomain.get(d), st)!)
    }
  }
  const contactFor = (name: string, website: string | null): Strength | null => {
    const d = domainOf(website)
    const viaDomain = d && !SHARED_DOMAIN.test(d) ? [...byDomain].reduce<Strength | null>((acc, [dom, st]) => (dom === d || dom.endsWith(`.${d}`) ? best(acc, st) : acc), null) : null
    return best(byOrgName.get(normalizeOrgName(name)), viaDomain)
  }
  console.log(`CRM contacts: ${byOrgName.size} orgs by name, ${byDomain.size} email domains`)

  const areas = (await prisma.geoArea.findMany({ select: { id: true, level: true, state: true, name: true, laborForce: true, whiteCollarShare: true, layoffs12mo: true, layoffs90d: true, wcUnemploymentEst: true } })) as Area[]
  const byId = new Map(areas.map((a) => [a.id, a]))
  const stateArea = new Map(areas.filter((a) => a.level === 'STATE').map((a) => [a.state, a]))
  const countiesByState = new Map<string, Area[]>()
  for (const a of areas.filter((x) => x.level === 'COUNTY')) (countiesByState.get(a.state) ?? countiesByState.set(a.state, []).get(a.state)!).push(a)
  const forCounties = (state: string, keys: string[]): AreaSignal => {
    const set = new Set(keys)
    const hit = (countiesByState.get(state) ?? []).filter((a) => set.has(countyKey(a.name)))
    return hit.length ? combine(hit) : combine(stateArea.get(state) ? [stateArea.get(state)!] : [])
  }

  // WIOA boards
  const boards = await prisma.workforceBoard.findMany()
  const bs = boards.map((b) => ({
    id: b.id,
    s: scorePartner({ kind: b.statewide ? 'STATE_BOARD' : 'WIOA_BOARD', area: b.statewide ? combine(stateArea.get(b.state) ? [stateArea.get(b.state)!] : []) : forCounties(b.state, b.counties),
      hasName: !!b.directorName, hasEmail: !!b.directorEmail, hasPhone: !!b.directorPhone, hasWebsite: !!b.website,
      contact: contactFor(b.name, b.website) }),
  }))
  await writeScores('WorkforceBoard', 'id', bs); dist('WIOA boards', bs)

  // American Job Centers
  const ajcs = await prisma.$queryRaw<{ id: string; name: string; state: string; countyFips: string | null; centerType: string | null; phone: string | null; generalEmail: string | null; businessEmail: string | null; detailsUrl: string | null }[]>`select id, name, state, "countyFips", "centerType", phone, "generalEmail", "businessEmail", "detailsUrl" from "AmericanJobCenter"`
  const as = ajcs.map((a) => ({ id: a.id, s: scorePartner({ kind: 'AJC', area: a.countyFips && byId.get(a.countyFips) ? combine([byId.get(a.countyFips)!]) : combine(stateArea.get(a.state) ? [stateArea.get(a.state)!] : []),
    hasName: false, hasEmail: !!(a.businessEmail || a.generalEmail), hasPhone: !!a.phone, hasWebsite: !!a.detailsUrl, ajcType: a.centerType, hasBusinessRep: !!a.businessEmail, contact: byOrgName.get(normalizeOrgName(a.name)) ?? null }) }))
  await writeScores('AmericanJobCenter', 'id', as); dist('American Job Centers', as)

  // EDA districts, state agencies, local EDOs
  const lp = await prisma.$queryRaw<{ id: string; kind: string; name: string; state: string; counties: string[]; website: string | null; contactName: string | null; email: string | null; phone: string | null }[]>`select id, kind, name, state, counties, website, "contactName", email, phone from "LocalPartnerOrg"`
  const ls = lp.map((o) => ({ id: o.id, s: scorePartner({ kind: o.kind as PartnerKind, area: o.kind === 'STATE_AGENCY' ? combine(stateArea.get(o.state) ? [stateArea.get(o.state)!] : []) : forCounties(o.state, o.counties),
    hasName: !!o.contactName, hasEmail: !!o.email, hasPhone: !!o.phone, hasWebsite: !!o.website, contact: contactFor(o.name, o.website) }) }))
  await writeScores('LocalPartnerOrg', 'id', ls); dist('EDDs / agencies / EDOs', ls)

  // nonprofit leads
  const leads = await prisma.$queryRaw<{ id: string; kind: string; name: string; state: string; geoAreaId: string | null; revenue: number | null; website: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null }[]>`select id, kind, name, state, "geoAreaId", revenue, website, "contactName", "contactEmail", "contactPhone" from "GeoOrgLead" where "dismissedAt" is null`
  const ns = leads.map((l) => ({ id: l.id, s: scorePartner({ kind: l.kind === 'WORKFORCE' ? 'NONPROFIT_WORKFORCE' : l.kind === 'CHAMBER' ? 'CHAMBER' : 'NONPROFIT_ECON',
    area: l.geoAreaId && byId.get(l.geoAreaId) ? combine([byId.get(l.geoAreaId)!]) : combine(stateArea.get(l.state) ? [stateArea.get(l.state)!] : []),
    hasName: !!l.contactName, hasEmail: !!l.contactEmail, hasPhone: !!l.contactPhone, hasWebsite: !!l.website, revenue: l.revenue, name: l.name,
    contact: contactFor(l.name, l.website) }) }))
  await writeScores('GeoOrgLead', 'id', ns); dist('Nonprofit leads', ns)

  console.log(apply ? 'written' : 'dry run — pass --apply')
}
main().finally(() => prisma.$disconnect())
