import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { InterviewAnswerTool } from '@/components/tools/FreeAiTool'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/interview-answer-coach')

const FAQ = [
  { q: 'What does the coach look at?', a: 'Whether the answer has real specifics, a clear situation, action and result, and a length that works out loud, about 60 to 90 seconds. It then gives a stronger version built only from what you wrote.' },
  { q: 'Is this AI?', a: 'Yes. Your answer is sent to an AI model for coaching, and nothing is saved by us. The free tool has a daily limit, and when it is reached it resets the next day.' },
  { q: 'Can it help with “why were you laid off?”', a: 'Yes, it is one of the questions in the list. A short, factual, forward-looking answer works best, and the coach flags blame, apology and over-explaining.' },
  { q: 'Do you keep my answer?', a: 'No. The text is used once to produce the coaching and is not stored.' },
]

export default function InterviewAnswerCoachPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Interview answer coach', path: '/tools/interview-answer-coach' }]}
      h1={pageH1('/tools/interview-answer-coach', 'Free interview answer coach')}
      lede="Pick a common interview question, write the answer you would give, and get honest feedback and a stronger version. Free, no account."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Interview answer coach', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <InterviewAnswerTool />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Interview answer coach questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/tools/resume-bullet-rewriter" className={LINK}>résumé bullet rewriter</Link>, <Link href="/tools/resume-check" className={LINK}>résumé check</Link> and <Link href="/tools" className={LINK}>all tools</Link>.
        </p>
      </section>
    </SeoPage>
  )
}
