const STATS = [
  {
    value: '~24%',
    label: 'Of unemployed workers fall into long-term unemployment — jobless 27+ weeks.',
    href: 'https://www.minneapolisfed.org/article/2025/the-journey-to-long-term-unemployment',
    source: 'Minneapolis Fed',
  },
  {
    value: '6.5 months',
    label: "The average active job hunt extends past, once someone crosses the long-term threshold.",
    href: 'https://dexian.com/blog/average-time-to-find-a-job/',
    source: 'Dexian',
  },
  {
    value: '23-27%',
    label: 'Of mid-career professionals go 5+ years without a meaningful raise or promotion.',
    href: 'https://www.cbsnews.com/news/mid-career-stall-white-collar-workers-pay-promotions/',
    source: 'CBS News',
  },
  {
    value: '73%',
    label: 'Of stay-at-home mothers report facing hiring bias when they try to return to work.',
    href: 'https://www.forbes.com/sites/kimelsesser/2023/05/11/majority-of-stay-at-home-moms-face-bias-when-returning-to-work-survey-shows/',
    source: 'Forbes',
  },
  {
    value: '41.5%',
    label: "Of employed recent grads are underemployed — working jobs that don't require a degree.",
    href: 'https://www.newyorkfed.org/research/college-labor-market',
    source: 'NY Fed',
  },
  {
    value: '~7%',
    label: 'Of workers in their 40s make an annual move into a completely new field.',
    href: 'https://www.joblist.com/trends/midlife-career-crisis',
    source: 'Joblist',
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
