import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { SeoPage, H2, LINK, Stat } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { collegePath } from '@/lib/seo/college-bar'
import { areaSlug, getStateCollegeListings } from '@/lib/seo/college-pages'
import { FIELD_LIST_SLUGS, STAGE_LABEL, type DegreeFieldFigure } from '@/lib/rankings/degrees-specs'
import { MAJORS, MAJORS_PATH, MAJOR_BASE_YEAR, MAJOR_FAMILIES, MAJOR_SOURCE, MAJOR_YEAR, familyAnchor, fieldMajorsPath, majorBySlug, majorChange, majorPath, type Major } from '@/lib/rankings/majors'
import { getDegreeFields } from '@/lib/rankings/store'
import { editionLabel } from '@/lib/rankings/build-edition'

// One page per college major: degrees awarded (federal IPEDS completions), the job market of the degree field it leads to
// (the monthly rankings build's stored row), and the colleges that award the most of its degrees. No scan on a page view.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const n0 = (n: number) => n.toLocaleString('en-US')
const usd = (n: number) => `$${n0(Math.round(n / 1000) * 1000)}`
/** Lower-cases a field's first letter only, so "Computer science and IT" keeps IT. */
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}%`

function lede(m: Major, f: DegreeFieldFigure | null): string {
  const ch = majorChange(m)
  const bits = [`US colleges awarded ${n0(m.total)} degrees in ${m.title} at bachelor's level and above in ${MAJOR_YEAR}, at ${n0(m.schools)} colleges`]
  if (ch != null) bits.push(`${ch >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(ch))}% since ${MAJOR_BASE_YEAR}`)
  let out = `${bits.join(', ')}.`
  if (f?.perHundred != null) out += ` Its graduates usually go into ${lc(f.field)}, which has ${f.perHundred.toFixed(1)} open jobs for every 100 new graduates${f.stages.early.pay ? ` and a median posted early-career pay of ${usd(f.stages.early.pay)}` : ''}.`
  else if (!m.field) out += ' Its graduates go into many kinds of work rather than one field.'
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ major: string }> }): Promise<Metadata> {
  const { major } = await params
  const m = majorBySlug(major)
  if (!m) return {}
  const figures = await getDegreeFields()
  const f = m.field ? figures?.fields.find((x) => x.field === m.field) ?? null : null
  return { title: `${m.title} major: graduates, jobs and pay`, description: lede(m, f).slice(0, 165), ...canonical(majorPath(m)) }
}

/** The colleges awarding the most of a major's degrees, linked to their pages where we have one. */
async function topColleges(m: Major) {
  const states = [...new Set(m.top.map((t) => t.state))]
  const lists = await Promise.all(states.map((s) => getStateCollegeListings(s).catch(() => [])))
  const byId = new Map(lists.flat().map((c) => [c.unitid, c]))
  return m.top.map((t) => {
    const c = byId.get(t.unitid)
    return { ...t, href: c ? collegePath(areaSlug(t.state), c.slug) : null }
  })
}

export default async function MajorPage({ params }: { params: Promise<{ major: string }> }) {
  const { major } = await params
  const m = majorBySlug(major)
  // An unknown major goes to the majors list, the nearest real page.
  if (!m) permanentRedirect(MAJORS_PATH)
  const [figures, colleges] = await Promise.all([getDegreeFields(), topColleges(m)])
  const f = m.field ? figures?.fields.find((x) => x.field === m.field) ?? null : null
  const ch = majorChange(m)
  const path = majorPath(m)
  const related = MAJORS.filter((x) => x.cip !== m.cip && (m.field ? x.field === m.field : x.fam === m.fam)).sort((a, b) => b.total - a.total).slice(0, 10)
  const track = (to: string) => ({ from: 'major_page', cip: m.cip, to })
  const L = ({ href, children }: { href: string; children: React.ReactNode }) => <TrackedLink href={href} event="majors_link_clicked" properties={track(href)} className={LINK}>{children}</TrackedLink>

  const faq: { q: string; a: string }[] = [
    { q: `How many people graduate in ${m.title} each year?`, a: `${n0(m.total)} degrees at bachelor's level and above in ${MAJOR_YEAR}: ${n0(m.bach)} bachelor's, ${n0(m.master)} master's and ${n0(m.doctoral)} doctoral, from the federal IPEDS Completions survey.` },
    { q: `How many colleges offer ${m.title}?`, a: `${n0(m.schools)} colleges awarded at least one degree in it at bachelor's level and above in ${MAJOR_YEAR}.${colleges[0] ? ` ${colleges[0].name} awarded the most.` : ''}` },
  ]
  if (f?.perHundred != null) faq.push({ q: `Are there jobs for ${m.title} graduates?`, a: `Its graduates usually go into ${lc(f.field)}, which had ${n0(f.open)} open professional jobs on our board in ${editionLabel(figures!.edition)}: ${f.perHundred.toFixed(1)} for every 100 degrees awarded a year in the majors that lead to it.` })
  if (f && (f.stages.early.pay || f.stages.late.pay)) faq.push({ q: `What do ${m.title} jobs pay?`, a: `In ${lc(f.field)}, the median posted pay is ${[f.stages.early.pay ? `${usd(f.stages.early.pay)} early in a career` : '', f.stages.mid.pay ? `${usd(f.stages.mid.pay)} mid-career` : '', f.stages.late.pay ? `${usd(f.stages.late.pay)} late in a career` : ''].filter(Boolean).join(', ')}.` })

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: `${m.title} major: graduates, jobs and pay`, url: `${SITE_URL}${path}`, about: { '@type': 'DefinedTerm', name: m.title, termCode: m.cip, inDefinedTermSet: 'Classification of Instructional Programs (CIP 2020)' } },
    ...(colleges.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: `Colleges awarding the most ${m.title} degrees`, itemListElement: colleges.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, ...(c.href ? { url: `${SITE_URL}${c.href}` } : {}) })) }] : []),
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
  ]

  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Higher education', path: '/higher-education' }, { name: 'College majors', path: MAJORS_PATH }, { name: m.title, path }]}
      h1={`${m.title}: graduates, jobs and pay`}
      jsonLd={ld}
      lede={lede(m, f)}
    >
      <section aria-labelledby="supply" className="mt-10">
        <h2 id="supply" className={H2}>Graduates</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={n0(m.total)} label={`degrees a year, ${MAJOR_YEAR}`} note={`${n0(m.bach)} bachelor's, ${n0(m.master)} master's, ${n0(m.doctoral)} doctoral`} />
          <Stat value={n0(m.schools)} label="colleges award it" />
          {ch != null && <Stat value={signed(ch)} label={`change since ${MAJOR_BASE_YEAR}`} />}
          {m.assoc > 0 && <Stat value={n0(m.assoc)} label="associate degrees a year" note="Not counted above" />}
        </ul>
        <p className="mt-3 text-sm"><L href={`/rankings/${FIELD_LIST_SLUGS.majors}`}>Majors with the most graduates</L> · <L href={`/rankings/${FIELD_LIST_SLUGS.schools}`}>offered at the most colleges</L> · <L href={`/rankings/${FIELD_LIST_SLUGS.majorGrow}`}>growing fastest</L></p>
      </section>

      <section aria-labelledby="market" className="mt-12">
        <h2 id="market" className={H2}>{m.field ? `The job market for ${lc(m.field)}` : 'Where its graduates work'}</h2>
        {!m.field && <p className="mt-2 max-w-3xl text-sm">{m.title} graduates go into many kinds of work rather than one field, so we do not match it to one set of jobs. <L href={`${MAJORS_PATH}#fields`}>Compare the degree fields</L> to see where open jobs outnumber graduates.</p>}
        {m.field && !f && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Open jobs and pay for {lc(m.field)} appear after the next monthly rankings build.</p>}
        {f && f.covered === false && (
          <>
            <p className="mt-2 max-w-3xl text-sm">Our job data covers few {lc(f.field)} jobs: they are mostly posted on hospital, school-district and agency sites we do not track, so an open-job count or pay figure from it would understate the market. We do not show one.</p>
            {f.growth != null && <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat value={signed(f.growth)} label="projected job growth to 2035" note="Bureau of Labor Statistics" /></ul>}
          </>
        )}
        {f && f.covered !== false && (
          <>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{m.title} graduates usually go into {lc(f.field)}. Open professional roles on our board whose occupation typically needs a four-year degree, {editionLabel(figures!.edition)}.</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value={n0(f.open)} label="open jobs" />
              {f.perHundred != null && <Stat value={f.perHundred.toFixed(1)} label="open jobs per 100 graduates" note={`${n0(f.grads)} degrees a year lead to this field`} />}
              {f.pay != null && <Stat value={usd(f.pay)} label="median posted pay" />}
              {f.growth != null && <Stat value={signed(f.growth)} label="projected job growth to 2035" note="Bureau of Labor Statistics" />}
            </ul>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[26rem] text-left text-sm">
                <caption className="sr-only">Open jobs and median posted pay by career stage in {f.field}</caption>
                <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                  <tr><th scope="col" className="p-3">Career stage</th><th scope="col" className="p-3 text-right">Open jobs</th><th scope="col" className="p-3 text-right">Median posted pay</th></tr>
                </thead>
                <tbody>
                  {(['early', 'mid', 'late'] as const).map((s) => (
                    <tr key={s} className="border-b border-border last:border-0">
                      <th scope="row" className="p-3 font-medium text-navy">{STAGE_LABEL[s].name} <span className="font-normal text-muted-foreground">({STAGE_LABEL[s].years})</span></th>
                      <td className="p-3 text-right tabular-nums">{n0(f.stages[s].open)}</td>
                      <td className="p-3 text-right tabular-nums">{f.stages[s].pay != null ? usd(f.stages[s].pay!) : 'Too few postings show pay'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm"><L href={fieldMajorsPath(f.field)}>Compare {lc(f.field)} with other fields</L> · <L href={`/rankings/${FIELD_LIST_SLUGS.ratio}`}>open jobs per graduate</L> · <L href={`/rankings/${FIELD_LIST_SLUGS.earlyPay}`}>early-career pay</L> · <L href={`/rankings/${FIELD_LIST_SLUGS.latePay}`}>late-career pay</L></p>
          </>
        )}
      </section>

      {colleges.length > 0 && (
        <section aria-labelledby="colleges" className="mt-12">
          <h2 id="colleges" className={H2}>Colleges awarding the most {m.title} degrees</h2>
          <ol className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {colleges.map((c, i) => (
              <li key={c.unitid} className="flex gap-2">
                <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{i + 1}.</span>
                <span>{c.href ? <L href={c.href}>{c.name}</L> : c.name} <span className="text-muted-foreground">{c.state}, {n0(c.n)} degrees</span></span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-12">
          <h2 id="related" className={H2}>{m.field ? `Other majors that lead to ${lc(m.field)}` : `Other majors in ${MAJOR_FAMILIES[m.fam] ?? 'this family'}`}</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {related.map((x) => <li key={x.cip}><L href={majorPath(x)}>{x.title}</L> <span className="text-muted-foreground tabular-nums">{n0(x.total)} degrees</span></li>)}
            <li><L href={`${MAJORS_PATH}#${familyAnchor(m.fam)}`}>All majors in {MAJOR_FAMILIES[m.fam] ?? 'this family'}</L></li>
          </ul>
        </section>
      )}

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Questions</h2>
        <dl className="mt-3 max-w-3xl space-y-4 text-sm">{faq.map((x) => <div key={x.q}><dt className="font-semibold text-navy">{x.q}</dt><dd className="mt-1">{x.a}</dd></div>)}</dl>
        <p className="mt-6 text-xs text-muted-foreground">Sources: {MAJOR_SOURCE} (program code {m.cip}); NextChapter job data, matched to standard occupation codes, with each posting&apos;s seniority level; Bureau of Labor Statistics typical entry-level education and employment projections. The field a major leads to is our own judgment on its program code.</p>
      </section>
    </SeoPage>
  )
}
