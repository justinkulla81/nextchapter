import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'

type CompanyName = { id: string; name: string; canonicalNameNormalized: string }

// The match is the loose orgNamesMatch() used everywhere else in the codebase for
// "is this the same company" (containment-based once both normalized names are >=4
// chars), rather than exact equality. That is what makes "Jobs for the Future (JFF)"
// and "Jobs for the Future" resolve to the same Company row.
//
// Containment can't be asked of Postgres, so the names are matched in memory. Company
// holds ~100k rows, so the list is read once and held for ten minutes per server
// instance: it used to be re-read in full (~84k rows) on every contact page view, and
// that was a large share of the database's outgoing traffic (Supabase egress quota).
// A company created in the last ten minutes is found after the next refresh.
const TTL_MS = 10 * 60_000
let held: { at: number; companies: Promise<CompanyName[]> } | null = null

function companyNames(): Promise<CompanyName[]> {
  if (!held || Date.now() - held.at > TTL_MS) {
    const companies = prisma.company.findMany({ select: { id: true, name: true, canonicalNameNormalized: true } })
    held = { at: Date.now(), companies }
    // A failed read is not held: the next call reads again.
    companies.catch(() => {
      if (held?.companies === companies) held = null
    })
  }
  return held.companies
}

export async function findCompanyByName(
  name: string | null | undefined
): Promise<CompanyName | null> {
  if (!name?.trim()) return null
  const companies = await companyNames()
  return companies.find((c) => orgNamesMatch(c.name, name)) ?? null
}
