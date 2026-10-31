import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { WarnNoticeGenerator } from '@/components/tools/WarnNoticeGenerator'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/warn-notice-generator')

const FAQ = [
  { q: 'What does a WARN notice have to say?', a: 'It depends on who gets it. Each affected employee with no representative must be told whether the action is expected to be permanent or temporary (and if the entire plant will close), the date it will begin and that employee’s own separation date, whether bumping rights exist, and a company official to contact with a phone number. A union representative gets the site’s name and address, a company contact, whether it is permanent or temporary, the first separation date and the schedule, and the job titles affected with the names of the workers who hold them. The State dislocated worker unit and the local chief elected official get the site, a contact, permanent or temporary, the first separation date and schedule, the job titles with the number affected in each, whether bumping rights exist, and each union’s name and its chief elected officer’s name and address. Source: 20 C.F.R. 639.7.' },
  { q: 'Who has to receive the notice?', a: 'The affected employees (or their representative), the State dislocated worker unit, and the chief elected official of the local government where the site is. The generator drafts all three.' },
  { q: 'How far ahead does it have to go out?', a: 'Federal law requires written notice at least 60 days before a plant closing or mass layoff. A few states ask for more. New Jersey and New York ask for 90 days. Choose your state in the tool to see the date.' },
  { q: 'Is the draft legal advice or a finished notice?', a: 'No. It is a starting draft built from the federal regulation’s list of required contents. A lawyer should read it for your facts, your state’s additions, and any exception that shortens the notice period.' },
  { q: 'Does it cover state laws?', a: 'It shows the rule and the notice deadline for the eleven states whose own statute or labor department pages we have read (California, Delaware, Illinois, Iowa, Maine, Maryland, New Hampshire, New Jersey, New York, Vermont and Washington) and tells you when yours is not listed. It does not add a state’s extra notice items to the draft.' },
  { q: 'Is anything I type saved or sent?', a: 'No. The draft is built in your browser. Nothing is sent to us or stored.' },
]

export default function WarnNoticeGeneratorPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'WARN notice generator', path: '/tools/warn-notice-generator' }]}
      h1={pageH1('/tools/warn-notice-generator', 'WARN notice template and generator')}
      lede="Answer a few questions to draft the three notices a plant closing or mass layoff requires: to each employee, to a union if one represents them, and to the State and local government. Free, no account, and nothing leaves your browser."
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'WARN notice generator', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <WarnNoticeGenerator />
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>WARN notice questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
          First check whether the Act applies: the <Link href="/tools/warn-act-checker" className={LINK}>WARN Act checker</Link>. More: <Link href="/resources/warn-act" className={LINK}>the WARN Act in plain language</Link>, <Link href="/topics/how-to-lay-off-employees" className={LINK}>how to lay off employees</Link> and <Link href="/rapid-response" className={LINK}>rapid response</Link>.
        </p>
      </section>
      <ActionBand
        title="Support for the people leaving"
        body="NextChapter provides outplacement for employers: coaching, a job search plan and reporting on outcomes."
        label="See outplacement for employers"
        href="/outplacement"
        event="seo_employer_cta_clicked"
        properties={{ source: 'warn_notice_generator' }}
      />
    </SeoPage>
  )
}
