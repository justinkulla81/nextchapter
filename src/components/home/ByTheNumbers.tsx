const STATS = [
  {
    value: '27.1%',
    label: 'Of all unemployed people had been looking for work 27 weeks or more in September 2026, up from 23.6% a year earlier.',
    href: '/reports/white-collar-employment-report-september-2026',
    source: 'NextChapter White Collar Employment Report, Sept 2026 (BLS Employment Situation)',
  },
  {
    value: '0.75%',
    label: 'Of the white-collar labor force was unemployed 27 weeks or more, January to August 2026, up from 0.56% a year earlier. The rise is larger than its margin of error.',
    href: '/reports/white-collar-employment-report-september-2026',
    source: 'NextChapter White Collar Employment Report, Sept 2026 (Census CPS microdata)',
  },
  {
    value: '24.2%',
    label: 'Of mid-career professionals, 10 to 15 years in, went 5+ years without a meaningful raise or promotion, as of June 2026.',
    href: '/reports/white-collar-employment-report-september-2026',
    source: 'Burning Glass Institute and NYU SPS, as cited in our Sept 2026 report',
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
