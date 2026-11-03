import Link from 'next/link'
import { BEST_COMPANIES, bestCompanyRank } from '@/lib/rankings/employers-specs'
import { LINK } from '@/components/seo/SeoPage'

// A line on an employer page when the company is on Fortune's 100 Best Companies to Work For, with the source and the list of those
// companies that are hiring now. Renders nothing for any other company. No database read: the list ships with the code.
export function BestCompanyNote({ name }: { name: string }) {
  const rank = bestCompanyRank(name)
  if (rank == null) return null
  return (
    <p className="mt-6 max-w-3xl rounded-xl border border-border bg-tint-sky p-4 text-sm text-navy">
      {name} is No. {rank} on <a href={BEST_COMPANIES.source} rel="noopener" className={LINK}>{BEST_COMPANIES.title}</a> ({BEST_COMPANIES.publisher}).{' '}
      <Link href="/rankings/best-companies-to-work-for-that-are-hiring-now" className={LINK}>See which of these companies are hiring now</Link>.
    </p>
  )
}
