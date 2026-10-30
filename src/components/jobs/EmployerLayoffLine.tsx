import { TrackedLink } from '@/components/marketing/TrackedLink'
import { noticesForEmployer } from '@/lib/seo/org-notices'

// On a public job page: the employer's layoff filings of the last twelve months (WARN notices filed with state labor departments,
// the same list the employer page shows, owner decision 2026-10-27). Public record, stated plainly. Nothing when there are none;
// a failed read just leaves the line out.

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export async function EmployerLayoffLine({ jobId, company }: { jobId: string; company: string }) {
  const n = await noticesForEmployer(company).catch(() => null)
  if (!n || !n.slug || n.total === 0) return null
  const latest = new Date(Math.max(...n.items.map((i) => i.noticeDate.getTime())))
  const filings = n.total === 1 ? 'one layoff notice' : `${n.total} layoff notices`
  const workers = n.workers > 0 ? `, covering ${n.workers.toLocaleString('en-US')} workers` : ''
  return (
    <p className="mt-6 rounded-xl border border-border bg-white p-5 text-[15px] leading-relaxed">
      <span className="font-medium">{company} has filed {filings} in the last twelve months{workers}</span>, most recently {dateFmt.format(latest)}. These are public WARN filings with state labor departments, and an open role can sit alongside them.{' '}
      <TrackedLink
        href={`/layoffs/company/${n.slug}`}
        event="job_page_employer_layoffs_clicked"
        properties={{ jobId, company, notices: n.total }}
        className="font-semibold text-brand underline underline-offset-4"
      >
        See the filings
      </TrackedLink>
    </p>
  )
}
