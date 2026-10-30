import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect, redirect } from 'next/navigation'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { AiJobCheckEmployer } from '@/components/tools/AiJobCheckEmployer'
import { AiJobCheckForm } from '@/components/tools/AiJobCheckForm'
import { AiJobCheckShare } from '@/components/tools/AiJobCheckShare'
import { loadOccupationCheck } from '@/lib/ai-check/load'
import { checkPath, checkSlug, socFromSlug } from '@/lib/ai-check/slug'
import { loadExposureForSoc } from '@/lib/skills/ai-exposure-server'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, EXPOSURE_WHY, RETRAINING_LINE, exposureSentence, scorePercent } from '@/lib/skills/ai-exposure'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { titleMeta } from '@/lib/seo/title'

// One page per occupation: the exposure number, the tasks, better-paid or less-exposed related jobs, the skills to build.
// Built on first visit and cached a day (the same pattern as /jobs/title/[slug]); no AI model is called, so a page costs nothing
// to serve. The employer check is a client lookup, so the page itself stays the same for every visitor and caches.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const soc6 = socFromSlug(slug)
  const e = soc6 ? await loadExposureForSoc(soc6) : null
  if (!e) return { title: 'AI job check', robots: { index: false, follow: true } }
  const path = checkPath(e.title, e.soc6)
  const title = `AI Exposure for ${e.title}: How Much of the Work AI Already Does`
  const description = `${scorePercent(e.score)} of ${e.title.toLowerCase()} tasks show AI use (${BAND_LABEL[e.band].toLowerCase()}). See related jobs that pay more or are less exposed, and the skills to build. Free.`
  return {
    title: titleMeta(title),
    description,
    ...canonical(path),
    openGraph: { type: 'website', siteName: 'NextChapter', locale: 'en_US', title, description, url: `${SITE_URL}${path}` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function AiJobCheckResultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const soc6 = socFromSlug(slug)
  const check = soc6 ? await loadOccupationCheck(soc6) : null
  if (!soc6 || !check) redirect('/tools/ai-job-check')
  const { exposure: e } = check
  const path = checkPath(e.title, soc6)
  if (slug !== checkSlug(e.title, soc6)) permanentRedirect(path)

  const FAQ = [
    { q: `Will AI replace ${e.title.toLowerCase()}?`, a: `This data cannot say. It measures how much of the work AI is already used for today: ${scorePercent(e.score)} of the tasks, which is ${BAND_LABEL[e.band].toLowerCase()}. It is not a forecast of job loss.` },
    { q: 'How is the number worked out?', a: `${EXPOSURE_WHY} Source: ${AI_EXPOSURE_SOURCE.name}, ${AI_EXPOSURE_SOURCE.released}.` },
    ...(check.medianWage ? [{ q: `What do ${e.title.toLowerCase()} earn?`, a: `The national median is ${usd(check.medianWage)} a year (Bureau of Labor Statistics).` }] : []),
  ]

  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'AI job check', path: '/tools/ai-job-check' }, { name: e.title, path }]}
      h1={`${e.title}: how much of the work does AI already do?`}
      lede={
        <div className="max-w-3xl">
          <p className="text-4xl font-bold tracking-tight text-navy">
            {scorePercent(e.score)} <span className="text-xl font-semibold">· {BAND_LABEL[e.band]}</span>
          </p>
          <p className="mt-3 text-base">{exposureSentence(e)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{EXPOSURE_WHY}</p>
          <TrackedLink
            href={MARKET_REALITY_START_HREF}
            event="ai_job_check_cta_clicked"
            properties={{ soc6, band: e.band, cta: 'assessment', placement: 'top' }}
            className="mt-5 inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
          >
            Get my free assessment
          </TrackedLink>
          <p className="mt-3">
            <AiJobCheckShare soc6={soc6} title={e.title} path={path} />
          </p>
        </div>
      }
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebPage', name: `AI exposure for ${e.title}`, url: `${SITE_URL}${path}`, citation: AI_EXPOSURE_SOURCE.url },
      ]}
    >
      <section aria-labelledby="next" className="mt-10 max-w-3xl">
        <h2 id="next" className={H2}>What this means for your search</h2>
        <p className="mt-3 text-base">{RETRAINING_LINE[check.need]}</p>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <TrackedLink href={`/jobs?q=${encodeURIComponent(e.title)}`} event="ai_job_check_cta_clicked" properties={{ soc6, band: e.band, cta: 'jobs', placement: 'meaning' }} className={LINK}>
            See open {e.title.toLowerCase()} jobs
          </TrackedLink>
          <TrackedLink href="/ai-training" event="ai_job_check_cta_clicked" properties={{ soc6, band: e.band, cta: 'ai_training', placement: 'meaning' }} className={LINK}>
            Build AI skills
          </TrackedLink>
        </p>
        {(check.medianWage || check.growthPct != null || check.annualOpenings) && (
          <dl className="mt-5 grid max-w-xl grid-cols-3 gap-4 text-sm">
            {check.medianWage && (
              <div>
                <dt className="text-muted-foreground">Median pay</dt>
                <dd className="font-semibold text-navy">{usd(check.medianWage)}</dd>
              </div>
            )}
            {check.growthPct != null && (
              <div>
                <dt className="text-muted-foreground">Projected growth</dt>
                <dd className="font-semibold text-navy">{check.growthPct > 0 ? '+' : ''}{check.growthPct}%</dd>
              </div>
            )}
            {check.annualOpenings ? (
              <div>
                <dt className="text-muted-foreground">Openings a year</dt>
                <dd className="font-semibold text-navy">{check.annualOpenings.toLocaleString('en-US')}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      {check.tasks.length > 0 && (
        <section aria-labelledby="tasks" className="mt-10 max-w-3xl">
          <h2 id="tasks" className={H2}>What the job involves</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {check.tasks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {check.bets.length > 0 && (
        <section aria-labelledby="bets" className="mt-10 max-w-3xl">
          <h2 id="bets" className={H2}>Related jobs that pay more or are less exposed</h2>
          <p className="mt-2 text-sm text-muted-foreground">Chosen by overlap in skills and knowledge with {e.title.toLowerCase()}, so the move uses what you already know.</p>
          <ul className="mt-4 space-y-3">
            {check.bets.map((b) => (
              <li key={b.soc6} className="rounded-xl border border-border bg-white p-4">
                <Link href={checkPath(b.title, b.soc6)} className={`${LINK} font-semibold`}>
                  {b.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {b.reasons.includes('pays_more') && b.payDelta != null ? `Pays about ${usd(Math.round(b.payDelta / 1000) * 1000)} more (median ${usd(b.medianWage ?? 0)}). ` : ''}
                  {b.reasons.includes('less_exposed') && b.exposure != null ? `AI use is lower: ${scorePercent(b.exposure)} of tasks.` : ''}
                </p>
              </li>
            ))}
          </ul>
          {check.skillsToBuild.length > 0 && (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-navy">Skills these jobs lean on more</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {check.skillsToBuild.map((s) => (
                  <li key={s} className="rounded-full bg-muted px-3 py-1 text-sm text-navy">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="employer" className="mt-10 max-w-3xl">
        <h2 id="employer" className={H2}>Has your employer filed layoff notices?</h2>
        <p className="mt-2 text-sm text-muted-foreground">A separate question from AI exposure. This checks public WARN filings for the company you work for.</p>
        <div className="mt-4">
          <AiJobCheckEmployer soc6={soc6} />
        </div>
      </section>

      <section aria-labelledby="another" className="mt-10 max-w-3xl">
        <h2 id="another" className={H2}>Check another job</h2>
        <AiJobCheckForm source="result" />
      </section>

      <section aria-labelledby="faq" className="mt-10 max-w-3xl">
        <h2 id="faq" className={H2}>Questions</h2>
        <dl className="mt-4 space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium text-navy">{f.q}</dt>
              <dd className="mt-1 text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          Exposure: <a href={AI_EXPOSURE_SOURCE.url} className={LINK} rel="noopener">{AI_EXPOSURE_SOURCE.name}</a>, {AI_EXPOSURE_SOURCE.released}. Pay and growth: Bureau of Labor Statistics. Tasks and skills: O*NET. <Link href="/tools/ai-job-check" className={LINK}>All jobs</Link>.
        </p>
      </section>
    </SeoPage>
  )
}
