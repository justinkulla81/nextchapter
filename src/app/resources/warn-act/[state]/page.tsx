import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { STATE_WARN_LAWS, WARN_GUIDE_AS_OF, WARN_SOURCES, type StateWarnLaw } from '@/lib/warn-guide/rules'
import { stateFromSlug, stateSlug } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'
import { canonical } from '@/lib/seo/canonical'

// One page for each state whose own notice law was read from the statute or the state's labor department
// (src/lib/warn-guide/rules.ts). A state is added there with its sources first, then it gets a page here.
export const dynamicParams = false
export function generateStaticParams() {
  return STATE_WARN_LAWS.map((l) => ({ state: stateSlug(l.code) }))
}

function lawFor(slug: string): StateWarnLaw | null {
  const code = stateFromSlug(slug)
  return STATE_WARN_LAWS.find((l) => l.code === code) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const law = lawFor(state)
  if (!law) return {}
  return {
    title: titleMeta(`${law.name} WARN Act: ${law.noticeDays} Days' Notice and Who Is Covered`),
    description: `${law.name}'s own layoff notice law: who is covered, how much notice, what it adds to the federal WARN Act, and the statute it comes from. Read from the state's own pages.`,
    ...canonical(`/resources/warn-act/${state}`),
  }
}

export default async function StateWarnPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const law = lawFor(state)
  if (!law) notFound()
  const slug = stateSlug(law.code)
  const sources = law.sources.map((k) => WARN_SOURCES[k])
  const faq = [
    { q: `Does ${law.name} have its own WARN Act?`, a: `Yes. ${law.summary}` },
    { q: `How is ${law.name}'s rule different from the federal WARN Act?`, a: law.differs },
    { q: `How many days of notice does ${law.name} require?`, a: `${law.noticeDays} days is the longest notice period the state's law sets for the employer's notice. The federal Act requires 60 days, and the federal rule applies in every state.` },
  ]
  return (
    <SeoPage
      trail={[{ name: 'Resources', path: '/resources' }, { name: 'The WARN Act', path: '/resources/warn-act' }, { name: law.name, path: `/resources/warn-act/${slug}` }]}
      h1={`${law.name} WARN Act: who is covered and how much notice`}
      lede={`${law.name} has its own layoff notice law on top of the federal WARN Act. This is what it says, read from the state’s own pages as of ${WARN_GUIDE_AS_OF}, with the sources.`}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]}
    >
      <section aria-labelledby="rule" className="max-w-3xl">
        <h2 id="rule" className={H2}>The rule</h2>
        <p className="mt-3 text-base text-foreground">{law.summary}</p>
        <h2 id="differs" className={`${H2} mt-8`}>How it differs from the federal rule</h2>
        <p className="mt-3 text-base text-foreground">{law.differs}</p>
        {law.caveat && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><span className="font-medium">Check:</span> {law.caveat}</p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          This is general information, not legal advice. The federal WARN Act applies in every state as well; see <Link href="/resources/warn-act" className={LINK}>the WARN Act in plain language</Link>.
        </p>
      </section>

      <section aria-labelledby="sources" className="mt-10 max-w-3xl">
        <h2 id="sources" className={H2}>Sources</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          {sources.map((s) => (
            <li key={s.url}><a href={s.url} className={LINK} rel="noopener noreferrer">{s.label}</a></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq" className="mt-10">
        <h2 id="faq" className={H2}>{law.name} WARN Act questions</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {faq.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tools" className="mt-10 max-w-3xl rounded-xl border border-border bg-white p-6">
        <h2 id="tools" className="text-xl font-semibold tracking-tight text-navy">Using this</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>Employers: <Link href="/tools/warn-notice-generator" className={LINK}>draft the WARN notices and see the {law.name} deadline</Link> and <Link href="/tools/warn-act-checker" className={LINK}>check whether notice is likely required</Link>.</li>
          <li>Workers: <Link href={`/layoffs/${slug}`} className={LINK}>{law.name} layoff notices on file</Link> and <Link href={`/unemployment-benefits/${slug}`} className={LINK}>{law.name} unemployment benefits and how to file</Link>.</li>
          <li><Link href="/layoffs/2026" className={LINK}>Layoffs in 2026</Link>, by month, state and company.</li>
        </ul>
      </section>
      <ActionBand
        title="Support for the people leaving"
        body="NextChapter provides outplacement for employers: coaching, a job search plan and reporting on outcomes."
        label="See outplacement for employers"
        href="/outplacement"
        event="seo_employer_cta_clicked"
        properties={{ source: 'warn_state_page', state: law.code }}
      />
    </SeoPage>
  )
}
