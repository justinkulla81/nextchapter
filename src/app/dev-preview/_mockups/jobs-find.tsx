import { Bookmark, Check, Minus, CircleDashed } from 'lucide-react'
import { TuneStrip } from '@/components/candidate/TuneStrip'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, DarkButton, PrimaryButton, SecondaryButton, TextLink, Section } from '@/components/candidate/ui'
import { cn } from '@/lib/utils'

const JOBS = [
  { t: 'Chief Financial Officer', c: 'Arsenault', loc: 'New York, NY', pay: '$280–340K', v: 'Good fit', r: 'You have led finance at a company this size.', m: 'Posted 34 hours ago · Likely fewer applicants' },
  { t: 'Executive Director', c: 'Byrdcliffe', loc: 'Remote', pay: '$210–250K', v: 'Strong fit', r: 'Your nonprofit board work matches what they ask for.', m: 'Posted today · Likely fewer applicants' },
  { t: 'Chief Operating Officer', c: 'Intercontinental Exchange', loc: 'New York, NY', pay: '$320–400K', v: 'Worth a look', r: 'You have run operations, but not at this size yet.', m: 'Posted 3 days ago' },
  { t: 'President', c: 'Lemaitre Vascular', loc: 'Burlington, MA', pay: '$300–380K', v: 'Good fit', r: 'You have led a P&L in a regulated industry.', m: 'Posted 5 days ago' },
  { t: 'VP Operations', c: 'Harbor Health', loc: 'Hybrid, Boston', pay: '$230–270K', v: 'Good fit', r: 'Same function and level, one industry over.', m: 'Posted 6 days ago' },
]

const verdictTone = (v: string) => (v === 'Worth a look' ? 'text-muted-foreground' : 'text-success')

function JobList() {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-white" aria-label="Jobs">
      {JOBS.map((j, i) => (
        <li key={j.t} className={cn('flex gap-3 p-4', i === 0 && 'border-l-[3px] border-l-ink bg-muted/40')}>
          <Avatar name={j.c} />
          <div className="min-w-0 space-y-0.5">
            <p className="text-base leading-snug font-semibold text-ink">{j.t}</p>
            <p className="text-sm text-ink">{j.c} · {j.loc}</p>
            <p className="text-sm text-muted-foreground">{j.pay}</p>
            <p className="pt-1 text-sm"><span className={cn('font-semibold', verdictTone(j.v))}>{j.v}.</span> {j.r}</p>
            <p className="text-xs text-muted-foreground">{j.m}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Factor({ state, label, note }: { state: 'match' | 'gap' | 'unknown'; label: string; note: string }) {
  const Icon = state === 'match' ? Check : state === 'gap' ? Minus : CircleDashed
  return (
    <li className="flex gap-2.5 text-base">
      <Icon className={cn('mt-1 size-4 shrink-0', state === 'match' ? 'text-success' : 'text-muted-foreground')} aria-hidden />
      <span><span className="font-semibold text-ink">{label}.</span> {note}</span>
    </li>
  )
}

function JobDetail() {
  return (
    <article className="space-y-7 rounded-2xl border border-border bg-white p-7" aria-label="Chief Financial Officer at Arsenault">
      <header className="space-y-3">
        <div className="flex items-start gap-4">
          <Avatar name="Arsenault" size="lg" />
          <div className="space-y-1">
            <h2 className="font-display text-2xl leading-tight font-semibold text-ink">Chief Financial Officer</h2>
            <p className="text-base text-ink">Arsenault · New York, NY · Full-time</p>
            <p className="text-sm text-muted-foreground">Search-firm role · Posted 34 hours ago</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DarkButton>Apply</DarkButton>
          <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"><Bookmark className="size-4" aria-hidden />Save</button>
          <TextLink>Not for me</TextLink>
        </div>
      </header>

      <Section id="fit" title="Why this fits you">
        <p className="text-lg"><span className="font-semibold text-success">Good fit.</span> You have led finance at a company this size.</p>
        <ul className="space-y-2">
          <Factor state="match" label="Level" note="Executive roles are your level." />
          <Factor state="match" label="Pay" note="Posted range is above your target." />
          <Factor state="match" label="Place" note="New York, where you want to work." />
          <Factor state="gap" label="One gap" note="They ask for PE-backed experience. You have public-company experience." />
        </ul>
      </Section>

      <Section id="help" title="Who can help you get in">
        <ul className="divide-y divide-border rounded-xl border border-border">
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3"><Avatar name="Priya Shah" size="sm" /><div><p className="text-base font-semibold text-ink">Priya Shah</p><p className="text-sm text-muted-foreground">Worked at Arsenault until 2024. You worked together at Northwind.</p></div></div>
            <PrimaryButton>Ask for an intro</PrimaryButton>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3"><Avatar name="Marcus Lee" size="sm" /><div><p className="text-base font-semibold text-ink">Marcus Lee</p><p className="text-sm text-muted-foreground">Knows the search partner. Ohio State alumnus.</p></div></div>
            <SecondaryButton>Ask for an intro</SecondaryButton>
          </li>
        </ul>
      </Section>

      <Section id="pay" title="Pay">
        <p className="text-base"><span className="font-semibold">$280–340K posted.</span> Market for this role in New York is $260–320K, so this pays above market.</p>
        <div className="relative h-2 rounded-full bg-border" aria-hidden>
          <div className="absolute inset-y-0 left-[28%] w-[44%] rounded-full bg-ink/25" />
          <div className="absolute inset-y-0 left-[40%] w-[52%] rounded-full bg-ink" />
        </div>
        <p className="text-sm text-muted-foreground">Light bar: market range. Dark bar: this job. Based on posted salaries for finance executives in New York.</p>
      </Section>

      <Section id="comp" title="How many people will apply">
        <p className="text-base"><span className="font-semibold">Likely fewer applicants.</span> This is an estimate, not a count.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>A search-firm role that is not on the big job boards.</li>
          <li>Posted 34 hours ago, so early applicants stand out.</li>
          <li>Listed by one source only.</li>
        </ul>
      </Section>

      <Section id="prep" title="Get ready to apply">
        <div className="flex flex-wrap gap-3"><SecondaryButton>Open the apply kit</SecondaryButton><SecondaryButton>Draft a cover note</SecondaryButton><SecondaryButton>Read the full posting</SecondaryButton></div>
      </Section>
    </article>
  )
}

export function FindJobs() {
  return (
    <PreviewShell place="jobs" entry="find" part="jobs" wide>
      <PageHeader title="Find a job" intro="Roles that fit your background. For each one, we tell you why." />
      <form className="flex flex-wrap gap-3" role="search" aria-label="Search jobs">
        <input aria-label="Job title, skill or company" className="h-11 min-w-60 flex-1 rounded-full border border-border bg-white px-5 text-base" placeholder='Try "VP finance" or company:Stripe' />
        <input aria-label="City, state or remote" className="h-11 min-w-48 flex-1 rounded-full border border-border bg-white px-5 text-base" placeholder="City, state or Remote" />
        <PrimaryButton>Search jobs</PrimaryButton>
      </form>

      <TuneStrip
        title="Better jobs for you: tune your search"
        pct={70}
        because="Matching on Executive operations, New York or remote, full-time. Two answers would sharpen it."
        asks={[
          { ask: 'Add your tools.', gain: 'About 150 more jobs match.' },
          { ask: 'Say if you would relocate.', gain: 'Opens Pittsburgh and Louisville.' },
        ]}
        actionLabel="Answer two questions"
      />

      <div className="grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">111 executive jobs in New York or remote</p>
          <JobList />
          <SecondaryButton>Show 10 more</SecondaryButton>
        </div>
        <JobDetail />
      </div>
    </PreviewShell>
  )
}
