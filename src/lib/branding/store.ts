import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeHex } from './colors'
import { buildPair, type BrandPair, type ColorCandidate } from './scan'

// Brand colors kept per organization (OrgBrand, SQL in prisma/manual/2026-10-27-org-brand.sql). Fail-soft: a missing table, a bad row or a
// database error reads as "no brand", so the page renders in NextChapter's own look and nothing breaks.

export type OrgBrandKind = 'WORKFORCE_BOARD' | 'JOB_CENTER' | 'ECON_DEV'

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
