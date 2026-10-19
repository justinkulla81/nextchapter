import { Check } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TuneStrip } from '@/components/candidate/TuneStrip'
import { Meter, PrimaryButton, SecondaryButton, TextLink } from '@/components/candidate/ui'

const Bare = ({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) => (
  <div className="theme-candidate min-h-screen bg-white px-5 py-8"><div className={`mx-auto space-y-8 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>{children}</div></div>
)

// The moment Candidate+ is earned. Once earned it is never shown as a locked step again.
export function CandidatePlusUnlock() {
  return (
    <Bare>
      <section className="space-y-5 rounded-2xl bg-ink p-8 text-white">
        <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">You earned it</p>
        <h1 className="font-display text-4xl leading-tight font-semibold">You are Candidate+.</h1>
        <p className="text-base text-white/90">Over 11 weeks you put in 1,240 minutes of real work, finished your profile, and gave two people the chance to vouch for you. That is what the mark shows.</p>
        <ul className="space-y-2 text-base text-white/90">
          <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden />Recruiters and hiring managers now see your mark and your dossier.</li>
          <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden />You are in the recruiter search for operations leaders in New York.</li>
          <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden />You can switch this off at any time.</li>
        </ul>
        <p className="rounded-xl bg-white/10 p-3 text-sm text-white/90">Confidential mode is on, so no one sees your mark until you choose to show it.</p>
      </section>
      <div className="flex flex-wrap items-center gap-4"><PrimaryButton>See my dossier</PrimaryButton><SecondaryButton>Choose who sees it</SecondaryButton></div>
    </Bare>
  )
}

// Replaces the "You just earned new badges" email. No badges: what you did, what came back, one next step.
export function WeeklyEmail() {
  return (
    <div className="min-h-screen bg-muted/60 px-4 py-8 font-sans text-ink">
      <div className="mx-auto max-w-[600px] space-y-1 text-sm text-muted-foreground"><p><span className="font-semibold text-ink">From:</span> NextChapter</p><p><span className="font-semibold text-ink">Subject:</span> Your week: 5 conversations, 2 replies, and one thing to try</p></div>
      <div className="mx-auto mt-4 max-w-[600px] space-y-6 rounded-2xl bg-white p-8">
        <p className="text-lg font-bold text-ink">NextChapter</p>
        <h1 className="font-display text-3xl leading-tight font-semibold text-ink">A good week, Maya.</h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">Your effort</p><p className="text-base font-semibold text-ink">142 minutes, 5 days</p><p className="text-sm text-ink">5 conversations, 4 applications</p></div>
          <div className="space-y-1 rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">What came back</p><p className="text-base font-semibold text-ink">2 replies</p><p className="text-sm text-ink">1 interview next Tuesday</p></div>
        </div>
        <div className="space-y-1.5"><div className="flex justify-between text-sm"><span className="font-semibold text-ink">Toward Candidate+</span><span className="text-muted-foreground">168 minutes to go</span></div><Meter pct={65} label="Toward Candidate+" /></div>
        <div className="space-y-2 rounded-xl border border-border p-4"><p className="text-sm font-semibold text-ink">One thing to try this week</p><p className="text-base text-ink">Send Priya a thank-you for Tuesday’s call. It is already drafted.</p><PrimaryButton>Open the draft</PrimaryButton></div>
        <p className="text-xs text-muted-foreground">You get this once a week. <a href="#" className="underline">Change how often</a> or <a href="#" className="underline">turn it off</a>.</p>
      </div>
    </div>
  )
}

const SITUATIONS = [
  ['I was laid off or left', 'Start with benefits, then your first conversations'],
  ['I am working and thinking about a move', 'A quiet plan that keeps your search private'],
  ['I want to grow where I am', 'Reviews, raises, and skills that last'],
  ['I want a promotion', 'The gap to the next level and who can sponsor you'],
  ['I want to change careers', 'Where your skills carry over and what to learn'],
  ['I am a student or new graduate', 'Your first résumé and first roles'],
  ['I am returning after a break', 'Your story and a gentle restart'],
  ['I am 55 or older, looking for a next act', 'Board, advisory, and part-time paths'],
  ['I am building something of my own', 'Customers and advisors, with a job as a backup'],
  ['I do fractional or independent work', 'Clients, renewals, and a steady pipeline'],
  ['I am on leave or taking time off', 'Light touch now, a warm restart later'],
]

export function OnboardingSituation() {
  return (
    <Bare wide>
      <div className="space-y-2"><p className="text-sm font-semibold text-ink">Step 1 of 5 · about 20 seconds</p><Meter pct={20} label="Step 1 of 5" /></div>
      <div className="space-y-2">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink text-balance">Which of these sounds most like you?</h1>
        <p className="text-base text-muted-foreground">We use it to set your first week and what you see. You can change it any time.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SITUATIONS.map(([t, d], i) => (
          <button key={t} type="button" aria-pressed={i === 0} className={`space-y-1 rounded-2xl border p-4 text-left ${i === 0 ? 'border-ink bg-muted/60' : 'border-border hover:bg-muted/40'}`}>
            <span className="block text-base font-semibold text-ink">{t}</span><span className="block text-sm text-muted-foreground">{d}</span>
          </button>
        ))}
      </div>
      <PrimaryButton>Continue</PrimaryButton>
    </Bare>
  )
}

export function FirstWeek() {
  return (
    <Bare>
      <section className="space-y-4 rounded-2xl bg-ink p-8 text-white">
        <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">Your first week</p>
        <h1 className="font-display text-4xl leading-tight font-semibold">Three steps, and you are on your way.</h1>
        <p className="text-base text-white/90">Built for someone who was laid off. Each takes 10 to 30 minutes.</p>
      </section>
      <ol className="space-y-3">
        {[['Check which benefits and bridge income you qualify for', 'Money worries make everything harder. Knowing your options first takes the pressure down.', '20 min'], ['Tell 10 people you are looking', 'Most roles are filled through a person. We drafted the message for you.', '30 min'], ['Save your first 5 jobs', 'They are already matched to you, with a reason on each.', '15 min']].map(([t, w, m], i) => (
          <li key={t} className="flex gap-4 rounded-2xl border border-border p-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-ink">{i + 1}</span><div className="space-y-1"><p className="text-base font-semibold text-ink">{t} <span className="font-normal text-muted-foreground">· {m}</span></p><p className="text-sm text-muted-foreground">{w}</p></div></li>
        ))}
      </ol>
      <div className="flex items-center gap-5"><PrimaryButton>Start with step 1</PrimaryButton><TextLink>See my week</TextLink></div>
    </Bare>
  )
}

export function EmptyJobs() {
  return (
    <PreviewShell place="jobs" entry="find" part="jobs">
      <PageHeader title="Find a job" intro="Roles that fit your background. For each one, we tell you why." />
      <TuneStrip title="Better jobs for you: tune your search" pct={20} because="We cannot match jobs yet. Two answers and you will see your first ones." asks={[{ ask: 'What role are you aiming for?', gain: 'Starts your matches.' }, { ask: 'Where do you want to work?', gain: 'Sets the places we look.' }]} actionLabel="Answer two questions" />
      <section className="space-y-3 rounded-2xl border border-dashed border-border p-8 text-center"><h2 className="font-display text-2xl font-semibold text-ink">Your jobs will appear here.</h2><p className="mx-auto max-w-md text-base text-muted-foreground">Each one comes with a plain reason it fits you, who can help you get in, and how much it pays.</p><div><PrimaryButton>Tell us what you are aiming for</PrimaryButton></div></section>
    </PreviewShell>
  )
}

export function EmptyNetwork() {
  return (
    <PreviewShell place="network" entry="circles" part="know">
      <PageHeader title="People you know" intro="Start here. Most jobs come through someone you already know." />
      <section className="space-y-3 rounded-2xl border border-dashed border-border p-8 text-center"><h2 className="font-display text-2xl font-semibold text-ink">Bring in the people you already know.</h2><p className="mx-auto max-w-md text-base text-muted-foreground">Connect your email or LinkedIn and we find the ones who matter for your search, with a reason to reach out to each.</p><div className="flex flex-wrap justify-center gap-3"><PrimaryButton>Connect your email</PrimaryButton><SecondaryButton>Add one person</SecondaryButton></div></section>
    </PreviewShell>
  )
}

export function EmptyEffort() {
  return (
    <PreviewShell place="home" entry="progress" part="built">
      <PageHeader title="Effort and results" intro="What you have put in, and what has come back. It starts with your first day." />
      <section className="space-y-3 rounded-2xl border border-dashed border-border p-8 text-center"><h2 className="font-display text-2xl font-semibold text-ink">Nothing here yet, and that is normal.</h2><p className="mx-auto max-w-md text-base text-muted-foreground">Your first step is on Your week. When you finish it, this page starts to fill in.</p><div><PrimaryButton>Go to your week</PrimaryButton></div></section>
    </PreviewShell>
  )
}

// Asked the first time the member opens Finances and benefits (never in onboarding). Either answer is fine.
export function OnboardingMoney() {
  return (
    <Bare>
      <div className="space-y-2">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink text-balance">Would you like help with money while you search?</h1>
        <p className="text-base text-muted-foreground">Money is personal, so we only get into it if you want us to. Either answer is fine, and you can change it any time.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-3 rounded-2xl border-2 border-ink p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Yes, help me with money</h2>
          <ul className="space-y-2 text-sm text-ink">
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />How many months your money lasts</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Deadlines you could miss: health coverage, unemployment, severance</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Jobs filtered to a minimum pay you set</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />A calm way to talk it through with your partner</li>
          </ul>
          <PrimaryButton>Yes, turn it on</PrimaryButton>
        </section>
        <section className="space-y-3 rounded-2xl border border-border p-5">
          <h2 className="font-display text-xl font-semibold text-ink">No, keep money out of it</h2>
          <ul className="space-y-2 text-sm text-ink">
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />We will not ask about past pay, savings or a minimum</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />No runway, and no money steps in your first week</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Pay ranges on jobs still show, because they are not about you</li>
          </ul>
          <SecondaryButton>No, skip money</SecondaryButton>
        </section>
      </div>
      <p className="text-sm text-muted-foreground">Nothing you say here is shared with employers, recruiters, schools or coaches.</p>
    </Bare>
  )
}

export function AccountMoney() {
  return (
    <PreviewShell place="account" entry="money">
      <PageHeader title="Money help" intro="Choose whether NextChapter helps with money. You can change this any time." />
      <section className="space-y-4 rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-base font-semibold text-ink">Help with money is off</p><p className="text-sm text-muted-foreground">No runway, no questions about pay or savings, and no Finances and benefits in the menu.</p></div><PrimaryButton>Turn it on</PrimaryButton></div>
        <div className="rounded-xl bg-muted/60 p-4 text-sm text-ink"><p className="font-semibold">What you would get</p><ul className="mt-1 list-disc space-y-1 pl-5"><li>How many months your money lasts, and what would stretch it</li><li>Dates you could miss, worked out from your last day</li><li>Jobs filtered to a minimum pay you choose</li></ul></div>
      </section>
      <p className="text-sm text-muted-foreground">If you turn it off later, we hide it and keep your numbers until you ask us to delete them. <TextLink>Delete my money numbers</TextLink></p>
    </PreviewShell>
  )
}
