import type { Company } from '@prisma/client'
import { resolveCompanyMetadataIfMissing } from '@/lib/companies/company-lookup'

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
    <p className="text-sm text-muted-foreground">
      {[company.industry, company.sizeBand, company.hqMetro].filter(Boolean).join(' · ') || 'Details still filling in'}
    </p>
  )
}

export function CompanyMetaLineSkeleton() {
  return <p className="text-sm text-muted-foreground">Details still filling in</p>
}
