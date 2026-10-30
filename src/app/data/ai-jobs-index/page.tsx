import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { AiIndexCite } from '@/components/data/AiIndexCite'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { SITE_URL } from '@/lib/seo/facts'
import { breadcrumbJsonLd, organizationRef } from '@/lib/seo/jsonld'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, HIGH_EXPOSURE_FROM, SOME_EXPOSURE_FROM, scorePercent } from '@/lib/skills/ai-exposure'
import { MIN_LIKE_N, MIN_PER_SIDE } from '@/lib/skills/ai-market'
import { signedPct } from '@/lib/pay/ai-premium'
import { loadAiJobsIndex } from '@/lib/ai-index/load'
import { INDEX_CSV_PATH, INDEX_LICENSE, INDEX_LICENSE_URL, INDEX_NAME, INDEX_PATH, MIN_OPENINGS_RANKED, indexCitation, indexJsonLd, type OccupationRow } from '@/lib/ai-index/build'
import { formatContentDate } from '@/components/seo/AuthorByline'

export const revalidate = 3600
export const metadata: Metadata = pageMetadata(INDEX_PATH)

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'
const n = (v: number) => v.toLocaleString('en-US')
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

function OccupationTable({ caption, rows }: { caption: string; rows: OccupationRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Occupation</th>
            <th scope="col" className="px-3 py-2 font-medium">AI exposure</th>
            <th scope="col" className="px-3 py-2 font-medium">Live openings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.soc6}>
              <th scope="row" className="px-3 py-2 font-medium">
                <TrackedLink href={r.path} event="ai_jobs_index_occupation_clicked" properties={{ soc6: r.soc6 }} className={LINK}>{r.title}</TrackedLink>
              </th>
              <td className="px-3 py-2">{scorePercent(r.score)} · {BAND_LABEL[r.band]}</td>
              <td className="px-3 py-2">{n(r.openings)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function AiJobsIndexPage() {
  const index = await loadAiJobsIndex().catch(() => null)
  const cite = index ? indexCitation(index, SITE_URL) : null
  const split = index?.split ?? null
  const premium = index?.premium ?? null

  return (
    <div className="flex flex-1 flex-col">
      {index && <StructuredData data={indexJsonLd(index, SITE_URL, organizationRef())} />}
      <StructuredData data={breadcrumbJsonLd([{ name: 'Data', path: '/data' }, { name: INDEX_NAME, path: INDEX_PATH }])} />
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {index ? `${index.edition} edition · data as of ${formatContentDate(index.asOf)}` : 'Monthly index'}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1(INDEX_PATH, `The ${INDEX_NAME}`)}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            How much of each job AI already does, how many jobs are open in it today, and what AI skills add to advertised pay. Built from the {AI_EXPOSURE_SOURCE.name} and the live NextChapter job board.
          </p>

          {!index ? (
            <p className="mt-8 rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground">The index is being refreshed. Reload in a few minutes.</p>
          ) : (
            <>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {split && (
                  <li className="rounded-xl border border-border bg-white p-5">
                    <p className="text-2xl font-bold tabular-nums text-navy">{Math.round(split.shares.high * 100)}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">of live openings (in occupations we can measure) are in jobs where AI already does a large share of the tasks. {Math.round(split.shares.some * 100)}% are in jobs with some AI use, {Math.round(split.shares.little * 100)}% with little observed. The measure covers {Math.round(split.coverage * 100)}% of all openings.</p>
                  </li>
                )}
                {index.aiSkillSharePct !== null && (
                  <li className="rounded-xl border border-border bg-white p-5">
                    <p className="text-2xl font-bold tabular-nums text-navy">{index.aiSkillSharePct}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">of live postings ask for a specific AI skill{index.liveOpenings ? `, out of ${n(index.liveOpenings)} live openings` : ''}.</p>
                  </li>
                )}
                {premium && (
                  <li className="rounded-xl border border-border bg-white p-5">
                    <p className="text-2xl font-bold tabular-nums text-navy">{signedPct(premium.rawPct)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      advertised pay for postings that ask for an AI skill: median {usd(premium.medAi)} against {usd(premium.medBase)} for postings that never mention AI.
                      {premium.likePct !== undefined && premium.likeN !== undefined && premium.likeN >= MIN_LIKE_N ? ` ${signedPct(premium.likePct)} after matching on function, level and industry.` : ''}
                    </p>
                  </li>
                )}
                {index.liveOpenings !== null && (
                  <li className="rounded-xl border border-border bg-white p-5">
                    <p className="text-2xl font-bold tabular-nums text-navy">{n(index.liveOpenings)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">live professional openings behind these figures, read from employers’ own career sites.</p>
                  </li>
                )}
              </ul>

              <section aria-labelledby="exposed" className="mt-12">
                <h2 id="exposed" className={H2}>Most exposed jobs that are hiring</h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Occupations with at least {n(MIN_OPENINGS_RANKED)} live openings, ranked by the share of their tasks AI is already used for. Select one for the full AI job check.</p>
                <OccupationTable caption="Occupations with the highest AI exposure that have at least 200 live openings" rows={index.mostExposedHiring} />
              </section>

              <section aria-labelledby="openings" className="mt-12">
                <h2 id="openings" className={H2}>Where the openings are, and how exposed they are</h2>
                <OccupationTable caption="Occupations with the most live openings and their AI exposure" rows={index.mostOpenings} />
              </section>

              {index.functions.length > 0 && (
                <section aria-labelledby="pay" className="mt-12">
                  <h2 id="pay" className={H2}>What AI skills add to advertised pay, by function</h2>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Functions with {MIN_PER_SIDE}+ paid postings on each side. Advertised pay, not what anyone is paid. The method and the CSV are on <Link href="/resources/ai-skills-pay-premium" className={LINK}>the pay premium page</Link>.</p>
                  <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
                    <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
                      <caption className="sr-only">Advertised pay premium for postings that ask for an AI skill, by function</caption>
                      <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-medium">Function</th>
                          <th scope="col" className="px-3 py-2 font-medium">Ask for AI</th>
                          <th scope="col" className="px-3 py-2 font-medium">Raw</th>
                          <th scope="col" className="px-3 py-2 font-medium">Like for like</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {index.functions.slice(0, 12).map((p) => (
                          <tr key={p.fn}>
                            <th scope="row" className="px-3 py-2 font-medium">{p.label}</th>
                            <td className="px-3 py-2">{p.sharePct}%</td>
                            <td className="px-3 py-2">{signedPct(p.rawPct)}</td>
                            <td className="px-3 py-2">{p.likePct !== undefined ? signedPct(p.likePct) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section aria-labelledby="method" className="mt-12">
                <h2 id="method" className={H2}>Methodology</h2>
                <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-navy">
                  <li>
                    <strong>AI exposure</strong> is the observed exposure measure from the{' '}
                    <a href={AI_EXPOSURE_SOURCE.url} className={LINK} rel="noopener">{AI_EXPOSURE_SOURCE.name}</a> (Anthropic, {AI_EXPOSURE_SOURCE.released}, {INDEX_LICENSE}). Of the tasks in an occupation that an AI model could speed up, it counts how many already see AI use at work: use that does the task counts in full, use that assists counts half, weighted by time spent on each task. It describes use seen now. It is not a forecast of job loss, and a low number means no use seen yet, not that a job is protected.
                  </li>
                  <li><strong>Bands.</strong> {BAND_LABEL.high} is {Math.round(HIGH_EXPOSURE_FROM * 100)}% and above, {BAND_LABEL.some} is {Math.round(SOME_EXPOSURE_FROM * 100)}% to {Math.round(HIGH_EXPOSURE_FROM * 100)}%, {BAND_LABEL.little} is below {Math.round(SOME_EXPOSURE_FROM * 100)}%.</li>
                  <li><strong>Live openings</strong> are approved, unexpired professional postings on the NextChapter board, taken from employers’ own career sites, counted by the occupation each one is placed in. Postings without an occupation are not in the exposure split; the share covered is shown with it.</li>
                  <li><strong>The pay premium</strong> compares the median advertised pay of postings that ask for a specific AI skill with postings that never mention AI. Only posted pay on postings read from a full description is used. Like for like compares within the same function, level and industry. A function needs {MIN_PER_SIDE}+ paid postings on each side to appear.</li>
                  <li><strong>Edition.</strong> Published monthly at this address. Figures come from the newest daily snapshot, dated at the top of the page. No AI model is used to produce any figure.</li>
                </ul>
              </section>

              <section aria-labelledby="cite" className="mt-12 rounded-xl border border-border bg-white p-6">
                <h2 id="cite" className="text-xl font-semibold tracking-tight text-navy">Download and cite</h2>
                <p className="mt-2 text-sm">
                  <TrackedLink href={INDEX_CSV_PATH} event="ai_jobs_index_csv_downloaded" properties={{ edition: index.edition }} className={LINK}>Download the CSV</TrackedLink>: one row per occupation ({n(index.all.length)}), with exposure, band and live openings.
                </p>
                <p className="mt-3 text-sm">
                  Free to use, share and adapt with credit under <a href={INDEX_LICENSE_URL} className={LINK} target="_blank" rel="noopener noreferrer">{INDEX_LICENSE}</a>. Citation:
                </p>
                {cite && <AiIndexCite text={cite} edition={index.edition} />}
              </section>
            </>
          )}

          <p className="mt-10 text-sm text-muted-foreground">
            Type your own job title in the <Link href="/tools/ai-job-check" className={LINK}>AI job check</Link>. Layoff data is on <Link href="/data" className={LINK}>the layoff data page</Link>.
          </p>
        </div>
      </main>
      <PublicSiteFooter page="seo" />
    </div>
  )
}
