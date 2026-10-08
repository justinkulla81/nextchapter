import type { CrmBackgroundKind, CrmOrgType, CrmWarmth } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName } from '@/lib/crm/normalize'

/**
 * LinkedIn network distance → a starting warmth. Someone already 1st-degree
 * is a genuinely warmer lead than someone you've never interacted with. No
 * signal (not LinkedIn, scrape failed) returns null, so nothing is written
 * rather than a false COLD.
 */
export function warmthFromConnectionDegree(degree: string | null | undefined): CrmWarmth | null {
  if (!degree) return null
  const d = degree.toLowerCase()
  if (d.includes('1st')) return 'HOT'
  if (d.includes('2nd')) return 'WARM'
  return 'COLD' // 3rd-degree, or any other value LinkedIn ever sends here
}

const WARMTH_RANK: Record<CrmWarmth, number> = { UNKNOWN: 0, COLD: 1, WARM: 2, HOT: 3 }

/**
 * The warmth a fresh capture should set on an existing record, or null to
 * leave it alone.
 *
 * Warmth is your judgement, so the extension only ever touches it while it
 * is still the extension's own guess: either unset, or exactly what the
 * degree seen last time would have produced. And it only goes up — a 2nd
 * who accepts your invite becomes HOT, but nothing here ever cools someone
 * you've graded.
 */
export function nextWarmth(
  current: CrmWarmth,
  previousDegree: string | null | undefined,
  newDegree: string | null | undefined,
): CrmWarmth | null {
  const derived = warmthFromConnectionDegree(newDegree)
  if (!derived) return null
  if (current === 'UNKNOWN') return derived
  const stillAutomatic = current === warmthFromConnectionDegree(previousDegree)
  return stillAutomatic && WARMTH_RANK[derived] > WARMTH_RANK[current] ? derived : null
}

/**
 * The degree the extension last saw for someone. The column only exists
 * since this was added; before that the degree lived only in the raw
 * capture payload, so the newest one of those stands in.
 */
export async function previousConnectionDegree(person: { id: string; linkedinDegree: string | null }): Promise<string | null> {
  if (person.linkedinDegree) return person.linkedinDegree
  const records = await prisma.crmSourceRecord.findMany({
    where: { personId: person.id, sourceFile: 'CHROME_EXTENSION' },
    orderBy: { importedAt: 'desc' },
    select: { rawJson: true },
    take: 10,
  })
  for (const r of records) {
    const d = (r.rawJson as { connectionDegree?: unknown } | null)?.connectionDegree
    if (typeof d === 'string' && d) return d
  }
  return null
}

export interface ScrapedSchool { name: string; detail?: string }
export interface ScrapedFormerEmployer { name: string; title?: string }

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Untrusted payload → at most 6 distinct, real-looking schools. */
export function schoolsFrom(raw: unknown): ScrapedSchool[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ScrapedSchool[] = []
  for (const s of raw) {
    const name = clean((s as ScrapedSchool)?.name, 120)
    if (!isRealOrgName(name)) continue
    const key = normalizeOrgName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ name, detail: clean((s as ScrapedSchool)?.detail, 160) || undefined })
    if (out.length === 6) break
  }
  return out
}

export function formerEmployerFrom(raw: unknown): ScrapedFormerEmployer | null {
  const name = clean((raw as ScrapedFormerEmployer)?.name, 120)
  if (!isRealOrgName(name)) return null
  return { name, title: clean((raw as ScrapedFormerEmployer)?.title, 160) || undefined }
}

async function orgFor(name: string, type: CrmOrgType) {
  const key = normalizeOrgName(name)
  if (!key) return null
  const org = await prisma.crmOrganization.upsert({
    where: { canonicalNameNormalized: key },
    create: { name, canonicalNameNormalized: key, orgTypes: [type] },
    update: {},
    select: { id: true, orgTypes: true },
  })
  // Only schools are tagged after the fact: the Education section is where
  // LinkedIn itself lists schools, so a university that was first saved as
  // someone's employer really is one. An employer tag is never added this
  // way — every org already gets one when it's someone's current job.
  if (type === 'UNIVERSITY' && !org.orgTypes.includes('UNIVERSITY')) {
    await prisma.crmOrganization.update({ where: { id: org.id }, data: { orgTypes: { push: 'UNIVERSITY' } } })
  }
  return org.id
}

async function link(personId: string, orgId: string, kind: CrmBackgroundKind, detail: string | undefined) {
  const where = { personId_orgId_kind: { personId, orgId, kind } }
  const existing = await prisma.crmBackground.findUnique({ where, select: { detail: true } })
  if (existing) {
    // Fill a blank detail; never overwrite one.
    if (!existing.detail && detail) await prisma.crmBackground.update({ where, data: { detail } })
    return false
  }
  await prisma.crmBackground.create({ data: { personId, orgId, kind, detail: detail ?? null } })
  return true
}

/**
 * Records where someone studied and, once they've left it, where they last
 * worked. Additive only: a school missing from this capture (LinkedIn shows
 * two before "Show all") is never removed. Returns what was new, for the
 * capture's confirmation message.
 */
export async function recordBackground(
  personId: string,
  input: { schools: ScrapedSchool[]; formerEmployer: ScrapedFormerEmployer | null; currentOrgId: string | null },
): Promise<string[]> {
  const added: string[] = []
  for (const s of input.schools) {
    const orgId = await orgFor(s.name, 'UNIVERSITY')
    if (orgId && (await link(personId, orgId, 'SCHOOL', s.detail))) added.push(s.name)
  }
  const fe = input.formerEmployer
  if (fe) {
    const orgId = await orgFor(fe.name, 'EMPLOYER')
    if (orgId && orgId !== input.currentOrgId && (await link(personId, orgId, 'FORMER_EMPLOYER', fe.title))) {
      added.push(`former employer ${fe.name}`)
    }
  }
  return added
}
