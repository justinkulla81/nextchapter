import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { ResumeCheck } from '@/components/tools/ResumeCheck'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices } from '@/lib/leads/infer-journey'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/resume-check')

const FAQ = [
  { q: 'How does the résumé check work?', a: 'You paste your résumé as text. Fixed rules score it out of 100 on eleven things: contact details, length, standard headings, results with numbers, action verbs, duty phrases like “responsible for”, a summary, filler phrases, “I” at the start of lines, dates and layout.' },
  { q: 'Does it use AI?', a: 'No. The same text always gets the same score, and a check costs nothing to run.' },
  { q: 'Do you keep my résumé?', a: 'No. It is read once to score it and is not saved. If you leave an email, we keep the email and your score band, not the text.' },
  { q: 'Will this get me past an applicant tracking system?', a: 'It checks the things those systems commonly trip on, like missing headings, tables and columns, and no dates. No tool can promise a pass, because every employer configures its system differently.' },
  { q: 'What can it not tell me?', a: 'Whether your experience suits a role, or whether your results are impressive. It reads structure and wording, so a high score means the résumé is clear, not that you will get an interview.' },
]

export default function ResumeCheckPage() {
  const choices = journeyChoices('thinking-about-a-move')
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ slug: p.slug, label: p.label }))
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'Résumé check', path: '/tools/resume-check' }]}
      h1={pageH1('/tools/resume-check', 'Free résumé check: score your résumé in a minute')}
      lede="Paste your résumé to get a score out of 100 and see how many fixes it needs. Leave an email to see exactly what to change. No AI, no account."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Résumé check', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <ResumeCheck journeyChoices={choices} />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Résumé check questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">
          More: <Link href="/topics/resume-review" className={LINK}>how to review a résumé yourself</Link>, <Link href="/topics/resume-tips" className={LINK}>résumé tips for experienced professionals</Link> and <Link href="/tools" className={LINK}>all tools</Link>.
        </p>
      </section>
      <ActionBand title="See how the market reads your résumé" body="A free Market Reality Assessment shows how recruiters read your background, then ranks every open job for you." label="Get my free assessment" href={MARKET_REALITY_START_HREF} event="tool_page_cta_clicked" properties={{ tool: 'resume_check' }} />
    </SeoPage>
  )
}
