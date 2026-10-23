import { PreviewShell } from '@/components/candidate/PreviewShell'
import { Module } from '@/components/candidate/Module'
import { JourneyCard } from '@/components/candidate/JourneyCard'
import { CoachOfferNote } from '@/components/candidate/CoachOfferNote'
import { MarketLineView } from '@/components/dashboard/MarketLine'
import { marketLine } from '@/lib/market/market-line'
import { COACH_OFFER_COPY, COACH_OFFER_HREF, type CoachOfferReason } from '@/lib/coach/offer'

function Greeting({ name, line }: { name: string; line: string }) {
  return (
    <header className="space-y-1.5">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Hello, {name}</p>
      <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink text-balance">{line}</h1>
    </header>
  )
}

function Home({ name, line, journey, since, market, reason }: { name: string; line: string; journey: string; since: string; market: ReturnType<typeof marketLine>; reason: CoachOfferReason }) {
  return (
    <PreviewShell place="home" entry="today">
      <Greeting name={name} line={line} />
      <JourneyCard
        journey={journey}
        since={since}
        facts={[]}
        changes={['Your plan follows your journey and where you are in it']}
        market={<MarketLineView line={market} track={{ surface: 'home', preview: true }} />}
      />
      <CoachOfferNote reason={reason} href={COACH_OFFER_HREF} {...COACH_OFFER_COPY[reason]} />
      <Module title="This week">
        <ul className="divide-y divide-border text-base">
          {['Ask one recruiter who covers your level for a call', 'Draft your one-line positioning', 'Reconnect with two former board colleagues'].map((t) => (
            <li key={t} className="flex items-center gap-3 py-2.5"><span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />{t}</li>
          ))}
        </ul>
      </Module>
    </PreviewShell>
  )
}

export function HomeSeniorCoachOffer() {
  return <Home name="Dana" line="Know your market and your worth, and be ready to move quietly when you choose." journey="Thinking about a move" since="Exploring" market={marketLine({ open: 6, growth: null, prompt: 'too_few', senior: true })} reason="senior" />
}

export function HomeNetworkingCoachOffer() {
  return <Home name="Marcus" line="The right role, fast." journey="Laid off or let go" since="Week 6 of your search" market={marketLine({ open: 112, growth: 0.18, prompt: 'healthy', senior: false })} reason="networking" />
}

export function HomePivotCoachOffer() {
  return <Home name="Priya" line="Your first role in the new field." journey="Changing careers" since="Week 3 of your search" market={marketLine({ open: 22, growth: -0.3, prompt: 'shrinking', senior: false })} reason="pivot" />
}
