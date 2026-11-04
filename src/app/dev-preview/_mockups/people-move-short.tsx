import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { NetworkParts } from '@/components/network/NetworkParts'
import { Section } from '@/components/candidate/ui'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { InviteSupporterForm, RemoveSupporterButton } from '@/app/dashboard/supporters/SupporterForms'
import { InvitePartnerForm, PartnerCard } from '@/app/dashboard/supporters/PartnerForms'
import { AcceptInviteCard, AddPlaceForm, RemovePlaceButton } from '@/app/dashboard/move-plan/MovePlanForms'
import { InviteShell } from '@/app/dashboard/supporters/InviteShell'
import { AddPlaceShell } from '@/app/dashboard/move-plan/AddPlaceShell'

// Your people and Your move plan, shortened to the page contract (docs/candidate-redesign.md). Real forms and cards, sample data.
// Your people: one "Invite someone" with a supporter / partner choice instead of two open forms; the weekly-note promise said once, with the
// invite; the invite above the lists. Move plan: "Add a place" is a button that opens the form; each place is a row (verdict, reason, one fact),
// with both pay figures and the other costs on demand. The accept-invite card shows on Your people only (not twice).
// Sample choice pending the owner: the partner invite lives only on Your people, and the move plan links to it.

const more = 'text-sm font-medium text-brand underline underline-offset-4'
const OPTIONS = [{ code: '1', name: 'Raleigh, NC' }, { code: '2', name: 'Austin, TX' }, { code: '3', name: 'Denver, CO' }, { code: '4', name: 'Charlotte, NC' }]

function Cheers() {
  return (
    <Section id="cheers" title="Cheers for you">
      <RowList label="Cheers for you">
        <ListRow name="Alex" title="You are doing the right things. Keep going." fact="Alex · Nov 2" />
        <ListRow name="Dana" title="Proud of you for reaching out this week." fact="Dana · Oct 29" />
      </RowList>
    </Section>
  )
}

export function PeopleNew() {
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your people" />
      <NetworkParts current="close" />
      <AcceptInviteCard linkId="demo" ownerName="Sam" />
      <InviteShell startOpen canPartner supporters={0} supporterForm={<InviteSupporterForm />} partnerForm={<InvitePartnerForm />} />
      <p className="text-sm text-muted-foreground">A coach is part of your close circle too. <a href="#" className={more}>See coaching</a></p>
    </PreviewShell>
  )
}

export function PeopleFull() {
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your people" />
      <NetworkParts current="close" />
      <InviteShell startOpen={false} canPartner={false} supporters={2} supporterForm={<InviteSupporterForm />} partnerForm={<InvitePartnerForm />} />
      <Cheers />
      <Section id="partner-title" title="Your partner">
        <PartnerCard role="owner" linkId="demo" name="Jordan" joined sharePlaces shareJobsPay={false} />
      </Section>
      <Section id="who" title="In your corner">
        <RowList label="Your supporters">
          <ListRow name="Alex" title="Alex" fact="alex@example.com" actions={<RemoveSupporterButton id="1" name="Alex" />} />
          <ListRow name="Dana" title="Dana" fact="dana@example.com" actions={<RemoveSupporterButton id="2" name="Dana" />} />
        </RowList>
      </Section>
      <p className="text-sm text-muted-foreground">A coach is part of your close circle too. <a href="#" className={more}>See coaching</a></p>
    </PreviewShell>
  )
}

const PLACES = [
  { n: 'Raleigh, NC', v: 'Your pay buys about 14% more here than at home.', why: 'Median pay for a VP of Operations there is $226,000, and costs run lower.', fact: 'Rent about 38% lower than Boston.', you: 'Median $226,000', them: 'Median $98,000', lines: ['Everyday prices about 9% lower.', 'Rent about 38% lower.', 'Home prices about 41% lower.'] },
  { n: 'Austin, TX', v: 'Your pay buys about the same here as at home.', why: 'Median pay is $241,000 and costs run a little lower.', fact: 'Rent about 12% lower than Boston.', you: 'Median $241,000', them: 'Median $104,000', lines: ['Everyday prices about 3% lower.', 'Rent about 12% lower.', 'Home prices about 18% lower.'] },
  { n: 'Denver, CO', v: 'Your pay buys about 4% less here than at home.', why: 'Median pay is $232,000, and rent runs about the same.', fact: 'Rent about 2% lower than Boston.', you: 'Median $232,000', them: 'Not shown', lines: ['Everyday prices about the same.', 'Rent about 2% lower.', 'Home prices about 6% lower.'] },
]

function PlaceRow({ p }: { p: (typeof PLACES)[number] }) {
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl font-semibold text-ink">{p.n}</p>
        <RemovePlaceButton id="x" name={p.n} />
      </div>
      <p className="text-base text-ink"><span className="font-semibold">{p.v}</span> <span className="text-muted-foreground">{p.why}</span></p>
      <p className="text-sm text-muted-foreground">{p.fact}</p>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">Pay for both of you and other costs</summary>
        <div className="mt-3 space-y-3">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Your pay here · VP of Operations</dt><dd className="text-base font-semibold text-ink">{p.you}</dd></div>
            <div className="rounded-xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Jordan’s pay here</dt><dd className="text-base font-semibold text-ink">{p.them}</dd></div>
          </dl>
          <ul className="space-y-1 text-sm text-ink">{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      </details>
    </li>
  )
}

export function MoveWithPlaces() {
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your move plan" intro="3 places, side by side. Costs are compared with Boston." />
      <NetworkParts current="close" />
      <AddPlaceShell startOpen={false} places={3} form={<AddPlaceForm options={OPTIONS} />} />
      <section aria-label="Places you are comparing" className="space-y-2">
        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">{PLACES.map((p) => <PlaceRow key={p.n} p={p} />)}</ul>
        <p className="text-xs text-muted-foreground">Costs: regional price parities, comparing each area with Boston. Pay is the BLS median for the occupation in that metro area, before taxes.</p>
      </section>
      <p className="text-base text-ink">Moving with a partner? <a href="#" className={more}>Invite your partner</a> from Your people to compare places together.</p>
    </PreviewShell>
  )
}

export function MoveEmpty() {
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your move plan" intro="Add the places you are thinking about. We show what it costs to live there and what your pay would buy." />
      <NetworkParts current="close" />
      <AddPlaceShell startOpen places={0} form={<AddPlaceForm options={OPTIONS} />} />
    </PreviewShell>
  )
}
