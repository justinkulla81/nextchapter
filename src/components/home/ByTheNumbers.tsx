const STATS = [
  {
    value: '73%',
    label: 'Of stay-at-home mothers report facing hiring bias when they try to return to work.',
    href: 'https://www.forbes.com/sites/kimelsesser/2023/05/11/majority-of-stay-at-home-moms-face-bias-when-returning-to-work-survey-shows/',
    source: 'Forbes',
  },
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
    value: '5.6%',
    label: 'Unemployment rate for recent college grads (22-27), vs. 4.2% overall.',
    href: 'https://www.insidehighered.com/news/students/careers/2026/06/29/job-market-recent-college-grads-5-charts',
    source: 'Inside Higher Ed',
  },
  {
    value: '41.5%',
    label: "Of employed recent grads are underemployed — working jobs that don't require a degree.",
    href: 'https://www.newyorkfed.org/research/college-labor-market',
    source: 'NY Fed',
  },
  {
    value: '23-27%',
    label: 'Of mid-career professionals go 5+ years without a meaningful raise or promotion.',
    href: 'https://www.cbsnews.com/news/mid-career-stall-white-collar-workers-pay-promotions/',
    source: 'CBS News',
  },
  {
    value: '~7%',
    label: 'Of workers in their 40s make an annual move into a completely new field.',
    href: 'https://www.joblist.com/trends/midlife-career-crisis',
    source: 'Joblist',
  },
]

// Styled for the navy "Why you're stuck" section it lives in — not a
// standalone light-background section anymore.
export function ByTheNumbers() {
  return (
    <div className="mt-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white">You&apos;re not imagining it</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-light-blue">
            Whatever your situation, it&apos;s real and well-documented in the labor market — not a
            personal failing.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 px-5 py-6">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-light-blue">{stat.label}</p>
              <a
                href={stat.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs text-light-blue/70 underline underline-offset-4 hover:text-light-blue"
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
