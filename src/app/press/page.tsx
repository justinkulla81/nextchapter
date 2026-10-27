import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { PressCopy } from '@/components/press/PressCopy'
import { PressDownload } from '@/components/press/PressDownload'
import { OPEN_DATA_LICENSES, OPEN_DATA_LIMITATIONS, REPLICATION_PAGE_PATH, REPLICATION_REPO_URL } from '@/lib/marketing/open-data'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { MIN_PER_SIDE } from '@/lib/skills/ai-market'
import { signedPct } from '@/lib/pay/ai-premium'
import { SITE_URL } from '@/lib/reports'
import { INDEX_ROUNDING_RULE, headlineChange, headlineIndex, monthLabel, wcIndexSummary } from '@/lib/reports-wc-index'
import { breadcrumbJsonLd, organizationRef } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/keywords'
import { getLayoffCounts } from '@/lib/warn/layoff-counts'
import { LAYOFF_DATA_LICENSE } from '@/lib/data/layoff-export'
import { LTU_JAN_AUG, PRESS_CONTACT_EMAIL, PRESS_CORRECTIONS, PRESS_PAGE_REVIEWED, SINGLE_MONTH_CAUTION, citationText } from '@/lib/press/figures'

export const revalidate = 3600

const PATH = '/press'
export const metadata: Metadata = pageMetadata(PATH)

const H2 = 'text-2xl font-bold tracking-tight text-navy'
const LINK = 'text-brand underline underline-offset-4'
const CARD = 'rounded-xl border border-border bg-white p-5'
const BOX = 'min-w-0 flex-1 rounded-lg bg-off-white p-3 text-sm leading-relaxed text-ink'

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const num = (n: number) => n.toLocaleString('en-US')

function Cite({ id, text }: { id: string; text: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">How to cite</p>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start">
        <p className={BOX}>{text.replace('{DATE}', '[date accessed]')}</p>
        <PressCopy text={text} kind="cite" id={id} />
      </div>
    </div>
  )
}

export default async function PressPage() {
  const { latest, yearAgo } = wcIndexSummary()
  const [layoffs, ai] = await Promise.all([getLayoffCounts().catch(() => null), loadAiMarket().catch(() => null)])
  const overall = ai?.overall && ai.overall.nAi >= MIN_PER_SIDE && ai.overall.nBase >= MIN_PER_SIDE ? ai.overall : null
  const aiAsOf = ai ? ai.asOf.slice(0, 10) : null

  const indexLevel = headlineIndex(latest.index)
  const indexChange = yearAgo ? headlineChange(latest.index, yearAgo.index) : null
  const indexMonth = monthLabel(latest.month)
  const indexUrl = `${SITE_URL}/reports/white-collar-index`
  const reportUrl = `${SITE_URL}${LTU_JAN_AUG.reportPath}`
  const svgUrl = `${SITE_URL}/press/white-collar-index.svg`
  const embed = `<a href="${indexUrl}"><img src="${svgUrl}" alt="White-Collar Long-Search Index, 2015 to ${indexMonth}, 2019 average = 100" width="720" height="400" style="max-width:100%;height:auto"></a>\n<p>Source: <a href="${indexUrl}">NextChapter White-Collar Long-Search Index</a> (CC BY 4.0)</p>`

  const dataset = {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'White-Collar Long-Search Index',
      description: 'Monthly long-term unemployment among managers and professionals in the United States, 2015 to today, from Census Current Population Survey microdata. 2019 average = 100.',
      url: indexUrl,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: organizationRef(),
      isAccessibleForFree: true,
      temporalCoverage: `2015-01/${latest.month}`,
      spatialCoverage: 'United States',
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/reports/wc-index.csv` }],
  }

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={dataset} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Press and data', path: PATH }])} />
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Press and data</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            What NextChapter publishes, what each figure means, how to cite it, and where to get the files. We build the numbers from public data and publish the code, so every figure can be checked.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Page wording reviewed {dateLabel(PRESS_PAGE_REVIEWED)}. Each figure below shows its own as-of date and updates on its own.</p>

          <section aria-labelledby="publish" className="mt-10">
            <h2 id="publish" className={H2}>What we publish</h2>
            <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed text-ink">
              <li><Link href="/reports/latest" className={LINK}>White Collar Employment Report</Link>, monthly: hiring, job changes, search length, AI attribution and public programs.</li>
              <li><Link href="/reports/white-collar-index" className={LINK}>White-Collar Long-Search Index</Link>, updated with each edition from Census microdata.</li>
              <li><Link href="/layoffs" className={LINK}>Layoff tracker</Link> and the <Link href="/data" className={LINK}>WARN notice download</Link>, refreshed at least hourly.</li>
              <li><Link href="/feeds" className={LINK}>Layoff and conference feeds</Link>: new WARN notices by RSS or JSON, by state, industry or size (100+ workers), plus a weekly summary and an <a href="/feeds/nextchapter.opml" className={LINK}>OPML file</a> of every feed.</li>
              <li><Link href="/resources/ai-skills-pay-premium" className={LINK}>AI-skill pay premium</Link> in job postings, refreshed daily from the live job board.</li>
              <li><Link href="/reports/early-warning" className={LINK}>Early-warning labor indicators</Link> by group, with the bright spots and the concerns side by side.</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              The report follows the BLS jobs report; the <Link href="/reports" className={LINK}>reports page</Link> lists the next release dates.
            </p>
          </section>

          <section aria-labelledby="figures" className="mt-12">
            <h2 id="figures" className={H2}>Figures you can cite</h2>
            <div className="mt-4 space-y-4">
              <article className={CARD} aria-labelledby="fig-index">
                <h3 id="fig-index" className="text-lg font-semibold text-navy">White-Collar Long-Search Index</h3>
                <p className="mt-1 text-3xl font-bold tabular-nums text-navy">{indexLevel} <span className="text-base font-normal text-muted-foreground">in {indexMonth} (2019 = 100)</span></p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  {latest.index.toFixed(1)} in the data file{yearAgo && indexChange !== null ? `; ${yearAgo.index.toFixed(1)} a year earlier, a change of ${indexChange > 0 ? '+' : ''}${indexChange} points` : ''}. Seasonally adjusted, 3-month average. {INDEX_ROUNDING_RULE}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{SINGLE_MONTH_CAUTION} Margin of error band on the index level: about ±11% (90%, BLS variance method).</p>
                <Cite id="index" text={citationText('White-Collar Long-Search Index', `data through ${indexMonth}`, indexUrl, '{DATE}')} />
                <p className="mt-3 text-sm">
                  <PressDownload href="/reports/wc-index.csv" id="wc-index-csv">wc-index.csv</PressDownload>
                  {' · '}
                  <Link href="/reports/white-collar-index" className={LINK}>Page and methodology</Link>
                </p>
              </article>

              <article className={CARD} aria-labelledby="fig-ltu">
                <h3 id="fig-ltu" className="text-lg font-semibold text-navy">Share of the unemployed out 27+ weeks</h3>
                <p className="mt-1 text-3xl font-bold tabular-nums text-navy">{LTU_JAN_AUG.whiteCollarShare.y2026}% <span className="text-base font-normal text-muted-foreground">of unemployed white-collar workers, vs {LTU_JAN_AUG.whiteCollarShare.y2025}% a year earlier</span></p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  {LTU_JAN_AUG.period}, not seasonally adjusted. The change is +{LTU_JAN_AUG.whiteCollarShare.change} points, with a margin of ±{LTU_JAN_AUG.whiteCollarShare.margin90} at 90%, so it is beyond the margin of error. For all unemployed workers the share is {LTU_JAN_AUG.allShare.y2026}% against {LTU_JAN_AUG.allShare.y2025}% (+{LTU_JAN_AUG.allShare.change}, ±{LTU_JAN_AUG.allShare.margin90}). The index sits {LTU_JAN_AUG.aboveTwentyNineteen}.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Single-month figures for smaller groups, such as workers 45 and over, swing widely from month to month and have no published margin of error. We do not quote them.</p>
                <Cite id="ltu" text={citationText('White Collar Employment Report, September 2026: unemployed workers out 27+ weeks, January–August 2026 vs 2025', 'September 2026 edition', reportUrl, '{DATE}')} />
                <p className="mt-3 text-sm"><Link href={LTU_JAN_AUG.reportPath} className={LINK}>September 2026 report</Link>{' · '}<span className="text-muted-foreground">{LTU_JAN_AUG.source}</span></p>
              </article>

              <article className={CARD} aria-labelledby="fig-layoffs">
                <h3 id="fig-layoffs" className="text-lg font-semibold text-navy">Layoff tracker and WARN notices</h3>
                {layoffs ? (
                  <>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-navy">{num(layoffs.layoffsYear.layoffs)} <span className="text-base font-normal text-muted-foreground">layoffs in {layoffs.layoffsYear.year} naming {num(layoffs.layoffsYear.workers)} workers</span></p>
                    <p className="mt-2 text-sm leading-relaxed text-ink">
                      Counted once per employer, state and notice date, filed or reported with a U.S. state, as of {layoffs.asOf}. The download holds {num(layoffs.filings.count)} WARN filings naming {num(layoffs.filings.workers)} workers over the last 24 months (since {layoffs.filings.since}), one row per filing. {num(layoffs.notCounted.count)} announcements this year with no U.S. state ({num(layoffs.notCounted.workers)} workers) are not counted anywhere. The two counts use different units; <Link href="/layoffs" className={LINK}>How we count</Link> defines each. A state notice list is a floor, not a count of every layoff.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">The layoff counts are temporarily unavailable. The files below still work.</p>
                )}
                <Cite id="layoffs" text={citationText('NextChapter layoff tracker, WARN Act notices collected from state labor departments', layoffs ? `as of ${layoffs.asOf}` : 'current', `${SITE_URL}/layoffs`, '{DATE}', LAYOFF_DATA_LICENSE)} />
                <p className="mt-3 text-sm">
                  <PressDownload href="/data/layoffs.csv" id="layoffs-csv">layoffs.csv</PressDownload>
                  {' · '}
                  <PressDownload href="/data/layoffs.json" id="layoffs-json">layoffs.json</PressDownload>
                  {' · '}
                  <Link href="/layoffs/by-state" className={LINK}>By state</Link>
                  {' · '}
                  <Link href="/data" className={LINK}>Download page</Link>
                </p>
              </article>

              <article className={CARD} aria-labelledby="fig-ai">
                <h3 id="fig-ai" className="text-lg font-semibold text-navy">AI-skill pay premium in job postings</h3>
                {overall ? (
                  <>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-navy">{signedPct(overall.rawPct)} <span className="text-base font-normal text-muted-foreground">raw{overall.likePct !== undefined ? `, ${signedPct(overall.likePct)} matched on function, level and industry` : ''}</span></p>
                    <p className="mt-2 text-sm leading-relaxed text-ink">
                      Median advertised pay is {usd(overall.medAi)} across {num(overall.nAi)} paid postings that ask for a specific AI skill, and {usd(overall.medBase)} across {num(overall.nBase)} that never mention AI. This compares advertised pay between postings; it is not what anyone is paid and it does not show that a skill causes a raise. Data as of {aiAsOf}.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">The first snapshot has not been built yet.</p>
                )}
                <Cite id="ai-premium" text={citationText('AI-skill pay premium in U.S. job postings', `data as of ${aiAsOf ?? 'current'}`, `${SITE_URL}/resources/ai-skills-pay-premium`, '{DATE}')} />
                <p className="mt-3 text-sm">
                  <PressDownload href="/resources/ai-skills-pay-premium/data.csv" id="ai-premium-csv">data.csv</PressDownload>
                  {' · '}
                  <Link href="/resources/ai-skills-pay-premium" className={LINK}>Method and table</Link>
                </p>
              </article>
            </div>
          </section>

          <section aria-labelledby="embed" className="mt-12">
            <h2 id="embed" className={H2}>Embed the index chart</h2>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink">A plain image, so it works anywhere an image does. The credit and source address are drawn into the picture. Licensed CC BY 4.0.</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a self-contained SVG route, shown as the reader would embed it */}
            <img src="/press/white-collar-index.svg" alt={`White-Collar Long-Search Index, 2015 to ${indexMonth}, 2019 average = 100`} width={720} height={400} className="mt-4 h-auto w-full max-w-3xl rounded-xl border border-border bg-white" />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <pre className={`${BOX} overflow-x-auto font-mono text-xs whitespace-pre-wrap`}>{embed}</pre>
              <PressCopy text={embed} kind="embed" id="index-chart" label="Copy embed" />
            </div>
            <p className="mt-3 text-sm">
              Also: <PressDownload href="/press/white-collar-index.svg" id="index-chart-svg">chart (SVG)</PressDownload>
              {' · '}
              <PressDownload href="/reports/white-collar-employment-report-2026-09-og.png" id="report-og-png">report cover (PNG, 1200×630)</PressDownload>
              {' · '}
              <PressDownload href="/reports/chart-post-2026-09-productivity-vs-long-searches-1200x1350.png" id="chart-post-png">productivity vs long searches chart (PNG, 1200×1350)</PressDownload>
            </p>
          </section>

          <section aria-labelledby="method" className="mt-12">
            <h2 id="method" className={H2}>Method in five lines</h2>
            <ol className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink">
              <li>Source: U.S. Census Bureau Current Population Survey basic monthly public-use microdata. No NextChapter customer data is used.</li>
              <li>White-collar means current or most recent job in management, business and financial, or professional and related occupations.</li>
              <li>The index is long-term unemployed (27+ weeks) as a share of the white-collar labor force, seasonally adjusted, 3-month average, 2019 average = 100.</li>
              <li>Margins of error are 90% margins from BLS generalized variance functions; they can understate variance for small groups.</li>
              <li>Code is {OPEN_DATA_LICENSES.code} and data is {OPEN_DATA_LICENSES.data}; both are in the <a href={REPLICATION_REPO_URL} className={LINK} rel="noopener noreferrer">public repository</a>.</li>
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">Known limitation: {OPEN_DATA_LIMITATIONS[0]} Full list on <Link href={REPLICATION_PAGE_PATH} className={LINK}>the replication page</Link>.</p>
          </section>

          <section aria-labelledby="downloads" className="mt-12">
            <h2 id="downloads" className={H2}>All downloads</h2>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <li><PressDownload href="/reports/wc-index.csv" id="dl-wc-index">White-Collar Long-Search Index (CSV)</PressDownload></li>
              <li><PressDownload href="/reports/us-early-warning.csv" id="dl-early-warning">Early-warning indicators (CSV)</PressDownload></li>
              <li><PressDownload href="/reports/hires-per-opening.csv" id="dl-hires-per-opening">Hires per opening (CSV)</PressDownload></li>
              <li><PressDownload href="/reports/white-collar-employment-report-2026-09-data.csv" id="dl-report-data">September report data (CSV)</PressDownload></li>
              <li><PressDownload href="/reports/white-collar-employment-report-2026-09-brief.pdf" id="dl-brief">September report brief (PDF)</PressDownload></li>
              <li><PressDownload href="/reports/white-collar-employment-report-2026-09.pdf" id="dl-report-pdf">September report (PDF)</PressDownload></li>
              <li><PressDownload href="/data/layoffs.csv" id="dl-layoffs-csv">WARN notices (CSV)</PressDownload></li>
              <li><PressDownload href="/data/layoffs.json" id="dl-layoffs-json">WARN notices (JSON)</PressDownload></li>
              <li><PressDownload href="/resources/ai-skills-pay-premium/data.csv" id="dl-ai-premium">AI-skill pay premium (CSV)</PressDownload></li>
              <li><a href={REPLICATION_REPO_URL} className={LINK} rel="noopener noreferrer">Code and data repository</a></li>
            </ul>
          </section>

          <section aria-labelledby="corrections" className="mt-12">
            <h2 id="corrections" className={H2}>Corrections</h2>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink">
              If a figure is wrong, write to <a href={`mailto:${PRESS_CONTACT_EMAIL}`} className={LINK}>{PRESS_CONTACT_EMAIL}</a>. We fix it where it appears and record the change here with its date.
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
              {PRESS_CORRECTIONS.map((c) => (
                <li key={c.date} className={CARD}><strong>{dateLabel(c.date)}.</strong> {c.text}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="contact" className="mt-12">
            <h2 id="contact" className={H2}>Contact</h2>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink">
              Justin Kulla is the founder of NextChapter. He has spent nearly 20 years as an investor, founder and operator in education technology. He founded BusinessBlocks, a venture-backed education company for small businesses, and led it as CEO through an exit to AmTrust Financial, where he became SVP and Head of Global M&amp;A and Venture Investments. He is a Partner at TZP Group, where he leads impact and education investments, and was a founding member of Weld North. He holds an MBA from MIT, a Master of Public Administration from Harvard and a master’s in Information Systems Management from Carnegie Mellon. <Link href="/authors/justin-kulla" className={LINK}>More about Justin</Link>.
            </p>
            <p className="mt-3 text-base text-ink">Email <a href={`mailto:${PRESS_CONTACT_EMAIL}`} className={LINK}>{PRESS_CONTACT_EMAIL}</a>.</p>
          </section>
        </div>
      </main>
      <PublicSiteFooter page="reports" />
    </div>
  )
}
