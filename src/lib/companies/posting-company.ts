import 'server-only'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { prisma } from '@/lib/prisma'
import { squashKey, MIN_SQUASHED_LENGTH } from '@/lib/companies/company-duplicates'
import { displayCompanyName, fixAllCapsCompanyName, normalizeOrgName } from '@/lib/text/org-name-match'

// Every job that is added gets tied to its directory Company at the moment it is
// added, so the directory never lags the board (before this, only the nightly
// signals job created Company rows, up to a day late, and postings were joined to
// companies by re-normalising their free-text name on every read).
//
// Best-effort by design: a posting must always be saved. If the link can't be made
// the posting just has companyId null and the nightly job links it later.

// Placeholder names a posting can carry when the real employer is unknown — these
// must never become a directory company.
const NOT_A_COMPANY = /^(unknown|n\/a|confidential|undisclosed|various|multiple)\b/i
// Resume entries that are a situation, not an employer. Whole-string only, so a real
// company that merely starts with the word ("Independent Bank") is still a company.
const NOT_AN_EMPLOYER =
  /^(self[- ]?employed|freelance(r)?|independent( consultant| contractor)?|consultant|contractor|stealth( startup)?|sabbatical|career break|stay[- ]at[- ]home( parent)?|homemaker|retired|unemployed|none|n\/?a|student|various|confidential|private (client|practice)|own business|my own (business|company))$/i

export function isLinkableCompanyName(name: string | null | undefined): name is string {
  if (!name) return false
  const trimmed = name.trim()
  return trimmed.length > 1 && !NOT_A_COMPANY.test(trimmed) && !NOT_AN_EMPLOYER.test(trimmed) && normalizeOrgName(trimmed).length > 0
}

export async function linkPostingToCompany(rawName: string | null | undefined): Promise<string | null> {
  if (!isLinkableCompanyName(rawName)) return null
  try {
    return (await getOrCreateCompany(rawName)).id
  } catch (error) {
    console.error('Could not link posting to a company:', rawName, error)
    return null
  }
}

/** One lookup per distinct employer — for bulk writes. Keyed by the raw name as given. */
export async function linkPostingsToCompanies(rawNames: (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const byKey = new Map<string, string | null>() // normalised key -> companyId
  const out = new Map<string, string | null>()
  for (const raw of rawNames) {
    if (!isLinkableCompanyName(raw) || out.has(raw)) continue
    const key = normalizeOrgName(raw)
    if (!byKey.has(key)) byKey.set(key, await linkPostingToCompany(raw))
    out.set(raw, byKey.get(key) ?? null)
  }
  return out
}

/**
 * Bulk form of linkPostingsToCompanies for large backfills: one read for every name,
 * one insert for the missing ones, one re-read. Same names, keys and placeholder
 * rules as getOrCreateCompany. Keyed by the raw name as given.
 */
export async function linkCompaniesBulk(rawNames: (string | null | undefined)[]): Promise<Map<string, string>> {
  const keyOf = new Map<string, string>() // raw -> normalised key
  const nameOfKey = new Map<string, string>() // key -> display name (first seen)
  for (const raw of rawNames) {
    if (!isLinkableCompanyName(raw) || keyOf.has(raw)) continue
    const name = fixAllCapsCompanyName(displayCompanyName(raw.trim()))
    const key = normalizeOrgName(name)
    if (!key) continue
    keyOf.set(raw, key)
    if (!nameOfKey.has(key)) nameOfKey.set(key, name)
  }
  const keys = [...nameOfKey.keys()]
  const out = new Map<string, string>()
  if (keys.length === 0) return out
  const found = await prisma.company.findMany({ where: { canonicalNameNormalized: { in: keys } }, select: { id: true, canonicalNameNormalized: true } })
  const idByKey = new Map(found.map((c) => [c.canonicalNameNormalized, c.id]))
  // Spelling variants of a company we already have ("JPMorgan Chase" for "JP Morgan
  // Chase") resolve to it instead of becoming a second one.
  const unresolved = keys.filter((k) => !idByKey.has(k))
  const squashedOf = new Map(unresolved.map((k) => [k, squashKey(k)]))
  const squashedKeys = [...new Set([...squashedOf.values()].filter((sq) => sq.length >= MIN_SQUASHED_LENGTH))]
  if (squashedKeys.length > 0) {
    const variants = await prisma.$queryRaw<{ id: string; sq: string }[]>`
      SELECT id, regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g') AS sq
        FROM "Company"
       WHERE regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g') = ANY(${squashedKeys})
       ORDER BY "createdAt" DESC`
    const idBySquashed = new Map(variants.map((v) => [v.sq, v.id])) // earliest wins: DESC order, last set
    for (const k of unresolved) {
      const id = idBySquashed.get(squashedOf.get(k)!)
      if (id) idByKey.set(k, id)
    }
  }
  const missing = keys.filter((k) => !idByKey.has(k))
  if (missing.length > 0) {
    await prisma.company.createMany({
      data: missing.map((k) => ({ name: nameOfKey.get(k)!, canonicalNameNormalized: k })),
      skipDuplicates: true,
    })
    const created = await prisma.company.findMany({ where: { canonicalNameNormalized: { in: missing } }, select: { id: true, canonicalNameNormalized: true } })
    for (const c of created) idByKey.set(c.canonicalNameNormalized, c.id)
  }
  for (const [raw, key] of keyOf) {
    const id = idByKey.get(key)
    if (id) out.set(raw, id)
  }
  return out
}
