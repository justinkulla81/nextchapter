import 'server-only'
import { prisma } from '@/lib/prisma'

// Alias reads are best-effort: the CompanyAlias table is applied by hand, so a
// missing table must read as "no aliases" and never break creating a company.

/** The company a confirmed alias points at, or null. */
export async function aliasCompanyId(aliasKey: string): Promise<string | null> {
  try {
    const row = await prisma.companyAlias.findFirst({
      where: { aliasKey, status: 'CONFIRMED' },
      orderBy: { createdAt: 'asc' },
      select: { companyId: true },
    })
    return row?.companyId ?? null
  } catch {
    return null
  }
}

/** Confirmed alias targets for many keys at once (key -> companyId). */
export async function aliasCompanyIds(aliasKeys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (aliasKeys.length === 0) return out
  try {
    const rows = await prisma.companyAlias.findMany({
      where: { aliasKey: { in: aliasKeys }, status: 'CONFIRMED' },
      orderBy: { createdAt: 'desc' }, // earliest wins: set last
      select: { aliasKey: true, companyId: true },
    })
    for (const r of rows) out.set(r.aliasKey, r.companyId)
  } catch {
    // table not applied yet
  }
  return out
}

/** "aliasKey|companyId" for every decided pair (confirmed or rejected), so suggestions skip them. */
export async function decidedAliasPairs(): Promise<Set<string>> {
  try {
    const rows = await prisma.companyAlias.findMany({ select: { aliasKey: true, companyId: true } })
    return new Set(rows.map((r) => `${r.aliasKey}|${r.companyId}`))
  } catch {
    return new Set()
  }
}
