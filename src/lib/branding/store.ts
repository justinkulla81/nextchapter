import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeHex } from './colors'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { buildPair, type BrandPair, type ColorCandidate } from './scan'

// Brand colors kept per organization (OrgBrand, SQL in prisma/manual/2026-10-27-org-brand.sql). Fail-soft: a missing table, a bad row or a
// database error reads as "no brand", so the page renders in NextChapter's own look and nothing breaks.

export type OrgBrandKind = 'WORKFORCE_BOARD' | 'JOB_CENTER' | 'ECON_DEV' | 'COLLEGE' | 'EMPLOYER' | 'STATE_AGENCY'

export interface OrgBrandRecord {
  kind: string
  sourceId: string
  siteUrl: string | null
  pair: BrandPair
  candidates: ColorCandidate[]
  source: 'SCAN' | 'MANUAL'
  scannedAt: Date
}

function toRecord(r: { kind: string; sourceId: string; siteUrl: string | null; primary: string; secondary: string; secondaryDerived: boolean; candidates: unknown; source: string; scannedAt: Date }): OrgBrandRecord | null {
  const primary = normalizeHex(r.primary)
  const secondary = normalizeHex(r.secondary)
  if (!primary || !secondary) return null
  // Ink and text colors are rebuilt from the two stored colors, so they always follow the current contrast rules.
  const candidates = Array.isArray(r.candidates) ? (r.candidates as ColorCandidate[]).filter((c) => c && typeof c.hex === 'string') : []
  return { kind: r.kind, sourceId: r.sourceId, siteUrl: r.siteUrl, pair: buildPair(primary, secondary, r.secondaryDerived), candidates, source: r.source === 'MANUAL' ? 'MANUAL' : 'SCAN', scannedAt: r.scannedAt }
}

export async function getOrgBrand(kind: OrgBrandKind, sourceId: string): Promise<OrgBrandRecord | null> {
  try {
    const r = await prisma.orgBrand.findUnique({ where: { kind_sourceId: { kind, sourceId } } })
    return r ? toRecord(r) : null
  } catch {
    return null
  }
}

export async function saveOrgBrand(input: { kind: OrgBrandKind; sourceId: string; siteUrl: string | null; pair: BrandPair; candidates: ColorCandidate[]; source: 'SCAN' | 'MANUAL' }): Promise<void> {
  const data = {
    siteUrl: input.siteUrl,
    primary: input.pair.primary,
    secondary: input.pair.secondary,
    secondaryDerived: input.pair.secondaryDerived,
    candidates: input.candidates as unknown as Prisma.InputJsonValue,
    source: input.source,
    scannedAt: new Date(),
  }
  await prisma.orgBrand.upsert({ where: { kind_sourceId: { kind: input.kind, sourceId: input.sourceId } }, create: { kind: input.kind, sourceId: input.sourceId, ...data }, update: data })
}

/** The key an employer's colors are stored under: its normalized name, the same join key Company uses, so every page that knows only a name finds them. */
export const employerBrandKey = (companyName: string): string => normalizeOrgName(companyName)

/** The colors for an employer by name, or null. Fail-soft like getOrgBrand. */
export async function getEmployerBrand(companyName: string): Promise<OrgBrandRecord | null> {
  const key = employerBrandKey(companyName)
  return key ? getOrgBrand('EMPLOYER', key) : null
}

export async function recordBrandMiss(kind: OrgBrandKind, sourceId: string, reason: string): Promise<void> {
  await prisma.orgBrandMiss.upsert({ where: { kind_sourceId: { kind, sourceId } }, create: { kind, sourceId, reason }, update: { reason, checkedAt: new Date() } })
}

/** Ids already tried, so a run skips them. A miss older than `olderThanDays` is tried again. */
export async function brandMissIds(kind: OrgBrandKind, olderThanDays = 90): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000)
  const rows = await prisma.orgBrandMiss.findMany({ where: { kind, checkedAt: { gt: cutoff } }, select: { sourceId: true } })
  return new Set(rows.map((r) => r.sourceId))
}

export async function brandedIds(kind: OrgBrandKind): Promise<Set<string>> {
  const rows = await prisma.orgBrand.findMany({ where: { kind }, select: { sourceId: true } })
  return new Set(rows.map((r) => r.sourceId))
}
