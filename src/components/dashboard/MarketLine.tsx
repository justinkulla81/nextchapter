import { after } from 'next/server'
import { loadMarketSize, type MarketMember } from '@/lib/market/market-size-server'
import { marketLine, type MarketLine as MarketLineData } from '@/lib/market/market-line'
import { seniorMember } from '@/lib/coach/seniority'
import { captureServerEvent } from '@/lib/posthog/server'
import { TrackedLink } from '@/components/dashboard/TrackedLink'

/**
 * The member's market in one line (market-line.ts): how many advertised roles fit, where it is heading, and the
 * one next step the number points to. Shown to every member with a target field, on Home inside the journey card
 * and at the top of the board. Nothing when there is no target or no stats yet. Wrap in Suspense.
 */
export async function MarketLine({ member, surface }: { member: MarketMember & { id: string; highestLevelReached?: string | null }; surface: 'home' | 'board' }) {
  // The stat rows are held in memory per server instance (market-size-server.ts), so this and the coach offer's own read are cheap.
  const view = await loadMarketSize(member).catch(() => null)
  if (!view) return null
  const senior = seniorMember(member)
  const line = marketLine({ open: view.counts.openNow, growth: view.growth, prompt: view.prompt, senior })
  after(() => captureServerEvent(member.id, 'market_line_shown', { surface, prompt: view.prompt, open: view.counts.openNow, step: line.step.kind, senior }))
  return <MarketLineView line={line} track={{ surface, prompt: view.prompt, open: view.counts.openNow, senior }} />
}

/** The line's markup, shared with the dev-preview so what is reviewed is what ships. */
export function MarketLineView({ line, track }: { line: MarketLineData; track: Record<string, unknown> }) {
  return (
    <div className="space-y-1 rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink" aria-label="Your market">
      <p>
        <span className="font-semibold">Your market.</span> {line.text} <span className="text-muted-foreground">{line.why}</span>
      </p>
      <TrackedLink href={line.step.href} event="market_line_step_clicked" properties={{ ...track, step: line.step.kind }} className="font-medium text-brand underline underline-offset-4">
        {line.step.label}
      </TrackedLink>
    </div>
  )
}
