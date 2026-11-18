import { H2, LINK } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { editionLabel } from '@/lib/rankings/build-edition'
import { MAJORS_PATH, MAJOR_BASE_YEAR, MAJOR_YEAR, majorPath } from '@/lib/rankings/majors'
import type { CollegeMajorRow, CollegeMajorsView } from '@/lib/rankings/college-majors'

// A college page's majors: degrees here a year, the college's share of US graduates in each, and the national job market of the
// degree field each leads to (open jobs per 100 new graduates, early-career pay). Replaces the program-family table when the
// college awards degrees at bachelor's level and above.

const n0 = (n: number) => n.toLocaleString('en-US')
const usdK = (n: number) => `$${Math.round(n / 1000)}k`
const share = (x: number) => (x >= 0.001 ? `${(x * 100).toFixed(1)}%` : 'under 0.1%')
const signed = (x: number) => (Math.round(x) === 0 ? '0%' : `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`)
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const SHOWN = 10

function headline(name: string, view: CollegeMajorsView): string {
  const top = view.rows[0]
  let out = `${top.major.title} is the largest major at ${name}: ${n0(top.total)} degrees a year, ${share(top.shareOfUs)} of all US graduates in it.`
  const f = top.field
  if (f?.perHundred != null) {
    const vs = view.allFields != null ? `, ${f.perHundred >= view.allFields ? 'above' : 'below'} the ${view.allFields.toFixed(1)} across all fields` : ''
    out += ` Nationally, ${lc(f.field)} has ${f.perHundred.toFixed(1)} open jobs for every 100 new graduates${vs}.`
  } else if (f?.covered === false) {
    out += ` Our job data covers few ${lc(f.field)} jobs, which are mostly posted on hospital, school-district and agency sites, so we show no job figures for it.`
  } else if (!top.major.field) {
    out += ' Its graduates go into many kinds of work rather than one field.'
  }
  return out
}

function Row({ r, unitid }: { r: CollegeMajorRow; unitid: string }) {
  const href = majorPath(r.major)
  const f = r.field
  return (
    <tr className="border-b border-border last:border-0">
      <th scope="row" className="p-3 font-normal">
        <TrackedLink href={href} event="majors_link_clicked" properties={{ from: 'college_page', to: href, unitid, cip: r.major.cip }} className={LINK}>{r.major.title}</TrackedLink>
      </th>
      <td className="p-3 text-right tabular-nums">{n0(r.total)}</td>
      <td className="p-3 text-right tabular-nums">{share(r.shareOfUs)}</td>
      <td className="p-3">{r.major.field ?? <span className="text-muted-foreground">Many kinds of work</span>}</td>
      {f?.covered === false ? (
        <td colSpan={2} className="p-3 text-right text-muted-foreground">Not measured</td>
      ) : (
        <>
          <td className="p-3 text-right tabular-nums">{f?.perHundred != null ? f.perHundred.toFixed(1) : '–'}</td>
          <td className="p-3 text-right tabular-nums">{f?.stages.early.pay != null ? usdK(f.stages.early.pay) : '–'}</td>
        </>
      )}
      <td className="p-3 text-right tabular-nums">{r.usChange != null ? signed(r.usChange) : '–'}</td>
    </tr>
  )
}

function Table({ rows, unitid, caption }: { rows: CollegeMajorRow[]; unitid: string; caption: string }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="p-3">Major</th>
            <th scope="col" className="p-3 text-right">Degrees a year here</th>
            <th scope="col" className="p-3 text-right">Share of US graduates</th>
            <th scope="col" className="p-3">Field it leads to</th>
            <th scope="col" className="p-3 text-right">US open jobs per 100 graduates</th>
            <th scope="col" className="p-3 text-right">US early-career pay</th>
            <th scope="col" className="p-3 text-right">US graduates since {MAJOR_BASE_YEAR}</th>
          </tr>
        </thead>
        <tbody>{rows.map((r) => <Row key={r.major.cip} r={r} unitid={unitid} />)}</tbody>
      </table>
    </div>
  )
}

export function CollegeMajorsSection({ name, unitid, view }: { name: string; unitid: string; view: CollegeMajorsView }) {
  if (view.rows.length === 0) return null
  const first = view.rows.slice(0, SHOWN)
  const rest = view.rows.slice(SHOWN)
  return (
    <section aria-labelledby="programs" className="mt-12">
      <h2 id="programs" className={H2}>What students study, and the job market for it</h2>
      <p className="mt-2 max-w-3xl text-sm">{headline(name, view)}</p>
      <Table rows={first} unitid={unitid} caption={`Largest majors at ${name} with the national job market for each`} />
      {rest.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-navy">Show the other {rest.length} majors</summary>
          <Table rows={rest} unitid={unitid} caption={`Other majors at ${name}`} />
        </details>
      )}
      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        Degrees at bachelor&apos;s level and above in {MAJOR_YEAR}, first majors only (federal IPEDS completions). The field a major leads to is our judgment on its program code. Open jobs per 100 graduates and early-career pay are national figures for that field{view.edition ? `, ${editionLabel(view.edition)}` : ''}: professional roles on our board whose occupation typically needs a four-year degree, against a year of degrees in the majors that lead to it. They compare fields; they are not this college&apos;s placement rate. &ldquo;Not measured&rdquo; marks fields such as nursing and education whose jobs are mostly posted on hospital, school-district and agency sites our data does not cover, so a count would understate them. A dash means the major leads to many kinds of work, too few postings show pay, or the figure is not built yet.
      </p>
      <p className="mt-3 text-sm"><TrackedLink href={MAJORS_PATH} event="majors_link_clicked" properties={{ from: 'college_page', to: MAJORS_PATH, unitid }} className={LINK}>Compare every major and field</TrackedLink></p>
    </section>
  )
}
