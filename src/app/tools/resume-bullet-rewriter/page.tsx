import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { RewriteBulletsTool } from '@/components/tools/FreeAiTool'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/resume-bullet-rewriter')

const FAQ = [
  { q: 'Does it make up results for me?', a: 'No. It keeps the facts you give and does not invent numbers, tools or outcomes. Where a number would strengthen a bullet, it tells you what to add.' },
  { q: 'Is this AI?', a: 'Yes. Your bullets are sent to an AI model to rewrite them, and nothing is saved by us. The free tool has a daily limit, and when it is reached it resets the next day.' },
  { q: 'Do you keep my résumé text?', a: 'No. The text is used once to produce the rewrite and is not stored.' },
  { q: 'Should I just paste the rewrite in?', a: 'Read it first and check every fact is true. Keep your own numbers and names, and change any wording that does not sound like you.' },
]

export default function ResumeBulletRewriterPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Résumé bullet rewriter', path: '/tools/resume-bullet-rewriter' }]}
      h1={pageH1('/tools/resume-bullet-rewriter', 'Free résumé bullet rewriter')}
      lede="Paste up to four bullets from your résumé and get stronger versions that keep your facts, plus a prompt for any number worth adding. Free, no account."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Résumé bullet rewriter', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <RewriteBulletsTool />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Résumé bullet rewriter questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/tools/resume-check" className={LINK}>résumé check</Link>, <Link href="/tools/interview-answer-coach" className={LINK}>interview answer coach</Link> and <Link href="/tools" className={LINK}>all tools</Link>.
        </p>
      </section>
    </SeoPage>
  )
}
