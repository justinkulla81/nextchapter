import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { JobMatch } from '@/components/tools/JobMatch'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/resume-job-match')

const FAQ = [
  { q: 'How does the résumé and job description match work?', a: 'You paste a job posting and your résumé. The tool pulls the words and two-word phrases the posting stresses, counting how often it says each and giving more weight to named skills and to its requirements section, then checks which of them your résumé already says. The score is the weighted share it finds.' },
  { q: 'Does it use AI?', a: 'No. Fixed rules do the comparison, so the same two texts always give the same result.' },
  { q: 'Is my résumé saved or sent anywhere?', a: 'No. The comparison runs in your browser. Neither the résumé nor the posting is sent to us or stored.' },
  { q: 'What score should I aim for?', a: 'There is no pass mark. A recruiter or an applicant tracking system looks for the words a posting stresses, so 70 or higher on a posting you really fit is a good sign, and a low score on a job you are well qualified for usually means you describe the work in different words.' },
  { q: 'Should I add every missing word?', a: 'No. Add a word only where it is true and where a bullet can show a result with it. Copying a posting’s words into a skills list without the experience behind them does not help and is easy for a recruiter to spot.' },
  { q: 'What can it not tell me?', a: 'Whether your experience is strong or fits the level, how a particular employer’s system ranks résumés, or whether the posting is real. It compares wording only.' },
]

export default function ResumeJobMatchPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Résumé and job match', path: '/tools/resume-job-match' }]}
      h1={pageH1('/tools/resume-job-match', 'Résumé vs job description: see which keywords you are missing')}
      lede="Paste a job posting and your résumé to see which of the posting’s keywords your résumé already says and which it leaves out. Free, no AI, no account, and nothing leaves your browser."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Résumé and job description match', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <JobMatch />
      <section aria-labelledby="how" className="mt-12 max-w-3xl">
        <h2 id="how" className={H2}>How to use the result</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          <li>Start with the missing terms marked required. They come from the posting’s requirements section.</li>
          <li>For each one you have really done, add it to the bullet where it happened, with the result and a number.</li>
          <li>Use the posting’s own wording for the same thing you did (“forecasting” if it says forecasting, not “predicting revenue”).</li>
          <li>Run it again for each job you apply to. A résumé tuned to one posting is not tuned to the next.</li>
        </ol>
      </section>
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Résumé and job match questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/tools/resume-check" className={LINK}>free résumé check</Link>, <Link href="/topics/resume-tips" className={LINK}>résumé tips</Link>, <Link href="/tools/resume-bullet-rewriter" className={LINK}>résumé bullet rewriter</Link> and <Link href="/tools" className={LINK}>all free tools</Link>.
        </p>
      </section>
      <ActionBand title="See how the market reads your résumé" body="A free Market Reality Assessment shows how recruiters read your background, then ranks every open job for you." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'resume_job_match' }} />
    </SeoPage>
  )
}
