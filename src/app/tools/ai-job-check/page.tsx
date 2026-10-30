import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { AiJobCheckForm } from '@/components/tools/AiJobCheckForm'
import { AI_EXPOSURE_SOURCE } from '@/lib/skills/ai-exposure'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { checkPath } from '@/lib/ai-check/slug'
import occupations from '@/lib/ai-check/occupations.json'

export const metadata: Metadata = pageMetadata('/tools/ai-job-check')

const POPULAR = occupations.slice(0, 18)

const FAQ = [
  { q: 'What does the AI exposure number mean?', a: 'It is the share of a job’s tasks that AI is already used for at work, weighted by time spent on each task. It comes from real usage data in the Anthropic Economic Index, not from a guess about the future.' },
  { q: 'Does a high number mean my job is going away?', a: 'No. It measures how much of the work AI is already used on, not job loss. Many jobs with high numbers are growing, and a low number means no use has been seen yet, not that the job is protected.' },
  { q: 'Where does the data come from?', a: 'Exposure is from the Anthropic Economic Index. Pay and growth are from the Bureau of Labor Statistics. Skills and tasks are from O*NET. Layoff notices are public WARN filings.' },
  { q: 'Do you save my job title?', a: 'No. The search runs once and nothing is stored unless you choose to start a free assessment.' },
]

export default function AiJobCheckPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'AI job check', path: '/tools/ai-job-check' }]}
      h1={pageH1('/tools/ai-job-check', 'Is my job safe from AI? Free AI exposure check')}
      lede="Type your job title to see how much of the work AI already does, which related jobs pay more or are less exposed, and which skills to build. Free, no account."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'AI job check', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <AiJobCheckForm source="hub" />

      <section aria-labelledby="popular" className="mt-12">
        <h2 id="popular" className={H2}>Or start with a common job</h2>
        <ul className="mt-4 flex max-w-3xl flex-wrap gap-2">
          {POPULAR.map((o) => (
            <li key={o.soc}>
              <Link href={checkPath(o.title, o.soc)} className="inline-block rounded-full border border-border bg-white px-4 py-2 text-sm text-navy hover:border-brand">
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>AI job check questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium text-navy">{f.q}</dt>
              <dd className="mt-1 text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          Exposure data: <a href={AI_EXPOSURE_SOURCE.url} className={LINK} rel="noopener">{AI_EXPOSURE_SOURCE.name}</a>, {AI_EXPOSURE_SOURCE.released}. More: <Link href="/data/ai-jobs-index" className={LINK}>the AI Jobs Index</Link>, <Link href="/ai-skills" className={LINK}>AI skills and pay</Link>, <Link href="/tools/layoff-risk-check" className={LINK}>layoff risk check</Link> and <Link href="/tools" className={LINK}>all tools</Link>.
        </p>
      </section>

      <ActionBand title="Turn the number into a plan" body="A free Market Reality Assessment shows how recruiters read your background, then ranks every open job for you." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'ai_job_check' }} />
    </SeoPage>
  )
}
