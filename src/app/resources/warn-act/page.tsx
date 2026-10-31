import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { LayoffAlertForm } from '@/components/layoffs/LayoffAlertForm'
import { PlanStart } from '@/components/layoffs/PlanStart'
import { SourceRefs, WarnSources } from '@/components/layoffs/WarnSources'
import { FEDERAL_WARN, STATE_WARN_LAWS, WARN_GUIDE_AS_OF } from '@/lib/warn-guide/rules'
import { pageMetadata } from '@/lib/seo/keywords'
import { stateSlug } from '@/lib/seo/states'

// The WARN Act explained in plain language, every rule traced to its source (src/lib/warn-guide/rules.ts). It answers "what is a WARN
// notice", "WARN Act 60 days" and "do I get severance or pay" searches, and it is the page the company and state layoff pages link to.

export const revalidate = 86400

export const metadata: Metadata = pageMetadata('/resources/warn-act')

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is a WARN notice?',
    a: 'A WARN notice is the written warning an employer must give before a plant closing or mass layoff under the federal Worker Adjustment and Retraining Notification Act. It goes to the affected employees or their representative, to the state, and to the local government at least 60 days ahead. States publish the notices they receive, which is where the layoff tracker on this site gets them.',
  },
  {
    q: 'Does my employer have to give 60 days’ notice?',
    a: 'Only if the federal Act covers the employer and the layoff is big enough. The employer needs 100 or more employees, not counting part-time employees. The event has to be a plant closing (50 or more employees lose their jobs at one site in 30 days) or a mass layoff (at least 33% of the site and at least 50 employees, or at least 500 employees). A smaller layoff can still be covered by a state law with lower thresholds, or by the 90-day rule that adds up smaller cuts.',
  },
  {
    q: 'Do I get paid during the 60 days?',
    a: 'The Act requires notice, not pay during the notice period. An employer that skips required notice owes each affected employee back pay for each day of the violation, up to 60 days, plus the benefits they would have had. The rules we read do not say whether pay instead of notice satisfies the Act, so ask your state labor department or a lawyer if that is what you were offered.',
  },
  {
    q: 'Can an employer give less than 60 days’ notice?',
    a: 'In three cases: a faltering company (plant closings only) that was actively seeking money and reasonably believed notice would have cost it that money, an unforeseeable business circumstance, or a natural disaster. The employer must prove the exception applies, still give as much notice as practicable, and say briefly why notice was short. Courts and the rules read each exception narrowly.',
  },
  {
    q: 'Can a WARN notice stop my layoff?',
    a: 'No. A federal court cannot stop a plant closing or mass layoff under the Act, and the remedies in the Act, back pay, benefits and fees, are the only ones it provides. Employees, their representatives and local governments sue in federal court for what the employer owes.',
  },
  {
    q: 'What if I work part-time or have worked there under six months?',
    a: 'Part-time employees, defined as averaging under 20 hours a week or working fewer than 6 of the 12 months before notice is due, are not counted when deciding whether a layoff is big enough. The sources we read do not settle every question about part-time workers’ own rights, so ask your state labor department or a lawyer about your case.',
  },
  {
    q: 'My state has its own law. Which one applies?',
    a: 'Both can apply. Several states cover smaller employers or require more notice than the federal Act. Eleven states are summarized below with their own sources; for any other state, start at your state labor department. The federal rule applies in every state.',
  },
  {
    q: 'Where can I see whether my employer filed a notice?',
    a: 'Each state publishes its own list. This site collects them: search the layoff tracker, open your state’s page, or open the employer’s page if it has filed. A state may publish late or leave out worker counts, so no notice on file does not mean no layoff.',
  },
]

const ROWS = [
  { law: 'Federal WARN Act', who: '100 or more employees (not counting part-time), or 100 or more working 4,000 hours a week', days: '60 days', mass: 'At least 500 at a site, or 33% and at least 50' },
  { law: 'California', who: '75 or more employees in the preceding 12 months', days: '60 days', mass: '50 or more in 30 days; also closures and relocations of 100 miles or more' },
  { law: 'New Jersey', who: '100 or more employees (amended April 10, 2023)', days: '90 days', mass: '50 or more at a worksite; severance of one week per full year if notice is short' },
  { law: 'New York', who: '50 or more full-time employees in the state', days: '90 days', mass: '25 or more full-time and 33% of the site, or 250 or more' },
  { law: 'Illinois', who: '75 or more full-time employees', days: '60 days', mass: '25 or more full-time and one third of the site, or 250 or more' },
  { law: 'Washington', who: '50 or more employees in the state (since July 27, 2025)', days: '60 days', mass: '50 or more in 30 days' },
  { law: 'Maine', who: '100 or more persons at the facility', days: '90 days (closing)', mass: 'Severance of one week’s pay per year of service, after 3 years' },
  { law: 'Iowa', who: '25 or more employees (not counting part-time)', days: '30 days', mass: '25 or more at a site in 30 days' },
  { law: 'Maryland', who: '50 or more employees', days: '60 days', mass: '25% or 15 employees, whichever is greater, over 3 months' },
  { law: 'New Hampshire', who: '100 or more employees (not counting part-time)', days: '60 days', mass: 'Closing of 50 or more; layoff of 250, or 25 if they are 33%' },
  { law: 'Vermont', who: '50 or more full-time employees, or the part-time equivalent', days: '45 days to the state, 30 to employees', mass: '50 or more in 90 days; up to ten days’ severance if notice is short' },
  { law: 'Delaware', who: '100 or more employees (not counting part-time)', days: '60 days', mass: '50 or more at 33% of a site, or 500; relocations of 50 miles' },
]

export default function WarnActPage() {
  return (
    <SeoPage
      trail={[{ name: 'Resources', path: '/resources' }, { name: 'WARN Act', path: '/resources/warn-act' }]}
      h1="The WARN Act in plain language: 60 days’ notice and what it means for you"
      lede={
        <>
          <p>
            Under the federal WARN Act, an employer with 100 or more employees must give 60 days’ written notice before a plant closing or mass layoff. If it does not, it owes affected employees back pay and benefits for up to 60 days.
            Many states add rules of their own. Here is who is covered, what counts, when notice can be shorter, and where to see whether your employer has filed.
          </p>
          <AuthorByline updated={WARN_GUIDE_AS_OF} className="mt-4" />
        </>
      }
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]}
    >
      <section aria-labelledby="short" className="mt-8">
        <h2 id="short" className={H2}>The short answer</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-base text-navy">
          <li>Covered employers must give written notice at least 60 days before a plant closing or mass layoff.<SourceRefs keys={FEDERAL_WARN.notice.sources} /></li>
          <li>It is not enough for a layoff to happen at a big company. The cut has to hit the thresholds at a single site: 50 or more people in a plant closing, or a mass layoff of at least 33% of the site and at least 50 people, or 500 or more.<SourceRefs keys={FEDERAL_WARN.massLayoff.sources} /></li>
          <li>Notice goes to you or your representative, to the state, and to your local government.<SourceRefs keys={FEDERAL_WARN.notice.sources} /></li>
          <li>If the employer skips notice it owes back pay and benefits for up to 60 days. A court will not stop the layoff.<SourceRefs keys={FEDERAL_WARN.remedy.sources} /></li>
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/layoffs" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
            See who has filed a notice
          </Link>
          <span className="text-sm text-muted-foreground">Free, every state we can read, with each state’s own record linked.</span>
        </div>
      </section>

      <section aria-labelledby="who" className="mt-12">
        <h2 id="who" className={H2}>Who is covered, and what counts</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-base">
          <div>
            <dt className="font-semibold text-navy">The employer</dt>
            <dd className="mt-1 text-muted-foreground">{FEDERAL_WARN.coverage.text}<SourceRefs keys={FEDERAL_WARN.coverage.sources} /></dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">A plant closing</dt>
            <dd className="mt-1 text-muted-foreground">{FEDERAL_WARN.plantClosing.text}<SourceRefs keys={FEDERAL_WARN.plantClosing.sources} /></dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">A mass layoff</dt>
            <dd className="mt-1 text-muted-foreground">{FEDERAL_WARN.massLayoff.text}<SourceRefs keys={FEDERAL_WARN.massLayoff.sources} /></dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">Part-time employees</dt>
            <dd className="mt-1 text-muted-foreground">{FEDERAL_WARN.partTime.text}<SourceRefs keys={FEDERAL_WARN.partTime.sources} /></dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">An employment loss</dt>
            <dd className="mt-1 text-muted-foreground">{FEDERAL_WARN.employmentLoss.text}<SourceRefs keys={FEDERAL_WARN.employmentLoss.sources} /></dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">Cuts that add up</dt>
            <dd className="mt-1 text-muted-foreground">{FEDERAL_WARN.aggregation.text}<SourceRefs keys={FEDERAL_WARN.aggregation.sources} /></dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">Sales and transfers</dt>
            <dd className="mt-1 text-muted-foreground">{FEDERAL_WARN.sale.text} {FEDERAL_WARN.transfer.text}<SourceRefs keys={FEDERAL_WARN.sale.sources} /></dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="notice" className="mt-12">
        <h2 id="notice" className={H2}>What the notice has to say, and when it can be late</h2>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">{FEDERAL_WARN.content.text}<SourceRefs keys={FEDERAL_WARN.content.sources} /></p>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">{FEDERAL_WARN.exceptions.text}<SourceRefs keys={FEDERAL_WARN.exceptions.sources} /></p>
      </section>

      <section aria-labelledby="owed" className="mt-12">
        <h2 id="owed" className={H2}>What an employer owes if it skips notice</h2>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">{FEDERAL_WARN.remedy.text}<SourceRefs keys={FEDERAL_WARN.remedy.sources} /></p>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">{FEDERAL_WARN.penalty.text}<SourceRefs keys={FEDERAL_WARN.penalty.sources} /></p>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">{FEDERAL_WARN.enforcement.text}<SourceRefs keys={FEDERAL_WARN.enforcement.sources} /></p>
      </section>

      <section aria-labelledby="states" className="mt-12">
        <h2 id="states" className={H2}>{STATE_WARN_LAWS.length} states go further</h2>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">
          States can cover smaller employers, require longer notice or add pay. These {STATE_WARN_LAWS.length} were read from the state’s own statute or labor department pages and are summarized with their sources. Other states have laws too; they are not listed because we have not sourced them yet, so check your state labor department.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <caption className="sr-only">Federal WARN Act and state laws compared</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Law</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Covered employer</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Notice</th>
                <th scope="col" className="border-b border-border py-2 font-medium">Mass layoff and extras</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.law} className="align-top">
                  <th scope="row" className="border-b border-border py-3 pr-3 text-left font-medium text-navy">{r.law}</th>
                  <td className="border-b border-border py-3 pr-3 text-muted-foreground">{r.who}</td>
                  <td className="border-b border-border py-3 pr-3 tabular-nums text-muted-foreground">{r.days}</td>
                  <td className="border-b border-border py-3 text-muted-foreground">{r.mass}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-6 space-y-5 text-base">
          {STATE_WARN_LAWS.map((s) => (
            <li key={s.code} className="max-w-3xl">
              <p className="font-semibold text-navy">{s.name}</p>
              <p className="mt-1 text-muted-foreground">{s.summary}<SourceRefs keys={s.sources} /></p>
              <p className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">How it differs:</span> {s.differs}</p>
              {s.caveat && <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">Check:</span> {s.caveat}</p>}
              <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                <Link href={`/resources/warn-act/${stateSlug(s.code)}`} className={LINK}>{s.name} WARN Act rules</Link>
                <Link href={`/layoffs/${stateSlug(s.code)}`} className={LINK}>{s.name} layoff notices on file</Link>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="next" className="mt-12 rounded-xl border border-border bg-white p-6">
        <h2 id="next" className="text-xl font-semibold tracking-tight text-navy">If you have been told, or expect to be</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li><Link href="/tools/layoff-deadlines" className={LINK}>Layoff deadlines: what to do and by when</Link></li>
          <li><Link href="/tools/severance-calculator" className={LINK}>Severance calculator</Link></li>
          <li><Link href="/unemployment-benefits" className={LINK}>Unemployment benefits by state and how to file</Link></li>
          <li><Link href="/resources/cobra-aca" className={LINK}>Health insurance after a layoff: COBRA vs ACA</Link></li>
          <li><Link href="/resources/72-hours" className={LINK}>The first 72 hours after a layoff</Link></li>
          <li><Link href="/tools/layoff-risk-check" className={LINK}>Layoff risk check: how many warning signs apply to you</Link></li>
          <li><Link href="/tools/warn-act-checker" className={LINK}>WARN Act checker</Link>, for employers: is 60 days’ notice of a layoff likely required?</li>
          <li><Link href="/tools/warn-notice-generator" className={LINK}>WARN notice generator</Link>, for employers: draft the notices and see the deadline</li>
        </ul>
        <div className="mt-5"><PlanStart situationSlug="laid-off" placement="warn_act_explainer" label="Get your free Market Reality Assessment" /></div>
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

      <div className="mt-10"><LayoffAlertForm source="warn_act:explainer" /></div>

      <WarnSources />
    </SeoPage>
  )
}
