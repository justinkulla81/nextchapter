import { Check, Lock } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, Chip, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'
import { AREA_COSTS_SOURCE, costsFor, homeLine, priceLine, rentLine, valueInHomeDollars, worthLine } from '@/lib/market/area-costs'

// Sample data only. "Your partner" means a spouse, partner or significant other who works the search with the member,
// especially when the family is moving. It is a different role from a supporter (a weekly effort note and a cheer, no
// account). Nothing here is live; see docs/candidate-redesign.md.

const Choice = ({ on, children }: { on?: boolean; children: React.ReactNode }) => (
  <span className={`inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold ${on ? 'border-ink bg-ink text-white' : 'border-border text-ink'}`}>{children}</span>
)

export function PartnerInvite() {
  const shared: [string, string, boolean][] = [
    ['The places you are comparing', 'So you can weigh them together. They can add places too.', true],
    ['Jobs and pay in those places', 'For both of you: what is open and what it pays where you would live.', true],
  ]
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Invite your partner" intro="Search together. Your partner sees the places you are comparing and the jobs and pay there, and gets their own search in the same place." action={<PrimaryButton>Send the invite</PrimaryButton>} />
      <Section id="who" title="How do you want them in?">
        <div className="flex flex-wrap gap-3" role="group" aria-label="How your partner joins">
          <Choice on>My partner, searching with me</Choice>
          <Choice>Cheering me on</Choice>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Why: a partner who is also looking for work needs their own account. Someone who only wants to encourage you gets a weekly note and can send a cheer.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">Their name<input className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base font-normal" defaultValue="Sam" readOnly /></label>
          <label className="block text-sm font-semibold text-ink">Their email<input className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base font-normal" defaultValue="sam@example.com" readOnly /></label>
        </div>
      </Section>
      <Section id="shares" title="What they can see">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {shared.map(([t, why, on]) => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="max-w-xl"><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">Why: {why}</p></div>
              <div className="flex gap-2" role="group" aria-label={t}><Choice on={on}>Share</Choice><Choice on={!on}>Don’t share</Choice></div>
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="max-w-xl"><p className="text-base font-semibold text-ink">Your applications, contacts, notes and messages</p><p className="text-sm text-muted-foreground">Why: a search is private. This is never shared with a partner unless you decide to, one item at a time.</p></div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink"><Lock className="size-4" aria-hidden /> Always private</span>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">You can change this or remove your partner at any time. If Confidential mode is on, nothing is shared until you turn it off.</p>
      </Section>
    </PreviewShell>
  )
}

export function PartnerYourPeople() {
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your people" intro="Sam is searching alongside you. Two people are cheering you on." action={<PrimaryButton>Invite someone</PrimaryButton>} />
      <Section id="partner" title="Your partner">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5">
          <div className="flex items-center gap-4"><Avatar name="Sam Whitfield" /><div><p className="text-base font-semibold text-ink">Sam Whitfield <Chip tone="good">Joined</Chip></p><p className="text-sm text-muted-foreground">Sees: places you are comparing, jobs and pay there.</p></div></div>
          <div className="flex gap-3"><PrimaryButton>Open your move plan</PrimaryButton><SecondaryButton>What Sam sees</SecondaryButton></div>
        </div>
      </Section>
      <Section id="corner" title="In your corner">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Priya Shah', 'priya@example.com'], ['Marcus Lee', 'marcus@example.com']].map(([n, e]) => (
            <li key={n} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-4"><Avatar name={n} /><div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-muted-foreground">{e} · weekly effort note</p></div></div><TextLink>Remove</TextLink></li>
          ))}
        </ul>
      </Section>
      <p className="text-sm text-muted-foreground">This replaces the single “Invite someone” list: the partner now has its own place at the top, and supporters stay below it.</p>
    </PreviewShell>
  )
}

// Costs are real (Census and BEA, src/lib/market/area-costs.ts). Openings and pay are sample numbers for the preview.
function MovePlan({ asked, salary }: { asked: boolean; salary?: number }) {
  const home = costsFor({ metroCode: '18140' })
  const places = [
    { code: '39580', you: 214, youPay: 128000, sam: 96, samPay: 72000, pick: true },
    { code: '12420', you: 305, youPay: 134000, sam: 141, samPay: 78000, pick: false },
    { code: '19740', you: 188, youPay: 131000, sam: 88, samPay: 75000, pick: false },
  ]
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your move plan" intro="Three places, side by side: your search and Sam’s, and what it costs to live there. Compared with where you live now, Columbus." action={<PrimaryButton>Add a place</PrimaryButton>} />
      {asked && !salary && (
        <section className="space-y-3 rounded-2xl border border-border bg-muted/40 p-5" aria-labelledby="ask">
          <h2 id="ask" className="font-display text-xl font-semibold text-ink">See what each salary is really worth</h2>
          <p className="text-base text-ink">A salary goes further in some places than others. What did you earn in your last role? We’ll show each place’s pay in what it would buy you in Columbus.</p>
          <label className="block text-sm font-semibold text-ink">Last annual salary<input className="mt-1 block w-60 rounded-lg border border-border bg-white px-3 py-2 text-base font-normal" placeholder="$ 120,000" readOnly /></label>
          <p className="text-sm text-muted-foreground">Why we ask: so the comparison uses your pay, not a typical one. Only you see it. You can skip this and still see the costs below.</p>
          <div className="flex flex-wrap gap-3"><SecondaryButton>Show what it’s worth</SecondaryButton><TextLink>Skip for now</TextLink></div>
        </section>
      )}
      <Section id="places" title="Where you could both work">
        <ul className="space-y-4">
          {places.map((p) => {
            const c = costsFor({ metroCode: p.code })
            const lines = [priceLine(home, c), rentLine(home, c), homeLine(home, c)].filter(Boolean) as string[]
            const worth = salary ? worthLine(salary, home, c) : null
            return (
              <li key={p.code} className="rounded-2xl border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-display text-xl font-semibold text-ink">{c?.name.replace(/ Metro Area$/, '')}</p>{p.pick && <Chip tone="good"><Check className="mr-1 inline size-3" aria-hidden />Best fit for both</Chip>}</div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Your search</dt><dd className="text-base font-semibold text-ink">{p.you} openings · median ${p.youPay.toLocaleString('en-US')}</dd></div>
                  <div className="rounded-xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Sam’s search</dt><dd className="text-base font-semibold text-ink">{p.sam} openings · median ${p.samPay.toLocaleString('en-US')}</dd></div>
                </dl>
                {salary && (
                  <p className="mt-3 text-base font-semibold text-ink">
                    {p.youPay >= salary ? `A typical offer here is $${p.youPay.toLocaleString('en-US')}, ` : ''}
                    {worthLine(p.youPay, home, c)}
                  </p>
                )}
                {worth && <p className="mt-1 text-sm text-muted-foreground">Your last salary was ${salary!.toLocaleString('en-US')}; so this place pays {valueInHomeDollars(p.youPay, home, c)! >= salary! ? 'more' : 'less'} than you earned, in real terms.</p>}
                <ul className="mt-3 space-y-1 text-sm text-ink">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
                {p.pick && <p className="mt-2 text-sm text-muted-foreground">Why: it is the place where both of you have the most openings that match.</p>}
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Costs: {AREA_COSTS_SOURCE}. Openings and pay are sample numbers for this preview.</p>
      </Section>
    </PreviewShell>
  )
}

export const PartnerMoving = () => <MovePlan asked={false} />
export const PartnerMovingAsk = () => <MovePlan asked />
export const PartnerMovingWorth = () => <MovePlan asked salary={120000} />
