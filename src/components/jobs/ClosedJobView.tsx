import Link from 'next/link'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { baseTitle } from '@/lib/seo/job-title-rules'
import type { TitleJob } from '@/lib/seo/job-titles'

// A job page whose listing we can no longer confirm open (closed, or not re-checked recently). It says what the job was, then keeps the
// visitor on the site with open jobs like it: the same title elsewhere, the employer's other open roles, and one search. Served with
// noindex (generateMetadata), with no job data.
export function ClosedJobView({ jobId, title, companyName, place, similar, sameTitle }: {
  jobId: string
  title: string
  companyName: string
  place: string | null
  similar: { id: string; title: string; locationCity: string | null; locationState: string | null }[]
  sameTitle: TitleJob[]
}) {
  const role = baseTitle(title)
  const list = 'mt-3 space-y-2 text-sm'
  const link = 'font-medium text-brand underline underline-offset-4'
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <SiteNav />
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="mt-2 text-lg">{[companyName || 'Confidential employer', place].filter(Boolean).join(' · ')}</p>
        <p className="mt-3 text-muted-foreground">We can’t confirm this job is still open. It may have been filled or taken down. Here are open jobs like it.</p>
        <Link href={`/jobs?q=${encodeURIComponent(role)}`} className={cn(buttonVariants({ size: 'lg' }), 'mt-6 h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}>
          Search open {role} jobs
        </Link>
        {sameTitle.length > 0 && (
          <section aria-labelledby="closed-same-title" className="mt-10">
            <h2 id="closed-same-title" className="font-display text-xl font-semibold">Open jobs like this</h2>
            <ul className={list}>
              {sameTitle.map((j) => (
                <li key={j.id}>
                  <TrackedLink href={`/jobs/${j.id}`} event="closed_job_similar_clicked" properties={{ jobId, toJobId: j.id, kind: 'same_title' }} className={link}>
                    {j.title}
                  </TrackedLink>
                  <span className="text-muted-foreground"> · {[j.company, j.location].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {similar.length > 0 && (
          <section aria-labelledby="closed-similar" className="mt-10">
            <h2 id="closed-similar" className="font-display text-xl font-semibold">Open roles at {companyName}</h2>
            <ul className={list}>
              {similar.map((j) => (
                <li key={j.id}>
                  <TrackedLink href={`/jobs/${j.id}`} event="closed_job_similar_clicked" properties={{ jobId, toJobId: j.id, kind: 'same_company' }} className={link}>
                    {j.title}
                  </TrackedLink>
                  {j.locationCity && j.locationState ? <span className="text-muted-foreground"> · {j.locationCity}, {j.locationState}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
