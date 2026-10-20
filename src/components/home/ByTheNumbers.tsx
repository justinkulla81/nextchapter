const STATS = [
  {
    value: '27.1%',
    label: 'Of unemployed people had been jobless 27+ weeks in September 2026, up from 23.6% a year earlier.',
    href: '/reports/displacement-report-september-2026',
    source: 'NextChapter, September 2026 report (BLS)',
  },
  {
    value: '6.5 months',
    label: 'Average job search for people who were laid off, in a 2026 survey.',
    href: 'https://unitedwaynca.org/blog/how-long-does-it-take-to-find-a-job-2026-survey/',
    source: 'United Way NCA survey',
  },
  {
    value: '24.2%',
    label: 'Of mid-career professionals went 5+ years without a meaningful raise or promotion, as of June 2026.',
    href: '/reports/displacement-report-september-2026',
    source: 'NextChapter, September 2026 report',
  },
]

export function ByTheNumbers() {
  return (
    <div>
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-navy">You&apos;re not imagining it</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Whatever your situation, it&apos;s real and well-documented in the labor market — not a
            personal failing.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-light-gray bg-white px-5 py-6">
              <p className="text-2xl font-bold text-brand">{stat.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stat.label}</p>
              <a
                href={stat.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Source: {stat.source}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
