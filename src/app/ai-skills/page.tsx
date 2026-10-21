import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { SITE_URL } from '@/lib/reports'
import { canonical } from '@/lib/seo/canonical'
import { AI_MARKET_AS_OF, AI_MARKET_POSTINGS } from '@/lib/skills/ai-skill-market.data'
import { LEVEL_COLUMNS, liveFunctionRows, liveLevelRows, liveOverallSharePct, overallSharePct, publicFunctionRows, skillGroupsForDisplay } from '@/lib/skills/ai-skills-public'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { loadAiShareTrend } from '@/lib/skills/ai-market-trend-server'

export const revalidate = 3600

const TITLE = 'AI skills in job postings: how common, and what they pay'
const DESCRIPTION =
  'Which functions ask for AI skills, how much more those postings advertise, and what the research says about seniority. Measured on live U.S. job postings, with the limits stated.'

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | NextChapter` },
  description: DESCRIPTION,
  ...canonical('/ai-skills'),
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/ai-skills`, type: 'article' },
}

const longDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const pct = (n: number | null) => (n === null ? 'Not enough paid postings' : `+${n}%`)

const RESEARCH = [
  { who: 'Lightcast', what: 'U.S. postings that list AI skills offer about 28% more pay (roughly $18,000 a year), and 51% of them are outside IT.' },
  { who: 'Oxford Internet Institute', what: 'In a hiring experiment with about 1,700 recruiters, listing AI skills raised interview invitations by 8 to 15 percentage points and partly offset disadvantages of age and education. It measures invitations, not jobs or pay.' },
  { who: 'NACE', what: '13.3% of entry-level postings now ask for AI skills, nearly three times the fall 2025 level.' },
  { who: 'Stanford Digital Economy Lab', what: 'Employment of 22 to 25 year olds in the most AI-exposed jobs is 19% below comparable peers. Older workers show no comparable gap.' },
  { who: 'Revelio Labs', what: 'Compared with non-adopters, firms using AI grew senior roles by 32% and junior roles by 6%.' },
]

export default async function AiSkillsPage() {
  // The newest weekly snapshot of the live board; the 2026-10-16 analysis until the first one exists.
  const live = await loadAiMarket()
  const rows = live ? liveFunctionRows(live) : publicFunctionRows()
  const levelRows = live ? liveLevelRows(live) : []
  const groups = skillGroupsForDisplay()
  const likes = rows.flatMap((r) => (r.likePremiumPct === null ? [] : [r.likePremiumPct]))
  const range = likes.length ? { min: Math.min(...likes), max: Math.max(...likes) } : null
  const trend = await loadAiShareTrend()
  const overall = live ? liveOverallSharePct(live) : overallSharePct()
  const analyzed = live ? live.counts.fullText : AI_MARKET_POSTINGS
  const asOf = longDate(live ? live.asOf : AI_MARKET_AS_OF)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    url: `${SITE_URL}/ai-skills`,
    description: DESCRIPTION,
    dateModified: (live ? live.asOf : AI_MARKET_AS_OF).slice(0, 10),
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Market data · as of {asOf}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy text-balance sm:text-4xl">{TITLE}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          About {Math.round(overall)}% of the {analyzed.toLocaleString('en-US')} U.S. postings we analyzed ask for a specific AI skill. It is close to half in data roles
          and almost none in clinical or academic ones. Where they do ask, the advertised pay is higher
          {range ? `, by ${range.min}% to ${range.max}% after comparing like with like` : ''}.
        </p>

        <section className="mt-12" aria-labelledby="by-function">
          <h2 id="by-function" className="text-xl font-bold tracking-tight text-navy">
            By function
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            “Raw” compares the median advertised pay of postings that ask for an AI skill with those that do not. “Like for like” compares within the same level and industry, which removes most of the
            effect of AI postings sitting at larger employers.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Share of postings asking for an AI skill, and the advertised pay premium, by function</caption>
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Function</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ask for AI</th>
                  <th scope="col" className="px-3 py-2 font-medium">Pay, raw</th>
                  <th scope="col" className="px-3 py-2 font-medium">Pay, like for like</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {rows.map((r) => (
                  <tr key={r.fn}>
                    <th scope="row" className="px-3 py-2 font-medium">{r.label}</th>
                    <td className="px-3 py-2">{r.sharePct}%</td>
                    <td className="px-3 py-2">{r.rawPremiumPct === null ? '—' : pct(r.rawPremiumPct)}</td>
                    <td className="px-3 py-2">
                      {r.likePremiumPct === null ? '—' : `${pct(r.likePremiumPct)} (about $${Math.round((r.likePremiumUsd ?? 0) / 100) / 10}k)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">A dash means too few postings with pay to compare. Functions with fewer than 500 analyzed postings are left out.</p>
        </section>

        <section className="mt-12" aria-labelledby="what-counts">
          <h2 id="what-counts" className="text-xl font-bold tracking-tight text-navy">
            What counts as an AI skill
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Twenty-four specific skills in three groups. A posting counts only when it names one of them, not when it mentions AI in company boilerplate.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g.key}>
                <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {g.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="by-level">
          <h2 id="by-level" className="text-xl font-bold tracking-tight text-navy">
            By level
          </h2>
          {levelRows.length > 0 && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Advertised pay premium for postings that ask for an AI skill, within the same function, level and industry. A dash means too few paid postings to compare.
              </p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
                  <caption className="sr-only">Like-for-like advertised pay premium for AI-skill postings, by function and level</caption>
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Function</th>
                      {LEVEL_COLUMNS.map((c) => (
                        <th key={c.key} scope="col" className="px-3 py-2 font-medium">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {levelRows.map((r) => (
                      <tr key={r.fn}>
                        <th scope="row" className="px-3 py-2 font-medium">{r.label}</th>
                        {LEVEL_COLUMNS.map((c) => (
                          <td key={c.key} className="px-3 py-2">{r.byLevel[c.key] === undefined ? '—' : pct(r.byLevel[c.key] ?? null)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Published studies on seniority, with the source of each, also covered in the{' '}
            <Link href="/reports/latest" className="underline underline-offset-4">White Collar Employment Report</Link>.
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {RESEARCH.map((r) => (
              <li key={r.who}>
                <span className="font-semibold text-foreground">{r.who}.</span> <span className="text-foreground/85">{r.what}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="trend">
          <h2 id="trend" className="text-xl font-bold tracking-tight text-navy">
            Is it growing?
          </h2>
          {trend ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Share of live postings on our board that ask for a specific AI skill, by week. It moved from {trend[0].sharePct}% to {trend[trend.length - 1].sharePct}% over {trend.length} weeks.
              </p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr><th scope="col" className="px-3 py-2 font-medium">Week of</th><th scope="col" className="px-3 py-2 font-medium">Ask for AI</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...trend].reverse().map((t) => (
                      <tr key={t.weekOf}><td className="px-3 py-2">{t.weekOf}</td><td className="px-3 py-2">{t.sharePct}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              We measure this every week. A trend appears here after four weeks of data. Until then, the research above is the best evidence on direction.
            </p>
          )}
        </section>

        <section className="mt-12" aria-labelledby="limits">
          <h2 id="limits" className="text-xl font-bold tracking-tight text-navy">
            How to read this
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>The pay is what employers advertise, not what people were paid.</li>
            <li>Postings that ask for AI skills tend to be at larger employers and higher levels. The like-for-like column adjusts for level and industry, not for everything.</li>
            <li>A posting asking for a skill is not proof the job needs it day to day.</li>
            <li>It describes demand today. It does not say AI caused any layoff or hiring change.</li>
          </ul>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-muted/30 p-6" aria-labelledby="next">
          <h2 id="next" className="text-lg font-bold tracking-tight text-navy">
            See it for your own field
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Candidates: the free Market Reality Assessment shows which AI skills your best-fit jobs ask for and a short course for each gap.
            Employers, colleges and workforce boards: we can show the same for your people, counts only, and build the training to close it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <TrackedLink
              href="/onboarding/desire"
              event="ai_skills_page_cta_clicked"
              properties={{ cta: 'candidate_assessment' }}
              className="inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95"
            >
              Get your Market Reality Assessment
            </TrackedLink>
            <TrackedLink
              href="/ai-training"
              event="ai_skills_page_cta_clicked"
              properties={{ cta: 'org_ai_training' }}
              className="inline-flex items-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              AI training for your people
            </TrackedLink>
          </div>
        </section>
      </main>
      <PublicSiteFooter page="ai-skills" />
    </div>
  )
}
