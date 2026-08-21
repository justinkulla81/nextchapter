import type { Company, CompanySizeBand } from '@prisma/client'
import { resolveCompanyMetadataIfMissing } from '@/lib/companies/company-lookup'

// Human-readable employee-count ranges for the enum's own band comments
// (schema.prisma) — "MID_LARGE" on its own reads as a database value, not
// company size, to a candidate.
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

// resolveCompanyMetadataIfMissing can make a real LLM call (industry/size
// classification, see its own doc comment) the first time anyone views a
// given company — isolated here behind its own Suspense boundary so that
// call never blocks the rest of a company page's render. Shared between the
// candidate-facing (src/app/dashboard/companies/[id]/page.tsx) and admin
// (src/app/support/admin/(portal)/companies/[id]/page.tsx) company detail
// pages, which both show this exact line. Skeleton text intentionally
// matches the real "nothing resolved yet" copy, so there's no visible
// flash/layout shift when the resolved line swaps in.
export async function CompanyMetaLine({ companyRow }: { companyRow: Company }) {
  const company = await resolveCompanyMetadataIfMissing(companyRow)
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {[company.industry, company.sizeBand ? SIZE_BAND_LABEL[company.sizeBand] : null, company.hqMetro]
          .filter(Boolean)
          .join(' · ') || 'Details still filling in'}
      </p>
      {company.description && <p className="mt-1 text-sm text-foreground">{company.description}</p>}
    </>
  )
}

export function CompanyMetaLineSkeleton() {
  return <p className="text-sm text-muted-foreground">Details still filling in</p>
}
