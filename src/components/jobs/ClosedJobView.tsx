import Link from 'next/link'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { baseTitle } from '@/lib/seo/job-title-rules'

// A job page whose listing we can no longer confirm open (closed, or not re-checked recently). It keeps the visitor on the site with
// open jobs like it: the employer's other open roles, and one search for the title. Served with noindex (generateMetadata), no job data.
export function ClosedJobView({ jobId, title, companyName, similar }: { jobId: string; title: string; companyName: string; similar: { id: string; title: string; locationCity: string | null; locationState: string | null }[] }) {
  const role = baseTitle(title)
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <SiteNav />
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">We can’t confirm this job is still open</h1>
        <p className="mt-3 text-muted-foreground">
          {companyName ? `${title} at ${companyName}` : title} may have been filled or taken down. Here are open jobs like it.
        </p>
        <Link
          href={`/jobs?q=${encodeURIComponent(role)}`}
          className={cn(buttonVariants({ size: 'lg' }), 'mt-6 h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
        >
          Search open {role} jobs
        </Link>
        {similar.length > 0 && (
          <section aria-labelledby="closed-similar" className="mt-10">
            <h2 id="closed-similar" className="font-display text-xl font-semibold">Open roles at {companyName}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {similar.map((j) => (
                <li key={j.id}>
                  <TrackedLink href={`/jobs/${j.id}`} event="closed_job_similar_clicked" properties={{ jobId, toJobId: j.id, company: companyName }} className="font-medium text-brand underline underline-offset-4">
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
