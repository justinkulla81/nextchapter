import Link from 'next/link'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Shown (with a 404 status, so search engines drop the page) for a job that closed or
// was never public — see src/lib/jobs/public-job-page.ts.
export default function JobNotFound() {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <SiteNav />
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">This job is no longer open</h1>
        <p className="mt-3 text-muted-foreground">
          The employer stopped listing it, or it isn&apos;t a public listing. Search the jobs that are open right now.
        </p>
        <Link href="/jobs" className={cn(buttonVariants({ size: 'lg' }), 'mt-6 h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}>
          Search open jobs
        </Link>
      </main>
    </div>
  )
}
