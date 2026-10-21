import type { ReactNode } from 'react'
import type { Prospect } from '@/lib/prospects/config'
import { functionLabel, type FieldReadiness, type HubData, type Market, type NoticeSummary, type Opening } from '@/lib/prospects/market'

const n0 = (n: number) => n.toLocaleString('en-US')
const money = (n: number | null) => (n == null ? '' : `$${Math.round(n / 1000)}k`)
const LEVEL: Record<string, string> = { MANAGER: 'Manager', SENIOR_MANAGER: 'Senior manager', DIRECTOR: 'Director', VP: 'VP', SENIOR_IC: 'Senior', MID_LEVEL: 'Mid-level' }
const linkCls = 'font-medium text-primary underline underline-offset-4 hover:text-navy'

function Block({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <div className="space-y-3"><div><h3 className="font-semibold text-navy">{title}</h3>{sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}</div>{children}</div>
}

function PostingLink({ o }: { o: Opening }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
      <span><a className={linkCls} href={o.url} target="_blank" rel="noopener noreferrer">{o.title} ↗</a><span className="text-muted-foreground"> · {o.company}</span></span>
      <span className="tabular-nums text-muted-foreground">{o.level ? `${LEVEL[o.level] ?? o.level} · ` : ''}{money(o.pay)}</span>
    </li>
  )
}

/** The front page of the hub: a welcome in the organization's voice, and the sign-up they would put in front of their people. */
export function HomePanel({ p }: { p: Prospect }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{p.name}</p>
        <h3 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-navy [text-wrap:balance]">{p.welcome.title}</h3>
        <p className="text-muted-foreground">{p.welcome.body}</p>
        <ul className="space-y-2 text-sm">
          {['A pivot plan built from your own work history', 'Retraining matched to the skills you are missing', 'Networking outreach drafted for you, and coaching', 'Exclusive jobs and recruiters, with local roles first'].map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-success">✓</span>{t}</li>)}
        </ul>
      </div>
      <div role="group" className="space-y-3 rounded-2xl border border-border bg-off-white p-5" aria-label="Sign-up preview">
        <p className="font-semibold text-navy">Join the {p.welcome.who} community</p>
        {['Your name', 'Email', p.kind === 'college' ? 'Class year' : 'Where you work or worked'].map((l) => (
          <div key={l} className="space-y-1"><label className="text-xs font-medium text-muted-foreground">{l}</label><div className="h-9 rounded-md border border-border bg-white" aria-hidden /></div>
        ))}
        <div className="rounded-md bg-navy px-4 py-2 text-center text-sm font-medium text-white" aria-hidden>Join free</div>
        <p className="text-xs text-muted-foreground">Preview only. The live sign-up goes on after you activate, and each person chooses what to share. Free for the people you refer.</p>
      </div>
    </div>
  )
}

export function JobsPanel({ market, place }: { market: Market; place: string }) {
  return (
    <div className="space-y-6">
      <Block title={`${n0(market.openRoles)} white-collar roles open in ${place}`} sub={`${n0(market.employersHiring)} employers are hiring. Each person sees roles ranked for them, local first. A few real ones this week, one per field:`}>
        <ul className="divide-y divide-border rounded-xl border border-border px-4">{market.sample.map((o) => <PostingLink key={o.url} o={o} />)}</ul>
      </Block>
    </div>
  )
}

export function SkillsPanel({ fields, place, orgName }: { fields: FieldReadiness[]; place: string; orgName: string }) {
  if (!fields.length) return <p className="text-sm text-muted-foreground">Skill data for {place} appears here once the job database has enough roles.</p>
  return (
    <div className="space-y-5">
      <Block title="Skills, learning and AI readiness" sub={`What employers in ${place} are paying for, field by field. Each person sees their own gap against this, and a plan to close it. Open a field to see the roles behind the numbers.`}>
        <div className="divide-y divide-border rounded-xl border border-border">
          {fields.map((f) => (
            <details key={f.fn} className="group p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-medium text-navy">
                <span>{functionLabel(f.fn)} <span className="font-normal text-muted-foreground">· {n0(f.roles)} open roles{f.medianPay ? ` · median ${money(f.medianPay)}` : ''}</span></span>
                <span className="flex flex-wrap gap-1.5">{f.signals.slice(0, 2).map((s) => <span key={s.key} className="rounded-full bg-orange/15 px-2 py-0.5 text-xs">{s.label}{s.premiumPct != null && s.premiumPct > 0 ? ` +${s.premiumPct}%` : ''}</span>)}</span>
              </summary>
              <div className="mt-4 space-y-4">
                {f.signals.map((s) => (
                  <div key={s.key}>
                    <p className="text-sm font-medium">{s.label}: {n0(s.roles)} roles{s.medianPay ? `, median ${money(s.medianPay)}` : ''}{s.premiumPct != null ? (s.premiumPct >= 0 ? `, ${s.premiumPct}% above the field median` : `, ${Math.abs(s.premiumPct)}% below`) : ''}</p>
                    <ul className="mt-1 divide-y divide-border rounded-lg border border-border px-3">{(f.examples[s.key] ?? []).map((o) => <PostingLink key={o.url} o={o} />)}</ul>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{(100 * f.aiShare).toFixed(0)}% of {functionLabel(f.fn).toLowerCase()} roles here name AI or machine learning in the title. Pay is the posted midpoint; titles show the skill, not every requirement.</p>
              </div>
            </details>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">For {orgName}&apos;s community, this becomes a personal readiness score: the skills in a person&apos;s work history, the gap to the roles they want, and the learning that closes it.</p>
      </Block>
    </div>
  )
}

export function EmployersPanel({ market, notices, scope }: { market: Market; notices: NoticeSummary; scope: string }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <Block title="Who is hiring" sub="Employers with the most open white-collar roles right now.">
        <ul className="divide-y divide-border rounded-xl border border-border px-4 text-sm">{market.topEmployers.map((e) => <li key={e.name} className="flex justify-between py-2"><span>{e.name}</span><span className="tabular-nums text-muted-foreground">{n0(e.roles)} roles</span></li>)}</ul>
      </Block>
      <Block title={`Layoffs in ${scope}`} sub={`${n0(notices.notices)} state filings covering ${n0(notices.jobs)} jobs. Anyone affected gets this hub first.`}>
        <ul className="divide-y divide-border rounded-xl border border-border px-4 text-sm">{notices.top.map((t) => <li key={t.employer} className="flex justify-between gap-3 py-2"><span>{t.employer}</span><span className="tabular-nums text-muted-foreground">{n0(t.employees)} jobs</span></li>)}</ul>
        <p className="text-xs text-muted-foreground">Public state WARN filings.</p>
      </Block>
    </div>
  )
}

export function LearnPanel({ hub, p }: { hub: HubData; p: Prospect }) {
  return (
    <Block title="Learn and retrain nearby" sub={`Colleges in ${p.placeLabel}${p.kind === 'college' ? ', and W&J\'s own programs, which sit first for every alum' : ''}. A person's plan points them to the program that fits their gap.`}>
      {hub.colleges.length === 0 ? <p className="text-sm text-muted-foreground">Nearby colleges appear here.</p> : (
        <ul className="divide-y divide-border rounded-xl border border-border px-4 text-sm">
          {hub.colleges.map((c) => (
            <li key={c.name} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <span>{c.website ? <a className={linkCls} href={/^https?:/.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer">{c.name} ↗</a> : c.name}<span className="text-muted-foreground"> · {c.level === '2-year' ? 'Two-year' : 'Four-year'}{c.enrollment ? `, ${n0(c.enrollment)} students` : ''}</span></span>
              <span className="flex gap-1.5">{c.retraining && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Retraining</span>}{c.execEd && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">Executive education</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

export function ContactsPanel({ hub, p }: { hub: HubData; p: Prospect }) {
  return (
    <div className="space-y-6">
      <Block title="Your people on the hub" sub="A named contact at the top of the hub, so a person always knows who to ask.">
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{p.name} contact: your name, title and email go here once you activate.</div>
      </Block>
      <Block title="Public help nearby" sub="Free services that sit beside the hub. Listed from public directories.">
        <ul className="divide-y divide-border rounded-xl border border-border px-4 text-sm">
          {hub.boards.map((b) => <li key={b.id} className="py-2.5"><span className="font-medium">{b.website ? <a className={linkCls} href={/^https?:/.test(b.website) ? b.website : `https://${b.website}`} target="_blank" rel="noopener noreferrer">{b.name} ↗</a> : b.name}</span><span className="block text-muted-foreground">Local workforce board{b.director ? ` · ${b.director}${b.directorTitle ? `, ${b.directorTitle}` : ''}` : ''}</span></li>)}
          {hub.centers.map((c) => <li key={c.name + (c.city ?? '')} className="py-2.5"><span className="font-medium">{c.url ? <a className={linkCls} href={c.url} target="_blank" rel="noopener noreferrer">{c.name} ↗</a> : c.name}</span><span className="block text-muted-foreground">American Job Center{c.city ? ` · ${c.city}` : ''}{c.phone ? ` · ${c.phone}` : ''}</span></li>)}
        </ul>
      </Block>
    </div>
  )
}

export function EngagePanel({ p }: { p: Prospect }) {
  const steps = p.kind === 'talent'
    ? ['Share your hub link with any employer in a layoff, and in your newsletter and talent events.', 'Add the QR code to a handout or a welcome packet for new and returning talent.', 'Invite employers to post roles that only your community sees.']
    : p.kind === 'college'
      ? ['Send the hub link to alumni in your next newsletter and on your career-services page.', 'When layoffs hit the region, write to affected alumni with the link, with their consent.', 'Invite alumni employers to post roles only your community sees, and alumni mentors to join.']
      : ['Put the hub link in the announcement or packet for anyone leaving, for any reason.', 'Invite alumni into the network, with an opt-in to hear about roles back at the company.', 'Share open Brown-Forman roles with alumni first, and see who is open to returning.']
  return (
    <div className="space-y-6">
      <Block title="Three ways to switch it on">
        <ol className="space-y-2 text-sm">{steps.map((t, i) => <li key={t} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{i + 1}</span><span className="pt-0.5">{t}</span></li>)}</ol>
      </Block>
      <Block title="What you would see" sub="Counts only, never names, and a number shows once 10 or more people have joined.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">{['Joined', 'Engaged', 'Interviewing', 'Landed', p.stayLabel].map((c) => <li key={c} className="rounded-xl bg-off-white p-3"><p className="font-serif text-2xl text-navy tabular-nums">0</p><p className="mt-1 text-xs text-muted-foreground">{c}</p></li>)}</ul>
        <p className="text-xs text-muted-foreground">These zeros are real: nobody has joined yet.</p>
      </Block>
    </div>
  )
}
