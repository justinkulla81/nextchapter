import { Check } from 'lucide-react'
import { Meter, PrimaryButton, SecondaryButton, TextLink } from '@/components/candidate/ui'

// How every question flow should feel: a few questions at a time, the payoff shown before and after each
// answer, a clear finish, and an optional next one. No wall of fields.
function Frame({ children, step, of, minutes }: { children: React.ReactNode; step: number; of: number; minutes: string }) {
  return (
    <div className="theme-candidate min-h-screen bg-white px-5 py-8">
      <div className="mx-auto max-w-xl space-y-8">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm"><span className="font-semibold text-ink">Question {step} of {of}</span><span className="text-muted-foreground">About {minutes}</span></div>
          <Meter pct={Math.round((step / of) * 100)} label={`Question ${step} of ${of}`} />
        </div>
        {children}
      </div>
    </div>
  )
}

export function TuneQuestion() {
  const tools = ['SAP', 'Tableau', 'Salesforce', 'Excel', 'Workday', 'Oracle', 'Power BI', 'Jira']
  const picked = ['SAP', 'Tableau', 'Excel']
  return (
    <Frame step={1} of={2} minutes="30 seconds">
      <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink"><span className="font-semibold">Why we ask:</span> jobs list the tools they need. Telling us yours lets us match the ones you already qualify for.</p>
      <div className="space-y-3">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Which of these tools do you use?</h1>
        <p className="text-base text-muted-foreground">We found three in your résumé. Add or remove any.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tools">
          {tools.map((t) => (
            <button key={t} type="button" aria-pressed={picked.includes(t)} className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-5 text-base ${picked.includes(t) ? 'border-ink bg-ink text-white' : 'border-border text-ink'}`}>
              {picked.includes(t) && <Check className="size-4" aria-hidden />}{t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
        <div><p className="text-sm text-muted-foreground">Jobs that match you</p><p className="text-base text-ink"><span className="text-muted-foreground line-through">111</span> <span className="font-display text-3xl font-semibold text-ink tabular-nums">261</span></p></div>
        <p className="max-w-[12rem] text-right text-sm text-ink">Updates as you choose. 150 more jobs ask for tools you have.</p>
      </div>
      <div className="flex items-center gap-5"><PrimaryButton>Continue</PrimaryButton><TextLink>Skip for now</TextLink></div>
    </Frame>
  )
}

export function TuneDone() {
  return (
    <div className="theme-candidate min-h-screen bg-white px-5 py-8">
      <div className="mx-auto max-w-xl space-y-8">
        <section className="space-y-4 rounded-2xl bg-ink p-8 text-white">
          <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">Search tuned to 90%</p>
          <h1 className="font-display text-4xl leading-tight font-semibold">Your jobs just grew from 111 to 261.</h1>
          <ul className="space-y-1.5 text-base text-white/90">
            <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden />Tools added: 150 more jobs match</li>
            <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden />Relocation: Pittsburgh and Louisville now included</li>
          </ul>
          <div className="space-y-1.5"><div className="flex justify-between text-sm"><span>70%</span><span className="font-semibold">90% tuned</span></div><div className="h-2 overflow-hidden rounded-full bg-white/20" role="meter" aria-valuenow={90} aria-valuemin={0} aria-valuemax={100} aria-label="Search tuned"><div className="h-full rounded-full bg-action" style={{ width: '90%' }} /></div></div>
        </section>
        <div className="flex flex-wrap items-center gap-4"><PrimaryButton>See my new jobs</PrimaryButton><SecondaryButton>One more: salary range, 20 seconds</SecondaryButton></div>
        <p className="text-sm text-muted-foreground">You can change any answer later on Improve your search.</p>
      </div>
    </div>
  )
}

export function DeepDiveIntro() {
  return (
    <div className="theme-candidate min-h-screen bg-white px-5 py-8">
      <div className="mx-auto max-w-xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Deep dive · optional</p>
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink text-balance">Find out how you work best.</h1>
          <p className="text-base text-ink">Four short rounds, two minutes each. At the end you get your work-style card, and you choose whether employers see it.</p>
        </div>
        <ol className="space-y-2">
          {[['Round 1', 'How you make decisions', 'Done', true], ['Round 2', 'How you work with others', 'Next', false], ['Round 3', 'How you handle pressure', '', false], ['Round 4', 'What energizes you', '', false]].map(([r, t, s, d]) => (
            <li key={r as string} className={`flex items-center justify-between rounded-xl border p-4 ${s === 'Next' ? 'border-ink' : 'border-border'}`}><span><span className="font-semibold text-ink">{r}.</span> <span className="text-ink">{t}</span></span>{d ? <span className="text-sm font-medium text-success">Done</span> : s === 'Next' ? <span className="text-sm font-medium text-ink">2 minutes</span> : null}</li>
          ))}
        </ol>
        <div className="space-y-3 rounded-2xl bg-muted/60 p-5 text-sm text-ink"><p><span className="font-semibold">What you get:</span> better culture matches, and one more trait of nine proven in your dossier.</p><p className="text-muted-foreground">You can stop after any round and pick up later. Nothing is lost.</p></div>
        <div className="flex items-center gap-5"><PrimaryButton>Start round 2</PrimaryButton><TextLink>Not now</TextLink></div>
      </div>
    </div>
  )
}

// The same receipt for bundles whose payoff is not a jobs count. Each one says what changed, where, and by how much.
function Receipt({ eyebrow, headline, rows, chips, next }: { eyebrow: string; headline: string; rows: { label: string; before: string; after: string }[]; chips: string[]; next: string }) {
  return (
    <div className="theme-candidate min-h-screen bg-white px-5 py-8">
      <div className="mx-auto max-w-xl space-y-8">
        <section className="space-y-5 rounded-2xl bg-ink p-8 text-white">
          <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">{eyebrow}</p>
          <h1 className="font-display text-4xl leading-tight font-semibold">{headline}</h1>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.label} className="space-y-0.5 text-base"><p className="text-sm text-white/70">{r.label}</p><p><span className="text-white/60 line-through">{r.before}</span> <span className="font-semibold">{r.after}</span></p></li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-2 text-xs">{chips.map((c) => <span key={c} className="rounded-full bg-white/15 px-2.5 py-1">Changed in {c}</span>)}</p>
        </section>
        <div className="flex flex-wrap items-center gap-4"><PrimaryButton>Back to my week</PrimaryButton><SecondaryButton>{next}</SecondaryButton></div>
      </div>
    </div>
  )
}

export function ReceiptHome() {
  return (
    <Receipt
      eyebrow="Your week now fits you"
      headline="Lighter, and in your tone."
      rows={[
        { label: 'This week', before: '9 actions, 150 minutes', after: '5 actions, 90 minutes' },
        { label: 'A note from Victoria', before: '“Send 5 applications today.”', after: '“One good application today is plenty. Pick the one you like most.”' },
      ]}
      chips={['Your week', 'Notes', 'Email']}
      next="One more: what gets in the way, 20 seconds"
    />
  )
}

export function ReceiptNetwork() {
  return (
    <Receipt
      eyebrow="Warmer introductions"
      headline="6 people you know work at your target companies."
      rows={[
        { label: 'People suggested for you', before: '4 from past employers', after: '10, including 6 at Northwind, Harbor Health and Lattice Labs' },
        { label: 'Your first draft', before: 'A generic hello', after: 'A note that mentions where you both worked' },
      ]}
      chips={['Network', 'Jobs', 'Your week']}
      next="One more: how you like to reach out, 20 seconds"
    />
  )
}
