import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { LayoffRiskCheck } from '@/components/layoffs/LayoffRiskCheck'
import { pageMetadata } from '@/lib/seo/keywords'
import { getIndustryTrends } from '@/lib/layoff-risk/context'
import { HIGH_AI_EXPOSURE, INDUSTRY_MIN_NOTICES, INDUSTRY_RISE_RATIO, MIN_RECENT_MONTHS_FOR_REPEAT } from '@/lib/layoff-risk/rules'
import { AEI_SOURCE } from '@/lib/market/aei-observed-exposure'
import { WARN_SOURCES } from '@/lib/warn-guide/rules'

// A layoff risk check that shows its work: five signs, each a fact this site can check, with the threshold written out. It does not
// predict. The rules live in src/lib/layoff-risk/rules.ts and are tested; the page explains them in the same words.

export const revalidate = 3600

export const metadata: Metadata = pageMetadata('/tools/layoff-risk-check')

const FAQ = [
  { q: 'Can this tell me if I will be laid off?', a: 'No. It counts signs that are on public record and shows each one. It cannot see your team, your manager or what leaders say inside the company, and its thresholds have not been tested against who was actually laid off. Use it as a prompt to prepare.' },
  { q: 'What if my employer is not listed?', a: 'Then it has no WARN notice or announcement on our record. That is not proof it is safe: WARN covers employers with 100 or more employees and layoffs of 50 or more at a site, and some states publish late or not at all. Leave the employer blank and answer the industry and kind-of-work questions.' },
  { q: 'Why is tenure not a question?', a: 'We could not find a source that ties how long someone has worked somewhere to being laid off in today’s cuts, so a tenure question would be a guess. We left it out rather than add a weight we cannot back.' },
  { q: 'Does high AI exposure mean my job will disappear?', a: 'No. Exposure here is the share of an occupation’s tasks that an AI model could speed up and that show work-related use, from the Anthropic Economic Index. It measures coverage of tasks, not job loss.' },
  { q: 'Is anything saved?', a: 'No. The check runs in your browser from a table of notice counts and one lookup for your employer. Nothing is stored unless you ask for the alert email.' },
]

export default async function LayoffRiskCheckPage() {
  const industries = await getIndustryTrends().catch(() => [])
  const asOf = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
  const updated = new Date().toISOString().slice(0, 10)

  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Layoff risk check', path: '/tools/layoff-risk-check' }]}
      h1="Layoff risk check: are there warning signs where you work?"
      lede={
        <>
          <p>
            Five checks against public layoff records: whether your employer has filed layoff notices or announced cuts, whether notices in your industry are rising, and how much of your kind of work AI is used on.
            You see every check and why it did or did not apply. It does not predict whether you will be laid off.
          </p>
          <AuthorByline updated={updated} className="mt-4" />
        </>
      }
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Layoff risk check', applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <div className="mt-8 max-w-3xl">
        <LayoffRiskCheck industries={industries} asOf={asOf} />
      </div>

      <section aria-labelledby="how" className="mt-14">
        <h2 id="how" className={H2}>How the check works</h2>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">
          Each sign is a yes or no with a threshold we wrote down. The level comes from how many apply, and the rules are the same for everyone.
        </p>
        <ol className="mt-4 max-w-3xl list-decimal space-y-3 pl-5 text-base">
          <li><span className="font-semibold text-navy">Employer filed a WARN notice.</span> At least one notice in the last 12 months in the state WARN lists this site reads.</li>
          <li><span className="font-semibold text-navy">Employer filed in {MIN_RECENT_MONTHS_FOR_REPEAT} or more different months.</span> Notices in {MIN_RECENT_MONTHS_FOR_REPEAT} or more calendar months of the last 12, which suggests cuts that keep coming.</li>
          <li><span className="font-semibold text-navy">Employer announced or was reported to have cut jobs or offered buyouts.</span> An announcement or press report in the last 12 months, which may not be a WARN filing.</li>
          <li><span className="font-semibold text-navy">Notices in your industry are rising.</span> Notices in the last 6 months are at least {INDUSTRY_RISE_RATIO} times the 6 months before, with at least {INDUSTRY_MIN_NOTICES} notices across the 12 months so that a few filings do not make a trend.</li>
          <li><span className="font-semibold text-navy">Your kind of work has high observed AI exposure.</span> At least {(HIGH_AI_EXPOSURE * 100).toFixed(0)}% of tasks on average in your occupation group, from the Anthropic Economic Index. Five of the 22 groups reach it: business and financial operations, computer and mathematical, legal, sales, and office and administrative support.</li>
        </ol>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          <span className="font-semibold text-navy">High</span> means your employer filed a notice and also shows another employer sign (filings in more than one month, or an announcement).{' '}
          <span className="font-semibold text-navy">Watch</span> means one employer sign applies, or both the industry and kind-of-work signs do. <span className="font-semibold text-navy">Low</span> is everything else.
        </p>
      </section>

      <section aria-labelledby="why" className="mt-12">
        <h2 id="why" className={H2}>Why these five, and what is left out</h2>
        <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-base text-muted-foreground">
          <li>A company that has cut once often cuts again. A commercial analysis of layoffs.fyi data on U.S. tech companies, 2023 to 2025, found about 27% of the 1,031 companies with a layoff had two or more rounds, and that 70% of repeat layoffs came within 12 months of the first ({' '}
            <a href="https://zety.com/blog/repeat-layoff-index" rel="noopener" className={LINK}>Zety, repeat layoff index</a>). That is tech only, from a commercial résumé site and not peer reviewed (reported by <a href="https://www.cpapracticeadvisor.com/2026/03/25/study-exposes-repeat-layoffs-across-u-s-tech-companies/180189/" rel="noopener" className={LINK}>CPA Practice Advisor</a>, March 25, 2026), so we use it as context for the repeat sign, not as proof.</li>
          <li>WARN notices are public and dated, so the employer and industry signs can be checked by anyone against the <Link href="/layoffs" className={LINK}>layoff tracker</Link>. Coverage is limited to employers with 100 or more employees; the federal Act’s definitions are in <a href={WARN_SOURCES.statute101.url} rel="noopener" className={LINK}>{WARN_SOURCES.statute101.label}</a>.</li>
          <li>AI exposure comes from <a href={AEI_SOURCE.url} rel="noopener" className={LINK}>{AEI_SOURCE.title}</a> ({AEI_SOURCE.published}), averaged over the occupations in each group. It measures how many tasks AI is used on, not who loses work.</li>
          <li>Left out: tenure and company size as scores, because we found no source to weight them; and anything you could not check yourself.</li>
        </ul>
      </section>

      <section aria-labelledby="after" className="mt-12 rounded-xl border border-border bg-white p-6">
        <h2 id="after" className="text-xl font-semibold tracking-tight text-navy">If a layoff is coming or has happened</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li><Link href="/resources/warn-act" className={LINK}>The WARN Act in plain language</Link>: who is covered, when 60 days’ notice is due, what is owed</li>
          <li><Link href="/layoffs/by-state" className={LINK}>WARN notices by state</Link> and the <Link href="/layoffs" className={LINK}>layoff tracker</Link></li>
          <li><Link href="/tools/severance-calculator" className={LINK}>Severance calculator</Link> and <Link href="/tools/layoff-deadlines" className={LINK}>layoff deadlines</Link></li>
          <li><Link href="/resources/cobra-aca" className={LINK}>COBRA vs ACA</Link> for health coverage, and <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link></li>
        </ul>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Questions</h2>
        <div className="mt-4 max-w-3xl space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-xl border border-border bg-white p-4">
              <summary className="cursor-pointer text-base font-semibold text-navy">{f.q}</summary>
              <p className="mt-2 text-base text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </SeoPage>
  )
}
