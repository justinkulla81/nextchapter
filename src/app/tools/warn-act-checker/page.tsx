import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { WarnActChecker } from '@/components/tools/WarnActChecker'

export const metadata: Metadata = pageMetadata('/tools/warn-act-checker')

const FAQ = [
  { q: 'Which employers does the WARN Act cover?', a: 'Generally employers with 100 or more full-time employees, or 100 or more employees who together work at least 4,000 hours a week, not counting overtime.' },
  { q: 'What counts as a mass layoff?', a: 'Job losses at a single site within 30 days affecting 500 or more full-time employees, or 50 to 499 when they are at least one third of the site’s full-time workforce.' },
  { q: 'What counts as a plant closing?', a: 'A permanent or temporary shutdown of a single site or operating unit that causes 50 or more full-time employees to lose their jobs within 30 days.' },
  { q: 'How much notice is required?', a: '60 calendar days, in writing, to affected employees or their union, the state dislocated worker unit and the chief elected official of the local government.' },
]

export default function WarnActCheckerPage() {
  return (
    <SeoPage
      trail={[{ name: 'Rapid response', path: '/rapid-response' }, { name: 'WARN Act checker', path: '/tools/warn-act-checker' }]}
      h1="WARN Act checker"
      lede="Enter your headcount and the number of jobs being cut. The checker applies the federal WARN Act thresholds and tells you whether 60 days’ notice is likely required. General information, not legal advice."
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]}
    >
      <WarnActChecker />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>How the federal rule works</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          The checker leaves out the exceptions (unforeseeable business circumstances, a faltering company, natural disaster), state notice laws and 90-day aggregation. Find your state’s boards and job centers on <Link href="/rapid-response" className={LINK}>rapid response by state</Link>.
        </p>
      </section>
      <ActionBand
        title="Support for the people leaving"
        body="NextChapter provides outplacement for employers: coaching, a job search plan and reporting on outcomes."
        label="See outplacement for employers"
        href="/outplacement"
        event="seo_employer_cta_clicked"
        properties={{ page: 'warn_act_checker', audience: 'employer' }}
      />
    </SeoPage>
  )
}
