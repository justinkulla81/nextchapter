const STATS = [
  {
    value: '28.5%',
    label: 'Of unemployed white-collar workers had been out of work 27 weeks (about six months) or more, January to September 2026, up from 23.2% a year earlier. The rise is larger than its margin of error (+5.3 points, ±2.3).',
    href: '/reports/white-collar-employment-report-october-2026',
    source: 'NextChapter White Collar Employment Report, Oct 2026 (Census CPS microdata)',
  },
  {
    value: '39.1%',
    label: 'Of unemployed white-collar workers aged 55 to 64 had been out of work 27 weeks or more, January to September 2026, up from 27.0% a year earlier.',
    href: '/reports/white-collar-employment-report-october-2026',
    source: 'NextChapter White Collar Employment Report, Oct 2026 (Census CPS microdata)',
  },
  {
    value: '0.75%',
    label: 'Of the white-collar labor force was unemployed 27 weeks or more, January to September 2026, up from about 0.58% a year earlier (the unemployment rate times the long-term share).',
    href: '/reports/white-collar-employment-report-october-2026',
    source: 'NextChapter White Collar Employment Report, Oct 2026 (our calculation from Census CPS)',
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
