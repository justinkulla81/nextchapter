import { Check, Lock } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, Chip, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'

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

export function PartnerMoving() {
  const places = [
    { n: 'Raleigh, NC', you: '214 openings · median $128,000', sam: '96 openings · median $72,000', living: 'Housing about 14% below your current city', pick: true },
    { n: 'Austin, TX', you: '305 openings · median $134,000', sam: '141 openings · median $78,000', living: 'Housing about 6% below your current city', pick: false },
    { n: 'Denver, CO', you: '188 openings · median $131,000', sam: '88 openings · median $75,000', living: 'Housing about the same as your current city', pick: false },
  ]
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your move plan" intro="Three places, side by side: your search and Sam’s. Sample data in this preview." action={<PrimaryButton>Add a place</PrimaryButton>} />
      <Section id="places" title="Where you could both work">
        <ul className="space-y-4">
          {places.map((p) => (
            <li key={p.n} className="rounded-2xl border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-display text-xl font-semibold text-ink">{p.n}</p>{p.pick && <Chip tone="good"><Check className="mr-1 inline size-3" aria-hidden />Best fit for both</Chip>}</div>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Your search</dt><dd className="text-base font-semibold text-ink">{p.you}</dd></div>
                <div className="rounded-xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Sam’s search</dt><dd className="text-base font-semibold text-ink">{p.sam}</dd></div>
              </dl>
              <p className="mt-3 text-sm text-ink">{p.living}.</p>
              {p.pick && <p className="mt-1 text-sm text-muted-foreground">Why: it is the place where both of you have the most openings that match, with the lowest housing cost.</p>}
            </li>
          ))}
        </ul>
      </Section>
      <Section id="next" title="What to do next">
        <p className="text-base text-ink">Sam has not told us yet what work Sam wants in Raleigh. <TextLink>Remind Sam</TextLink></p>
      </Section>
      <p className="text-xs text-muted-foreground">Openings are on our board now; pay is posted pay. Sample numbers for the preview only.</p>
    </PreviewShell>
  )
}
