// Academic Affairs (Institution tier): the college's programs against the job market, its state, and its peers. Public
// federal data and NextChapter's job data only: no member data on these screens.

import { cache } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { StatTile } from '@/components/higher-ed/StatTile'
import { AcademicExportLink } from '@/components/higher-ed/AcademicExportLink'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { loadIndex, loadProgramsMarket, type ProgramsMarketResult } from '@/lib/higher-ed/programs-market-data'
import { AddPeerForm, RemovePeerButton, ResetPeersButton } from '@/components/higher-ed/AcademicPeerControls'
import type { FieldStanding, ProgramsMarket } from '@/lib/higher-ed/programs-market'
import { STAGE_LABEL } from '@/lib/rankings/degrees-specs'
import { editionLabel } from '@/lib/rankings/build-edition'
import { MAJOR_BASE_YEAR, MAJOR_YEAR, majorPath } from '@/lib/rankings/majors'
import { blockedExport, lockedReason } from '@/lib/plans/entitlements'
import { stateName } from '@/lib/seo/states'

type Props = { ctx: WorkspaceContext; base: string }

const n0 = (n: number) => n.toLocaleString('en-US')
const pct0 = (x: number) => `${Math.round(x * 100)}%`
const usdK = (n: number | null | undefined) => (n == null ? '–' : `$${Math.round(n / 1000)}k`)
const signed = (x: number | null) => (x == null ? '–' : Math.round(x) === 0 ? '0%' : `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`)
const per = (x: number | null | undefined) => (x == null ? '–' : x.toFixed(1))
const TH = 'p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground'
const STANDING: Record<FieldStanding, { label: string; cls: string }> = {
  above: { label: 'Above average', cls: 'bg-emerald-50 text-emerald-800' },
  below: { label: 'Below average', cls: 'bg-amber-50 text-amber-900' },
  unmeasured: { label: 'Not measured', cls: 'bg-muted text-muted-foreground' },
  many: { label: 'Many kinds of work', cls: 'bg-muted text-muted-foreground' },
}

function Standing({ s }: { s: FieldStanding }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STANDING[s].cls}`}>{STANDING[s].label}</span>
}

function Unavailable({ result }: { result: Extract<ProgramsMarketResult, { ok: false }> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-sm">
      <h2 className="text-base font-semibold">{result.reason === 'no-college' ? 'We could not match this workspace to a college' : 'No four-year degrees on record'}</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {result.reason === 'no-college'
          ? 'Programs vs. market reads the federal record for your college. Ask us at support@launchyournextchapter.com to link this workspace to your college, and the screen fills in.'
          : 'Programs vs. market covers degrees at bachelor’s level and above, from the federal IPEDS completions survey. Your college reported none for 2023-24.'}
      </p>
    </div>
  )
}

function Sources({ d }: { d: ProgramsMarket }) {
  return (
    <p className="max-w-3xl text-xs text-muted-foreground">
      Degrees: federal IPEDS completions, {MAJOR_YEAR} against {MAJOR_BASE_YEAR}, first majors at bachelor&apos;s level and above. Open jobs and pay: professional roles on NextChapter&apos;s job board whose occupation typically needs a four-year degree{d.edition ? `, ${editionLabel(d.edition)}` : ''}, by the field a major usually leads to. Fields such as nursing and education are not measured: their jobs are mostly posted on hospital, school-district and agency sites our data does not cover. Figures compare fields; they are not your graduates&apos; placement rate.
    </p>
  )
}

// The institution's stored profile holds the college's IPEDS id (one row by primary key); the rest is static files and stored rows.
const load = cache(async (institutionId: string) => {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { name: true, profile: true } })
  return loadProgramsMarket(inst)
})
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Programs vs. market: every major, its trend here, and the national job market of the field it leads to. */
export async function AcademicPrograms({ ctx }: Props) {
  const result = await load(ctx.institution.id)
  if (!result.ok) return <Unavailable result={result} />
  return <ProgramsView d={result.data} slug={ctx.institution.slug} plan={ctx.institution.plan} />
}

export function ProgramsView({ d, slug, plan }: { d: ProgramsMarket; slug: string; plan: string }) {
  const blocked = blockedExport('programs', plan)
  const measured = d.mix.above + d.mix.below
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="max-w-3xl text-lg font-medium">
          {d.aboveShare != null
            ? `${pct0(d.aboveShare)} of ${d.name}’s graduates in measured fields are in fields with more open jobs per new graduate than average.`
            : `${d.name} awards ${n0(d.total)} degrees a year at bachelor’s level and above. Job figures appear after the next monthly build.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={`Degrees a year, ${MAJOR_YEAR}`} value={n0(d.total)} note={`${signed(d.change)} since ${MAJOR_BASE_YEAR}`} />
          <StatTile label="In above-average fields" value={n0(d.mix.above)} note={measured ? `${pct0(d.mix.above / measured)} of measured` : undefined} />
          <StatTile label="In below-average fields" value={n0(d.mix.below)} note={d.allFieldsPerHundred != null ? `Average: ${per(d.allFieldsPerHundred)} open jobs per 100 graduates` : undefined} />
          <StatTile label="Not measured or many kinds of work" value={n0(d.mix.unmeasured + d.mix.many)} note="Nursing, education, the arts, humanities and the like" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {blocked ? <p className="text-sm text-muted-foreground">{lockedReason(blocked)}</p> : <AcademicExportLink slug={slug} majors={d.rows.length} />}
        </div>
      </section>

      <section aria-labelledby="majors-h" className="space-y-3">
        <h2 id="majors-h" className="text-base font-semibold">Every major</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <caption className="sr-only">Majors at {d.name} with the national job market of the field each leads to</caption>
            <thead className="border-b border-border">
              <tr>
                <th scope="col" className={TH}>Major</th>
                <th scope="col" className={`${TH} text-right`}>Degrees a year</th>
                <th scope="col" className={`${TH} text-right`}>Here since {MAJOR_BASE_YEAR}</th>
                <th scope="col" className={`${TH} text-right`}>Share of US graduates</th>
                <th scope="col" className={TH}>Field and standing</th>
                <th scope="col" className={`${TH} text-right`}>US open jobs per 100 graduates</th>
                {(['early', 'mid', 'late'] as const).map((s) => <th key={s} scope="col" className={`${TH} text-right`}>{STAGE_LABEL[s].name} pay</th>)}
                {d.previousEdition && <th scope="col" className={`${TH} text-right`}>US open jobs since {editionLabel(d.previousEdition)}</th>}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.major.cip} className="border-b border-border last:border-0">
                  <th scope="row" className="p-3 font-normal"><Link href={majorPath(r.major)} className="underline underline-offset-2 hover:text-primary">{r.major.title}</Link></th>
                  <td className="p-3 text-right tabular-nums">{n0(r.total)}</td>
                  <td className="p-3 text-right tabular-nums">{signed(r.hereChange)}</td>
                  <td className="p-3 text-right tabular-nums">{r.shareOfUs >= 0.001 ? `${(r.shareOfUs * 100).toFixed(1)}%` : '<0.1%'}</td>
                  <td className="p-3"><span className="mr-2">{r.major.field ?? ''}</span><Standing s={r.standing} /></td>
                  <td className="p-3 text-right tabular-nums">{per(r.field?.perHundred)}</td>
                  {(['early', 'mid', 'late'] as const).map((s) => <td key={s} className="p-3 text-right tabular-nums">{usdK(r.field?.stages[s].pay)}</td>)}
                  {d.previousEdition && <td className="p-3 text-right tabular-nums">{signed(r.usOpenChange)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Up to 40 majors, most degrees first. Early career is about 0 to 5 years, mid-career covers mid-level, senior and manager roles, late career senior manager to executive. A dash means too few postings or degrees to read.</p>
      </section>
      <Sources d={d} />
    </div>
  )
}

/** Your state: the college's degrees by field against every college in its state and the state's open jobs. */
export async function AcademicState({ ctx }: Props) {
  const result = await load(ctx.institution.id)
  if (!result.ok) return <Unavailable result={result} />
  return <StateView d={result.data} />
}

export function StateView({ d }: { d: ProgramsMarket }) {
  const st = stateName(d.state) || d.state
  const ranked = d.stateFields.filter((f) => f.statePerHundred != null).sort((a, b) => (b.statePerHundred ?? 0) - (a.statePerHundred ?? 0))
  const top = ranked[0]
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="max-w-3xl text-lg font-medium">
          {top
            ? `In ${st}, ${lc(top.field)} has the most open jobs per new graduate: ${per(top.statePerHundred)} for every 100 degrees a year${d.stateAllPerHundred != null ? `, against ${per(d.stateAllPerHundred)} across measured fields` : ''}.`
            : `Open jobs by field in ${st} appear after the next monthly build. The graduate counts below are current.`}
        </p>
      </section>
      <section aria-labelledby="state-h" className="space-y-3">
        <h2 id="state-h" className="text-base font-semibold">Degree fields in {st}</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Degree fields in {st}: graduates, open jobs and pay</caption>
            <thead className="border-b border-border">
              <tr>
                <th scope="col" className={TH}>Field</th>
                <th scope="col" className={`${TH} text-right`}>Your degrees a year</th>
                <th scope="col" className={`${TH} text-right`}>All {d.state} colleges</th>
                <th scope="col" className={`${TH} text-right`}>Your share</th>
                <th scope="col" className={`${TH} text-right`}>Open jobs in {d.state}</th>
                <th scope="col" className={`${TH} text-right`}>{d.state} jobs per 100 graduates</th>
                <th scope="col" className={TH}>Against the {d.state} average</th>
                <th scope="col" className={`${TH} text-right`}>{d.state} median pay</th>
              </tr>
            </thead>
            <tbody>
              {d.stateFields.map((f) => (
                <tr key={f.field} className="border-b border-border last:border-0">
                  <th scope="row" className="p-3 font-normal">{f.field}</th>
                  <td className="p-3 text-right tabular-nums">{n0(f.here)}</td>
                  <td className="p-3 text-right tabular-nums">{n0(f.stateGrads)}</td>
                  <td className="p-3 text-right tabular-nums">{pct0(f.shareOfState)}</td>
                  {f.covered ? (
                    <>
                      <td className="p-3 text-right tabular-nums">{f.stateOpen == null ? '–' : n0(f.stateOpen)}</td>
                      <td className="p-3 text-right font-medium tabular-nums">{per(f.statePerHundred)}</td>
                      <td className="p-3">{f.statePerHundred != null && d.stateAllPerHundred != null ? <Standing s={f.statePerHundred >= d.stateAllPerHundred ? 'above' : 'below'} /> : <span className="text-muted-foreground">–</span>}</td>
                      <td className="p-3 text-right tabular-nums">{usdK(f.statePay)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="p-3 text-right text-muted-foreground">Not measured</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Graduates are a year of degrees at every college in {st} in the majors that lead to each field. Open jobs are roles located in {st}; remote roles count in the state the employer lists. Each field is compared with {st}&apos;s own average across measured fields{d.stateAllPerHundred != null ? ` (${per(d.stateAllPerHundred)} open jobs per 100 graduates)` : ''}, not with the national figure: a national count also holds remote roles and postings with no state, so it runs higher than any one state&apos;s. A dash means too few graduates or postings to read.</p>
      </section>
      <Sources d={d} />
    </div>
  )
}

/** Peers: similar colleges by the share of their graduates in fields with more open jobs per graduate than average. */
export async function AcademicPeers({ ctx }: Props) {
  const result = await load(ctx.institution.id)
  if (!result.ok) return <Unavailable result={result} />
  // Academic affairs staff and administrators choose the peer group; a viewer seat sees it.
  const canEdit = !ctx.readOnly && (ctx.tokens.has('ACADEMIC_AFFAIRS') || ctx.tokens.has('INSTITUTION_ADMIN'))
  const names = canEdit ? Object.values(await loadIndex()).map((r) => r[0]).sort((a, b) => a.localeCompare(b)) : []
  return <PeersView d={result.data} edit={canEdit ? { slug: ctx.institution.slug, names } : undefined} />
}

const CONTROL_SHORT: Record<string, string> = { Public: 'Public', 'Private nonprofit': 'Private', 'Private for-profit': 'For-profit' }

export function PeersView({ d, edit }: { d: ProgramsMarket; edit?: { slug: string; names: string[] } }) {
  const me = d.peers.rows.find((p) => p.me)!
  const label = d.peers.chosen ? 'your peer group' : 'similar colleges'
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="max-w-3xl text-lg font-medium">
          {me.aboveShare != null && d.peers.median != null
            ? `${pct0(me.aboveShare)} of your graduates in measured fields are in above-average fields. The median for ${label} is ${pct0(d.peers.median)}.`
            : 'The peer comparison appears after the next monthly build.'}
        </p>
        {d.peers.scope && <p className="text-sm text-muted-foreground">{d.peers.chosen ? 'Peers chosen by your team.' : `Suggested peers: ${d.peers.scope}.`}{edit ? ' Add or remove colleges below to set your own peer group.' : ''}</p>}
      </section>
      <section aria-labelledby="peers-h" className="space-y-3">
        <h2 id="peers-h" className="text-base font-semibold">You and {label}</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Peer colleges by share of graduates in above-average fields</caption>
            <thead className="border-b border-border">
              <tr>
                <th scope="col" className={TH}>College</th>
                <th scope="col" className={TH}>State</th>
                <th scope="col" className={TH}>Type</th>
                <th scope="col" className={`${TH} text-right`}>Admission rate</th>
                <th scope="col" className={`${TH} text-right`}>Degrees a year</th>
                <th scope="col" className={`${TH} text-right`}>Since {MAJOR_BASE_YEAR}</th>
                <th scope="col" className={`${TH} text-right`}>In above-average fields</th>
                <th scope="col" className={TH}>Largest field</th>
                {edit && <th scope="col" className={TH}><span className="sr-only">Change</span></th>}
              </tr>
            </thead>
            <tbody>
              {d.peers.rows.map((p) => (
                <tr key={p.unitid} className={`border-b border-border last:border-0 ${p.me ? 'bg-primary/5' : ''}`}>
                  <th scope="row" className={`p-3 ${p.me ? 'font-semibold' : 'font-normal'}`}>{p.name}{p.me ? ' (you)' : ''}</th>
                  <td className="p-3">{p.state}</td>
                  <td className="p-3">{p.control ? CONTROL_SHORT[p.control] ?? p.control : '–'}</td>
                  <td className="p-3 text-right tabular-nums">{p.admitRate == null ? '–' : `${Math.round(p.admitRate)}%`}</td>
                  <td className="p-3 text-right tabular-nums">{n0(p.total)}</td>
                  <td className="p-3 text-right tabular-nums">{signed(p.change)}</td>
                  <td className="p-3 text-right tabular-nums">{p.aboveShare == null ? '–' : pct0(p.aboveShare)}</td>
                  <td className="p-3">{p.topField ?? 'Many kinds of work'}</td>
                  {edit && <td className="p-3">{p.me ? null : <RemovePeerButton slug={edit.slug} unitid={p.unitid} name={p.name} />}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {d.peers.chosen
            ? 'Your team chose these colleges. '
            : 'Suggested peers share your federal (Carnegie 2021) classification group and admission-rate band, public and private alike, closest in admission rate first; a college with no admission rate is matched on classification, control and size. '}
          Admission rate: fall 2023 applicants admitted (IPEDS). &ldquo;Above-average fields&rdquo; counts only fields we measure.
        </p>
      </section>
      {edit && (
        <section aria-labelledby="peers-edit-h" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="peers-edit-h" className="text-base font-semibold">Your peer group</h2>
          <AddPeerForm slug={edit.slug} names={edit.names} />
          {d.peers.chosen && <ResetPeersButton slug={edit.slug} />}
        </section>
      )}
      <Sources d={d} />
    </div>
  )
}
