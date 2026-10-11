import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { localFirst } from '@/lib/geo/filters'
import { buildDeck, type AreaInput, type WarnInput } from './build'
import { resolveBrand, type ColorMode } from './brand'
import { loadRuleSet } from './store'
import { CUSTOMER_TYPES, type CustomerType, type Deck, type PersonCard } from './types'

export type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : [])

// Justin's bio: only the facts he approved (see the marketing copy rules).
export const JUSTIN: PersonCard = {
  name: 'Justin Kulla', title: 'Founder and CEO', org: 'NextChapter', side: 'us',
  bio: 'Serial founder with nearly 20 years as an investor, founder and operator in education technology. Founded BusinessBlocks, a venture-backed education company, and sold it to AmTrust. CTO of Edgenuity; Partner at TZP Group; SVP, Global M&A and Venture Investments at AmTrust. MIT MBA, Harvard MPA.',
}

export interface PersonOption { key: string; label: string; card: PersonCard }

export async function loadArea(id: string): Promise<{ area: AreaInput; warn: WarnInput[] } | null> {
  const a = await prisma.geoArea.findUnique({ where: { id } })
  if (!a) return null
  const since = new Date(Date.now() - 365 * 86_400_000)
  const warn = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, state: a.state, ...(a.level === 'COUNTY' ? { county: { contains: a.name.replace(/ (County|Parish|Borough)$/i, ''), mode: 'insensitive' as const } } : {}), noticeDate: { gte: since } },
    orderBy: { employees: { sort: 'desc', nulls: 'last' } }, take: 15,
    select: { employer: true, employees: true, noticeDate: true, effectiveDate: true, industry: true },
  })
  const j = <T,>(v: unknown, d: T) => (Array.isArray(v) ? (v as T) : d)
  return {
    warn,
    area: {
      id: a.id, name: a.name, state: a.state, level: a.level, population: a.population, unemploymentRate: a.unemploymentRate, unemploymentRatePrior: a.unemploymentRatePrior,
      unemploymentAsOf: a.unemploymentAsOf, medianHouseholdIncome: a.medianHouseholdIncome, perCapitaIncome: a.perCapitaIncome, whiteCollarShare: a.whiteCollarShare,
      wcUnemploymentEst: a.wcUnemploymentEst, bcUnemploymentEst: a.bcUnemploymentEst, layoffs12mo: a.layoffs12mo, layoffEvents12mo: a.layoffEvents12mo, layoffs90d: a.layoffs90d,
      higherEdCount: a.higherEdCount, higherEd: j(a.higherEd, []), dataCenterCount: a.dataCenterCount, dataCenters: j(a.dataCenters, []),
      wioaBoards: localFirst(j<(AreaInput['wioaBoards'][number] & { statewide?: boolean })[]>(a.wioaBoards, [])), majorEmployers: j(a.majorEmployers, []), initiatives: a.initiatives, news: j(a.news, []),
    },
  }
}

/** People who could go on the team slide for this pitch. Justin is always first. */
export async function personOptions(area: AreaInput | null, crmOrgId: string | null): Promise<PersonOption[]> {
  const out: PersonOption[] = [{ key: 'justin', label: 'Justin Kulla, Founder and CEO (NextChapter)', card: JUSTIN }]
  area?.wioaBoards.forEach((b, i) => {
    if (b.directorName) out.push({ key: `board:${i}`, label: `${b.directorName}, ${b.directorTitle ?? 'Director'} (${b.name})`, card: { name: b.directorName, title: b.directorTitle ?? 'Director', org: b.name, side: 'them' } })
  })
  if (crmOrgId) {
    const aff = await prisma.crmAffiliation.findMany({
      where: { orgId: crmOrgId, isCurrent: true, person: { deletedAt: null } },
      include: { person: { select: { id: true, fullName: true } }, org: { select: { name: true } } }, take: 8,
    }).catch(() => [])
    for (const x of aff) out.push({ key: `crm:${x.person.id}`, label: `${x.person.fullName}${x.title ? `, ${x.title}` : ''} (${x.org.name}, in your CRM)`, card: { name: x.person.fullName, title: x.title ?? '', org: x.org.name, side: 'them' } })
  }
  return out
}

async function fetchLogo(url: string): Promise<string | undefined> {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return undefined
    const res = await fetch(u, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'NextChapter pitch builder' } })
    if (!res.ok) return undefined
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 2_000_000) return undefined
    const png = await sharp(buf).resize({ width: 600, height: 300, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch { return undefined }
}

export interface Built { deck: Deck; edited: boolean; brandNote?: string; options: PersonOption[]; lead: { id: string; name: string } | null }

export async function buildFromParams(sp: Params, headshotOrigin?: string): Promise<Built | null> {
  const type = one(sp.type) as CustomerType
  if (!CUSTOMER_TYPES.includes(type)) return null

  const leadId = one(sp.lead)
  const lead = leadId ? await prisma.geoOrgLead.findUnique({ where: { id: leadId } }).catch(() => null) : null
  const generic = one(sp.generic) === '1'
  const areaId = one(sp.area) || lead?.geoAreaId || ''
  const loaded = !generic && areaId ? await loadArea(areaId) : null
  const orgName = one(sp.org).trim() || lead?.name || ''
  const website = one(sp.website).trim() || lead?.website || ''
  const logoUrl = one(sp.logoUrl).trim() || (website ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(website.replace(/^https?:\/\//, '').split('/')[0])}&sz=128` : '')
  const logo = logoUrl ? await fetchLogo(logoUrl) : undefined

  const mode = (['nextchapter', 'custom', 'logo'].includes(one(sp.colors)) ? one(sp.colors) : 'nextchapter') as ColorMode
  const { brand, note } = await resolveBrand({ mode, orgName, logo, primary: one(sp.primary), accent: one(sp.accent) })

  const { rules, edited } = await loadRuleSet(type)
  const options = await personOptions(loaded?.area ?? null, lead?.crmOrganizationId ?? null)
  const picked = new Set(many(sp.ppl))
  const people: PersonCard[] = generic && !picked.size ? [] : options.filter((o) => picked.has(o.key)).map((o) => o.card)
  for (const line of one(sp.more).split('\n')) {
    const [name, title, org] = line.split('|').map((x) => x.trim())
    if (name) people.push({ name, title: title ?? '', org: org || orgName, side: org?.toLowerCase() === 'nextchapter' ? 'us' : 'them' })
  }
  if (headshotOrigin && people.some((p) => p.name === JUSTIN.name)) { /* headshot loaded by the route */ }

  const deck = buildDeck({ rules, brand, area: loaded?.area ?? null, warn: loaded?.warn, people })
  return { deck, edited, brandNote: note, options, lead: lead ? { id: lead.id, name: lead.name } : null }
}

export async function loadHeadshot(origin: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${origin}/images/team/justin-kulla.jpg`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return undefined
    const jpg = await sharp(Buffer.from(await res.arrayBuffer())).resize(240, 240, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer()
    return `data:image/jpeg;base64,${jpg.toString('base64')}`
  } catch { return undefined }
}
