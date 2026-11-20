// Academic Affairs insights (owner, 2026-11-18): what the college cannot see from its own records. Alumni at employers with
// layoffs or falling hiring, the skills employers ask for that its alumni do not show, the employers hiring near it, and the
// retraining its alumni need, matched to its own programs. Counts only: no alumnus is named on these screens.

import Link from 'next/link'
import { StatTile } from '@/components/higher-ed/StatTile'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { orgBasePath } from '@/lib/higher-ed/workspaces'
import { loadAlumniInsights, loadEmployersNearby } from '@/lib/higher-ed/academic-insights-data'
import { MIN_CELL, type HiringTrend } from '@/lib/higher-ed/academic-insights'
import { AI_EXPOSURE_SOURCE, BAND_LABEL } from '@/lib/skills/ai-exposure'
import { employerSlug } from '@/lib/seo/employer-slug'

type Props = { ctx: WorkspaceContext; base: string }

const n0 = (n: number) => n.toLocaleString('en-US')
const few = (n: number | null) => (n == null ? `fewer than ${MIN_CELL}` : n0(n))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pct0 = (x: number) => `${Math.round(x * 100)}%`
const usdK = (n: number | null) => (n == null ? '–' : `$${Math.round(n / 1000)}k`)
const signed = (x: number) => (Math.round(x) === 0 ? '0%' : `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`)
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const day = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : null)
const TH = 'p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground'

function Badge({ tone, children }: { tone: 'warm' | 'cool' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'warm' ? 'bg-amber-50 text-amber-900' : tone === 'cool' ? 'bg-emerald-50 text-emerald-800' : 'bg-muted text-muted-foreground'
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

const TREND: Record<HiringTrend, { label: string; tone: 'warm' | 'cool' | 'muted' }> = {
  growing: { label: 'Hiring up', tone: 'cool' },
  steady: { label: 'Steady', tone: 'muted' },
  cutting: { label: 'Hiring down', tone: 'warm' },
  unknown: { label: 'Too new to tell', tone: 'muted' },
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">{children}</p>
    </div>
  )
}

function Table({ caption, head, children, min = '48rem' }: { caption: string; head: React.ReactNode; children: React.ReactNode; min?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm" style={{ minWidth: min }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border"><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const ROW = 'border-b border-border last:border-0'

// ---- Alumni at risk --------------------------------------------------------------------------------------------------

export async function AcademicAtRisk({ ctx }: Props) {
  const { atRisk: a } = await loadAlumniInsights(ctx)
  if (a.sharing < MIN_CELL) {
    return <Empty title="Not enough alumni share where they work yet">This screen counts alumni by employer once at least {MIN_CELL} of them share where they work. It fills in as alumni join and update their profiles.</Empty>
  }
  const layoffInbox = ctx.workspaces.includes('alumni') ? `${orgBasePath(ctx.institution.slug, ctx.institution.orgType)}/alumni/layoffs` : null
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="max-w-3xl text-lg font-medium">
          {a.atRisk > 0
            ? `${cap(few(a.atRisk >= MIN_CELL ? a.atRisk : null))} of your ${n0(a.sharing)} alumni who share where they work are at employers that filed layoffs in the last year or cut open roles by a fifth or more in four weeks.`
            : `None of your ${n0(a.sharing)} alumni who share where they work is at an employer with a layoff filing or falling hiring right now.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Alumni sharing where they work" value={n0(a.sharing)} />
          <StatTile label="At employers with layoffs or falling hiring" value={few(a.atRisk >= MIN_CELL ? a.atRisk : null)} />
          <StatTile label="Employers flagged" value={n0(a.employers.length)} />
          <StatTile label="At employers hiring more" value={n0(a.growing.reduce((s, g) => s + g.alumni, 0))} note="Hiring up a fifth or more in four weeks" />
        </div>
        {a.sample && <p className="text-xs text-muted-foreground">Includes sample layoff matches on this demo.</p>}
      </section>

      {a.employers.length > 0 && (
        <section aria-labelledby="risk-h" className="space-y-3">
          <h2 id="risk-h" className="text-base font-semibold">Employers putting your alumni at risk</h2>
          <Table caption="Employers where alumni work that filed layoffs or are cutting hiring" head={<>
            <th scope="col" className={TH}>Employer</th><th scope="col" className={`${TH} text-right`}>Your alumni there</th><th scope="col" className={TH}>Why</th><th scope="col" className={TH}>Their most common roles</th>
          </>}>
            {a.employers.slice(0, 25).map((e) => (
              <tr key={e.key} className={ROW}>
                <th scope="row" className="p-3 font-normal">{e.employer}</th>
                <td className="p-3 text-right tabular-nums">{few(e.alumni)}</td>
                <td className="space-y-1 p-3">
                  {e.layoff && e.layoff.filings != null && <div><Badge tone="warm">{e.layoff.filings === 1 ? 'Layoff filed' : `${n0(e.layoff.filings)} layoff filings`}</Badge> <span className="text-muted-foreground">{[e.layoff.filings > 1 ? 'in 12 months' : null, e.layoff.employees ? `${n0(e.layoff.employees)} jobs${e.layoff.filings > 1 ? ' in all' : ''}` : null, e.layoff.noticeDate ? `${e.layoff.filings > 1 ? 'latest ' : ''}${day(e.layoff.noticeDate)}` : null].filter(Boolean).join(' · ')}</span></div>}
                  {e.layoff && e.layoff.filings == null && <div><Badge tone="warm">Layoff filed</Badge> <span className="text-muted-foreground">{[day(e.layoff.noticeDate), e.layoff.employees ? `${n0(e.layoff.employees)} jobs` : null, e.layoff.where].filter(Boolean).join(' · ')}</span></div>}
                  {e.reasons.includes('cutting') && e.change != null && <div><Badge tone="warm">Hiring down</Badge> <span className="text-muted-foreground">{signed(e.change)} open roles in four weeks</span></div>}
                </td>
                <td className="p-3">{e.roles.length ? e.roles.map((r) => `${r.title} (${r.n})`).join(', ') : <span className="text-muted-foreground">Fewer than {MIN_CELL} share any one role</span>}</td>
              </tr>
            ))}
          </Table>
          {layoffInbox && <p className="text-sm"><Link href={layoffInbox} className="underline underline-offset-2 hover:text-primary">Reach the alumni at employers with layoffs from Alumni Relations › Layoff alerts</Link></p>}
        </section>
      )}

      {a.growing.length > 0 && (
        <section aria-labelledby="grow-h" className="space-y-3">
          <h2 id="grow-h" className="text-base font-semibold">Where your alumni&apos;s employers are hiring more</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">{a.growing.map((g) => <li key={g.employer}>{g.employer}: <span className="text-muted-foreground">{n0(g.alumni)} alumni, open roles {signed(g.change)} in four weeks</span></li>)}</ul>
        </section>
      )}

      <p className="max-w-3xl text-xs text-muted-foreground">Alumni who share where they work (their consent); groups under {MIN_CELL} are not shown. Layoffs: state WARN filings and announced layoffs matched to alumni employers in the last year. Hiring: the employer&apos;s open roles across the US on NextChapter&apos;s job board, this week against four weeks ago.</p>
    </div>
  )
}

// ---- Skills gaps -------------------------------------------------------------------------------------------------------

export async function AcademicSkills({ ctx }: Props) {
  const { gaps, skillsAsOf } = await loadAlumniInsights(ctx)
  if (gaps.length === 0) {
    return <Empty title="Not enough alumni skills on record yet">Skills gaps compare what employers ask for with what your alumni&apos;s résumés show, for each kind of work where at least {MIN_CELL} alumni share their profile. It fills in as alumni join.</Empty>
  }
  const biggest = gaps.flatMap((g) => g.gaps.map((s) => ({ ...s, fn: g.fn }))).filter((s) => s.alumni != null).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0]
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        {biggest && (
          <p className="max-w-3xl text-lg font-medium">
            {biggest.skill} is asked for in {pct0(biggest.demand)} of {biggest.fn.toLowerCase()} job postings but shows on {pct0(biggest.alumni ?? 0)} of your {biggest.fn.toLowerCase()} alumni&apos;s résumés.
          </p>
        )}
        <p className="text-sm text-muted-foreground">For the kinds of work most of your alumni do: the skills employers ask for most, against the share of those alumni whose résumé shows each. Biggest gaps first.</p>
      </section>
      {gaps.map((g) => (
        <section key={g.fn} aria-labelledby={`fn-${g.fn}`} className="space-y-3">
          <h2 id={`fn-${g.fn}`} className="text-base font-semibold">{g.fn} <span className="font-normal text-muted-foreground">· {n0(g.alumni)} alumni, {n0(g.postings)} open postings</span></h2>
          <Table caption={`Skills asked for in ${g.fn} against ${g.fn} alumni`} min="40rem" head={<>
            <th scope="col" className={TH}>Skill</th><th scope="col" className={`${TH} text-right`}>Postings asking for it</th><th scope="col" className={`${TH} text-right`}>Your alumni with it</th><th scope="col" className={`${TH} text-right`}>Gap</th><th scope="col" className={TH}>Signal</th>
          </>}>
            {g.gaps.map((s) => (
              <tr key={s.slug} className={ROW}>
                <th scope="row" className="p-3 font-normal">{s.skill}</th>
                <td className="p-3 text-right tabular-nums">{pct0(s.demand)}</td>
                <td className="p-3 text-right tabular-nums">{s.alumni == null ? '–' : pct0(s.alumni)}</td>
                <td className="p-3 text-right font-medium tabular-nums">{s.gap == null ? '–' : `${Math.round(s.gap * 100)} pts`}</td>
                <td className="space-x-1 p-3">{s.rising && <Badge tone="cool">Rising</Badge>}{s.ai && <Badge tone="muted">Often asked with AI skills</Badge>}</td>
              </tr>
            ))}
          </Table>
        </section>
      ))}
      <p className="max-w-3xl text-xs text-muted-foreground">Postings: skills named in open professional roles on NextChapter&apos;s job board in each kind of work{skillsAsOf ? ` (snapshot of ${day(skillsAsOf.slice(0, 10))})` : ''}. Rising: asked for more in the last 30 days than across all open roles. Alumni: skills on the résumés of alumni who share their profile (their consent); a group under {MIN_CELL} is not shown. A résumé that leaves a skill out does not mean the person lacks it.</p>
    </div>
  )
}

// ---- Employers hiring nearby -------------------------------------------------------------------------------------------

export async function AcademicEmployers({ ctx }: Props) {
  const near = await loadEmployersNearby(ctx)
  if (!near) return <Empty title="No region set for your college">Employers hiring nearby uses the counties on your college profile. Ask us at support@launchyournextchapter.com to set them, and this screen fills in.</Empty>
  if (near.employers.length === 0) return <Empty title={`No open professional roles found in ${near.region.label}`}>We found no open professional roles in your counties on our job board right now. It refreshes every six hours.</Empty>
  const top = near.employers[0]
  // Pay is shown only when some employer here posts enough of it; an all-dash column says nothing.
  const showPay = near.employers.some((e) => e.paid >= 5 && e.payMed != null)
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="max-w-3xl text-lg font-medium">
          {top.inYourFields > 0
            ? `${top.name} has the most open roles in the fields your graduates go into in ${near.region.label}: ${n0(top.inYourFields)}${top.entry ? `, ${n0(top.entry)} of its roles at entry or early-career level` : ''}.`
            : `${top.name} has the most open professional roles in ${near.region.label}: ${n0(top.open)}.`}
        </p>
        <p className="text-sm text-muted-foreground">Employers with the most open professional roles in {near.region.label}, ranked by roles in the fields your majors lead to. Internship, hiring and partnership leads.</p>
      </section>
      <section aria-labelledby="emp-h" className="space-y-3">
        <h2 id="emp-h" className="text-base font-semibold">Employers hiring near you</h2>
        <Table caption={`Employers hiring in ${near.region.label}`} min="60rem" head={<>
          <th scope="col" className={TH}>Employer</th><th scope="col" className={`${TH} text-right`}>Open roles</th><th scope="col" className={`${TH} text-right`}>In your fields</th><th scope="col" className={TH}>Most in</th>
          <th scope="col" className={`${TH} text-right`}>Entry and early career</th>{showPay && <th scope="col" className={`${TH} text-right`}>Median posted pay</th>}<th scope="col" className={TH}>Hiring, four weeks</th><th scope="col" className={TH}>Layoffs, 12 months</th>
        </>}>
          {near.employers.map((e) => (
            <tr key={`${e.companyId ?? e.name}`} className={ROW}>
              <th scope="row" className="p-3 font-normal">{e.cn && e.companyId ? <Link href={`/employers/${employerSlug(e.cn, e.companyId)}`} className="underline underline-offset-2 hover:text-primary">{e.name}</Link> : e.name}</th>
              <td className="p-3 text-right tabular-nums">{n0(e.open)}</td>
              <td className="p-3 text-right font-medium tabular-nums">{n0(e.inYourFields)}</td>
              <td className="p-3">{e.topField ?? <span className="text-muted-foreground">–</span>}</td>
              <td className="p-3 text-right tabular-nums">{n0(e.entry)}</td>
              {showPay && <td className="p-3 text-right tabular-nums">{e.paid >= 5 ? usdK(e.payMed) : '–'}</td>}
              <td className="p-3"><Badge tone={TREND[e.trend].tone}>{TREND[e.trend].label}</Badge>{e.change != null && <span className="ml-1 text-xs text-muted-foreground">{signed(e.change)}</span>}</td>
              <td className="p-3">{e.warn12mo > 0 ? <span>{n0(e.warn12mo)} filed{e.lastWarnAt ? `, latest ${day(e.lastWarnAt)}` : ''}</span> : <span className="text-muted-foreground">None</span>}</td>
            </tr>
          ))}
        </Table>
      </section>
      <p className="max-w-3xl text-xs text-muted-foreground">Open professional roles on NextChapter&apos;s job board located in your counties, refreshed every six hours. In your fields: roles in occupations that typically need a four-year degree in a field your majors lead to. {showPay ? 'Pay: the median of posted ranges, shown from 5 postings with pay. ' : 'Pay is left out: too few employers here post pay ranges. '}Hiring: the employer&apos;s open roles across the US this week against four weeks ago. Layoffs: state WARN filings and announced layoffs.</p>
    </div>
  )
}

// ---- Retraining demand -------------------------------------------------------------------------------------------------

export async function AcademicRetraining({ ctx }: Props) {
  const { retraining: r } = await loadAlumniInsights(ctx)
  if (r.matched < MIN_CELL) {
    return <Empty title="Not enough alumni roles on record yet">Retraining demand reads the roles of alumni who share where they work. It fills in once at least {MIN_CELL} of them do.</Empty>
  }
  const high = r.groups.find((g) => g.band === 'high')
  const unmet = r.skills.filter((s) => s.offerings.length === 0)
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="max-w-3xl text-lg font-medium">
          {cap(few(r.inNeed))} of your alumni are in roles with high AI exposure or at employers with layoffs or falling hiring.{unmet.length > 0 ? ` ${unmet.length} of the ${r.skills.length} skills that would move them have no program at your college yet.` : ''}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {r.groups.map((g) => (
            <StatTile key={g.band} label={`${BAND_LABEL[g.band]} AI exposure`} value={few(g.alumni)} note={g.occupations.length ? g.occupations.map((o) => o.title).join(', ') : undefined} />
          ))}
        </div>
      </section>
      {r.skills.length > 0 && (
        <section aria-labelledby="re-h" className="space-y-3">
          <h2 id="re-h" className="text-base font-semibold">Skills to retrain for, and who teaches them</h2>
          <Table caption="Skills alumni need and the college's programs that teach them" min="40rem" head={<>
            <th scope="col" className={TH}>Skill</th><th scope="col" className={TH}>Asked for in</th><th scope="col" className={`${TH} text-right`}>Alumni in that work without it</th><th scope="col" className={TH}>Your programs that teach it</th>
          </>}>
            {r.skills.map((s) => (
              <tr key={s.slug} className={ROW}>
                <th scope="row" className="p-3 font-normal">{s.skill}</th>
                <td className="p-3">{s.fn}</td>
                <td className="p-3 text-right tabular-nums">{few(s.without)}</td>
                <td className="p-3">{s.offerings.length ? s.offerings.map((o, i) => <span key={o.href}>{i > 0 && ', '}<Link href={o.href} className="underline underline-offset-2 hover:text-primary">{o.name}</Link></span>) : <Badge tone="warm">No program yet</Badge>}</td>
              </tr>
            ))}
          </Table>
          {unmet.length > 0 && <p className="text-sm text-muted-foreground">&ldquo;No program yet&rdquo; is a course or certificate your college could build for its own alumni.</p>}
        </section>
      )}
      {high && high.alumni == null && <p className="text-sm text-muted-foreground">Fewer than {MIN_CELL} alumni hold roles with high AI exposure.</p>}
      <p className="max-w-3xl text-xs text-muted-foreground">
        Roles: the job titles of alumni who share where they work (their consent), matched to occupations; {n0(r.unmatched)} titles could not be matched. AI exposure: observed use of AI in each occupation, from the <a href={AI_EXPOSURE_SOURCE.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">{AI_EXPOSURE_SOURCE.name}</a>, {AI_EXPOSURE_SOURCE.released}. Skills: the largest gaps from the Skills gaps tab, rising and AI-related skills first. Programs: the skills your programs and courses list. Groups under {MIN_CELL} are not shown.
      </p>
    </div>
  )
}
