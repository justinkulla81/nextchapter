import 'server-only'
import type { CompanyOwnershipType, CompanySizeBand } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Partners Master Build Script §A3.3 — Premium "target list builder: filter
// companies by trajectory, size, ownership, geography." Reuses the real
// Company/CompanySignal rows the posting-signal cron already computes
// (src/lib/companies/signals.ts) rather than any new sourcing. Ownership is
// the one dimension with no automated detection (see Company.ownershipType's
// schema comment) — filtering on it only ever matches admin-confirmed rows;
// it never guesses.

export const SIZE_BAND_LABEL: Record<CompanySizeBand, string> = {
  MICRO: '1-10 employees',
  SMALL: '11-50 employees',
  SMALL_MID: '51-200 employees',
  MID: '201-1,000 employees',
  MID_LARGE: '1,001-5,000 employees',
  LARGE: '5,001-20,000 employees',
  ENTERPRISE: '20,001-100,000 employees',
  MEGA: '100,000+ employees',
}

export const OWNERSHIP_LABEL: Record<CompanyOwnershipType, string> = {
  PE_BACKED: 'PE-backed',
  VC_BACKED: 'VC-backed',
  PUBLIC: 'Public',
  PRIVATELY_HELD_INDEPENDENT: 'Privately held, independent',
}

export interface TargetListFilters {
  trajectory?: 'growing' | 'flat' | 'contracting'
  sizeBand?: CompanySizeBand
  ownershipType?: CompanyOwnershipType
  hqMetro?: string
}

export interface TargetListCompany {
  id: string
  name: string
  industry: string | null
  sizeBand: CompanySizeBand | null
  hqMetro: string | null
  ownershipType: CompanyOwnershipType | null
  trajectory: string | null
  openRolesTotal: number | null
  openRolesDirectorPlus: number | null
  weekStartDate: Date | null
}

// Every hqMetro value currently present on a real Company row — the
// filter's own option list, so it never offers a metro with zero real
// matches.
export async function listAvailableTargetMetros(): Promise<string[]> {
  const rows = await prisma.company.findMany({
    where: { hqMetro: { not: null } },
    select: { hqMetro: true },
    distinct: ['hqMetro'],
  })
  return rows.map((r) => r.hqMetro!).sort()
}

export async function searchTargetCompanies(filters: TargetListFilters, limit = 50): Promise<TargetListCompany[]> {
  const companies = await prisma.company.findMany({
    where: {
      sizeBand: filters.sizeBand ?? undefined,
      ownershipType: filters.ownershipType ?? undefined,
      hqMetro: filters.hqMetro ?? undefined,
    },
    select: {
      id: true,
      name: true,
      industry: true,
      sizeBand: true,
      hqMetro: true,
      ownershipType: true,
      signals: {
        orderBy: { weekStartDate: 'desc' },
        take: 1,
        select: { trajectory: true, openRolesTotal: true, openRolesDirectorPlus: true, weekStartDate: true },
      },
    },
    take: 200, // over-fetch before the trajectory filter, which lives on the joined signal, not a Company column
  })

  const withSignal = companies.map((c) => {
    const latest = c.signals[0]
    return {
      id: c.id,
      name: c.name,
      industry: c.industry,
      sizeBand: c.sizeBand,
      hqMetro: c.hqMetro,
      ownershipType: c.ownershipType,
      trajectory: latest?.trajectory ?? null,
      openRolesTotal: latest?.openRolesTotal ?? null,
      openRolesDirectorPlus: latest?.openRolesDirectorPlus ?? null,
      weekStartDate: latest?.weekStartDate ?? null,
    }
  })

  const filtered = filters.trajectory ? withSignal.filter((c) => c.trajectory === filters.trajectory) : withSignal

  // Companies with an actual hiring signal first (most useful for a target
  // list), then alphabetical.
  return filtered
    .sort((a, b) => {
      if (!!a.weekStartDate !== !!b.weekStartDate) return a.weekStartDate ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .slice(0, limit)
}
