import type { Metadata } from 'next'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { STAGE_LABEL, majorSpecs, ratioSpecs, stageSpecs, fieldSpecs } from '@/lib/rankings/degrees-specs'
import { MAJORS, MAJORS_PATH, MAJOR_BASE_YEAR, MAJOR_FAMILIES, MAJOR_SOURCE, MAJOR_YEAR, familyAnchor, fieldAnchor, majorChange, majorPath } from '@/lib/rankings/majors'
import { getDegreeFields } from '@/lib/rankings/store'
import { editionLabel } from '@/lib/rankings/build-edition'

// Every college major with its graduates (federal IPEDS completions, a static file) and, for the degree field it leads to,
// open jobs and pay by career stage from the monthly rankings build (one stored row). No scan on a page view.
export const revalidate = 86400

const n0 = (n: number) => n.toLocaleString('en-US')
const usdK = (n: number | null) => (n == null ? '–' : `$${Math.round(n / 1000)}k`)
const signed = (x: number) => (Math.round(x) === 0 ? '0%' : `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`)

const TOTAL = MAJORS.reduce((s, m) => s + m.total, 0)
const BACH = MAJORS.reduce((s, m) => s + m.bach, 0)

export const metadata: Metadata = {
  title: 'College majors: graduates, open jobs and pay by career stage',
  description: `Degrees awarded in ${MAJORS.length} college majors, which are offered most and growing fastest, and open jobs for each new graduate with pay early, mid and late in a career.`,
  ...canonical(MAJORS_PATH),
}

export default async function MajorsPage() {
  const figures = await getDegreeFields()
  const fields = (figures?.fields ?? []).filter((f) => f.grads > 0).sort((a, b) => (b.perHundred ?? 0) - (a.perHundred ?? 0))
  const families = Object.entries(MAJOR_FAMILIES)
    .map(([fam, name]) => ({ fam, name, majors: MAJORS.filter((m) => m.fam === fam).sort((a, b) => b.total - a.total) }))
    .filter((f) => f.majors.length > 0)
    .sort((a, b) => b.majors.reduce((s, m) => s + m.total, 0) - a.majors.reduce((s, m) => s + m.total, 0))
  const top = [...MAJORS].sort((a, b) => b.total - a.total)[0]
  const lists = [...ratioSpecs(), ...stageSpecs(), ...majorSpecs(), ...fieldSpecs()]
  const track = (to: string) => ({ from: 'majors_index', to })

  const ld = [{
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'College majors: graduates, open jobs and pay', url: `${SITE_URL}${MAJORS_PATH}`,
    description: `Degrees awarded by college major (${MAJOR_YEAR}) with open jobs and posted pay for the field each major leads to.`,
    creator: { '@type': 'Organization', name: 'NextChapter' }, isAccessibleForFree: true,
  }]

  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Higher education', path: '/higher-education' }, { name: 'College majors', path: MAJORS_PATH }]}
      h1="College majors: graduates, open jobs and pay"
      jsonLd={ld}
      lede={<>US colleges awarded {n0(TOTAL)} degrees at bachelor&apos;s level and above in {MAJOR_YEAR}, {n0(BACH)} of them bachelor&apos;s degrees, across {MAJORS.length} majors. {top.title} awarded the most. Below: how many graduates each field turns out against the open jobs it leads to, and what those jobs pay early, mid and late in a career.</>}
    >
      <section aria-labelledby="fields" className="mt-10">
        <h2 id="fields" className={H2}>Graduates against open jobs, by degree field</h2>
        {fields.length > 0 ? (
          <>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Open jobs are professional roles on our board whose occupation typically needs a four-year degree ({figures && editionLabel(figures.edition)}). Graduates are a year of degrees in the majors that lead to each field. Open jobs per 100 graduates compares fields; it is not anyone&apos;s odds of being hired.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <caption className="sr-only">Degree fields by open jobs per 100 graduates, with posted pay by career stage</caption>
                <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="p-3">Degree field</th><th scope="col" className="p-3 text-right">Degrees a year</th><th scope="col" className="p-3 text-right">Open jobs</th>
                    <th scope="col" className="p-3 text-right">Open jobs per 100 graduates</th>
                    {(['early', 'mid', 'late'] as const).map((s) => <th key={s} scope="col" className="p-3 text-right">{STAGE_LABEL[s].name} pay</th>)}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f) => (
                    <tr key={f.field} id={fieldAnchor(f.field)} className="scroll-mt-24 border-b border-border last:border-0">
                      <th scope="row" className="p-3 font-medium text-navy">{f.field}</th>
                      <td className="p-3 text-right tabular-nums">{n0(f.grads)}</td>
                      {f.covered === false ? (
                        <td colSpan={5} className="p-3 text-right text-muted-foreground">Not measured: most of these jobs are posted where our data does not reach</td>
                      ) : (
                        <>
                          <td className="p-3 text-right tabular-nums">{n0(f.open)}</td>
                          <td className="p-3 text-right font-semibold tabular-nums">{f.perHundred != null ? f.perHundred.toFixed(1) : '–'}</td>
                          {(['early', 'mid', 'late'] as const).map((s) => <td key={s} className="p-3 text-right tabular-nums">{usdK(f.stages[s].pay)}</td>)}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Pay is the median of the salary ranges employers post. Early career is about 0 to 5 years, mid-career covers mid-level, senior and manager roles, late career senior manager to executive. A dash means too few postings show pay. Nursing, education, health professions and social work are not measured: their jobs are mostly posted on hospital, school-district and agency sites our job data does not cover, so a count would understate them.</p>
          </>
        ) : (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">The open-job figures for each field appear after the next monthly rankings build. The graduate counts below are current.</p>
        )}
      </section>

      <section aria-labelledby="majors" className="mt-12">
        <h2 id="majors" className={H2}>Every major, by program family</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Degrees at bachelor&apos;s level and above in {MAJOR_YEAR}, and the change since {MAJOR_BASE_YEAR}. Open a major for its job market and the colleges that award the most of its degrees.</p>
        <div className="mt-4 space-y-8">
          {families.map((f) => (
            <div key={f.fam} id={familyAnchor(f.fam)} className="scroll-mt-24">
              <h3 className="text-lg font-semibold text-navy">{f.name}</h3>
              <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {f.majors.map((m) => {
                  const ch = majorChange(m)
                  return (
                    <li key={m.cip}>
                      <TrackedLink href={majorPath(m)} event="majors_link_clicked" properties={{ ...track(majorPath(m)), cip: m.cip }} className={LINK}>{m.title}</TrackedLink>{' '}
                      <span className="text-muted-foreground tabular-nums">{n0(m.total)}{ch != null ? `, ${signed(ch)}` : ''}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="lists" className="mt-12">
        <h2 id="lists" className={H2}>Monthly rankings on degrees and majors</h2>
        <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {lists.map((l) => <li key={l.slug}><TrackedLink href={`/rankings/${l.slug}`} event="majors_link_clicked" properties={track(`/rankings/${l.slug}`)} className={LINK}>{l.title}</TrackedLink></li>)}
          <li><TrackedLink href="/rankings/topic/degrees" event="majors_link_clicked" properties={track('/rankings/topic/degrees')} className={LINK}>All degree rankings</TrackedLink></li>
          <li><TrackedLink href="/higher-education" event="majors_link_clicked" properties={track('/higher-education')} className={LINK}>Find a college</TrackedLink></li>
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">Sources: {MAJOR_SOURCE}; NextChapter job data, matched to standard occupation codes; Bureau of Labor Statistics typical entry-level education and employment projections. A major counts first majors only, so a double major is one degree.</p>
      </section>
    </SeoPage>
  )
}
