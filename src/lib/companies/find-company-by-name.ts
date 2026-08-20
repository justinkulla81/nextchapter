import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'

// Company is a small table (low hundreds of rows) — cheap to scan in full
// and match with the same loose orgNamesMatch() used everywhere else in the
// codebase for "is this the same company" (containment-based once both
// normalized names are >=4 chars), rather than requiring exact string
// equality. This is what makes "Jobs for the Future (JFF)" and "Jobs for
// the Future" resolve to the same Company row — and generalizes to any
// other name variant, not just that one.
export async function findCompanyByName(name: string | null | undefined): Promise<{ id: string; name: string } | null> {
  if (!name?.trim()) return null
  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  return companies.find((c) => orgNamesMatch(c.name, name)) ?? null
}
