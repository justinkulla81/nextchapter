import { TrackedLink } from '@/components/marketing/TrackedLink'

// The report pages are the site's most linked-to and most read pages (a few clicks a month from search, more from people who share
// them). A reader who came for the numbers may be the person in them: this block hands them to the pages that help someone who has
// lost a job or fears it, and gives those pages links from a page search engines already trust.
const STEPS = [
  { href: '/layoffs', label: 'Layoff tracker', why: 'Recent layoffs and WARN notices by state and employer' },
  { href: '/tools/severance-calculator', label: 'Severance calculator', why: 'What a package should be, by years of service' },
  { href: '/unemployment-benefits', label: 'Unemployment benefits by state', why: 'The weekly amount, the weeks and how to file' },
  { href: '/resources/72-hours', label: 'Laid off? Your first 72 hours', why: 'What to do first, in order' },
] as const

export function ReportNextSteps({ page }: { page: string }) {
  return (
    <section aria-labelledby="report-next-steps" className="mx-auto w-full max-w-4xl px-6 pb-12">
      <h2 id="report-next-steps" className="font-display text-xl font-semibold text-ink">If this is your situation</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.href} className="rounded-xl border border-border bg-white p-4">
            <TrackedLink
              href={s.href}
              event="report_next_step_clicked"
              properties={{ page, destination: s.href }}
              className="text-base font-semibold text-brand underline underline-offset-4"
            >
              {s.label}
            </TrackedLink>
            <p className="mt-1 text-sm text-muted-foreground">{s.why}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
