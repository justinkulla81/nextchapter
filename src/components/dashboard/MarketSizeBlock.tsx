import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { growthPhrase, type MarketPrompt } from '@/lib/market/market-size'
import type { MarketSizeView } from '@/lib/market/market-size-server'
import { aiMarketLine } from '@/lib/skills/ai-skill-market'
import type { AiMarketData } from '@/lib/skills/ai-market'
import type { AiAtWork } from '@/lib/skills/ai-at-work'
import { JobsByExposure } from '@/components/candidate/AiExposure'
import { ExposureShown } from '@/components/candidate/ExposureShown'

/** Board search results this many or more: too many to work through. */
export const SEARCH_TOO_MANY = 500
/** Fewer than this: too few to rely on. */
export const SEARCH_TOO_FEW = 10

const LINK = 'text-primary underline underline-offset-4'

/**
 * The market-size block (market-size.ts): how big the member's target market is, whether it
 * is growing or shrinking against the rest of the board, and next steps — expand to named
 * nearby areas (with counts), learn, or network. Reusable: the board's search (searchCount
 * set), Search Strategy and Market Reality.
 */
export function MarketSizeBlock({
  view,
  surface,
  searchCount,
  searchQuery,
  aiMarket,
  aiAtWork,
}: {
  view: MarketSizeView
  /** The live AI market snapshot (ai-market-live.ts); the static Oct 16 numbers when null. */
  aiMarket?: AiMarketData | null
  /** Search strategy only: the split of openings in the target field by observed AI exposure. It replaces the "AI skills" line there. */
  aiAtWork?: AiAtWork | null
  surface: 'board_search' | 'search_strategy' | 'market_reality'
  /** On the board: the search's result count, which decides the prompt there. */
  searchCount?: number
  searchQuery?: string
}) {
  const prompt: MarketPrompt =
    searchCount === undefined ? view.prompt : searchCount >= SEARCH_TOO_MANY ? 'too_many' : searchCount < SEARCH_TOO_FEW ? 'too_few' : view.prompt
  // The member's own number is the strict relevant count (relevance.ts): level, field, place and skills.
  const open = view.relevant?.count ?? view.counts.openNow
  const growth = growthPhrase(view.growth)
  // One line from the AI-skills analysis for the target's function: share asking, and the premium raw and like-for-like.
  const split = surface === 'search_strategy' ? (aiAtWork?.split ?? null) : null
  const ai = split ? null : aiMarketLine(view.target.fn, aiMarket)
  const track = (step: string, area?: string) => ({ surface, prompt, step, area, target: view.target.label, openNow: open })

  const headline =
    searchCount !== undefined && prompt === 'too_many'
      ? `Your search found ${searchCount.toLocaleString()} jobs — more than anyone can work through.`
      : searchCount !== undefined && prompt === 'too_few'
        ? `Your search found ${searchCount.toLocaleString()} job${searchCount === 1 ? '' : 's'}.`
        : prompt === 'too_many'
          ? `${open.toLocaleString()} open jobs fit you on level, field, place and skills — more than anyone can work through.`
          : prompt === 'too_few'
            ? `Only ${open.toLocaleString()} open job${open === 1 ? '' : 's'} fit you on level, field, place and skills.`
            : prompt === 'shrinking'
              ? `${open.toLocaleString()} open jobs fit you on level, field, place and skills, but this market is ${growth ?? 'shrinking'}.`
              : `${open.toLocaleString()} open jobs fit you on level, field, place and skills${growth ? ` — the market is ${growth}` : ''}.`

  // "Your market: 64 strong fits · trend +12%. Nearby: … (+18%)" — the member's own strict count and the market's trend.
  const pct = (g: number | null) => (g === null ? null : `${g >= 0 ? '+' : '−'}${Math.round(Math.abs(g) * 100)}%`)
  const nearby = view.areas.find((a) => a.growth !== null && a.openNow > 0)
  const sized =
    view.relevant?.strong !== undefined
      ? `${view.relevant.strong.toLocaleString()} strong fit${view.relevant.strong === 1 ? '' : 's'}${pct(view.growth) ? ` · trend ${pct(view.growth)}` : ''}.${nearby ? ` Nearby: ${nearby.label} (${pct(nearby.growth)})` : ''}`
      : null

  return (
    <section aria-label="Your market" className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your market</p>
        {sized && <p className="mt-1 text-base font-semibold text-foreground">{sized}</p>}
        <p className="mt-1 font-medium text-foreground">{headline}</p>
        <p className="text-xs text-muted-foreground">
          Target: {view.target.label}
          {searchQuery ? ` · search “${searchQuery}”` : ''}. {view.counts.openNow.toLocaleString()} open in this wider market; the trend compares its last 2 weeks with the 4 before.
        </p>
        {split && aiAtWork && (
          <div className="mt-3 space-y-2">
            <ExposureShown surface={surface} {...aiAtWork.event} />
            <p className="font-medium text-foreground">AI at work in your target field</p>
            <JobsByExposure split={split} label="Openings in your target field by AI exposure" />
            <TrackedLink href="/dashboard/learning" event="ai_exposure_learn_clicked" properties={{ surface, soc6: aiAtWork.event.soc6, band: aiAtWork.event.band, need: null, fn: view.target.fn }} className={LINK}>
              Find AI courses
            </TrackedLink>
          </div>
        )}
        {ai && (
          <p className="mt-1 text-xs text-muted-foreground">
            AI skills: {ai.text}{' '}
            <TrackedLink href="/dashboard/skills-assessment#tools" event="ai_market_line_clicked" properties={{ surface, fn: ai.fn, sharePct: ai.sharePct }} className={LINK}>
              Show the AI you use
            </TrackedLink>
          </p>
        )}
      </div>

      {prompt === 'too_many' && view.slices.length > 0 && (
        <div>
          <p className="font-medium text-foreground">
            {view.target.industries ? 'Narrow by the kind of work' : 'Narrow by industry'} — the biggest slices of your market
          </p>
          <ul className="mt-1 space-y-0.5">
            {view.slices.map((s) => (
              <li key={s.label}>
                <TrackedLink href={`/dashboard/find-my-job?q=${encodeURIComponent(s.label)}#job-recommendations`} event="market_size_step_clicked" properties={track('narrow_industry', s.label)} className={LINK}>
                  {s.label}
                </TrackedLink>{' '}
                <span className="text-muted-foreground">· {s.openNow.toLocaleString()} open</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.areas.length > 0 && prompt !== 'too_many' && (
        <div>
          <p className="font-medium text-foreground">{prompt === 'healthy' ? 'Nearby areas with room' : 'Expand to'}</p>
          <ul className="mt-1 space-y-0.5">
            {view.areas.map((a) => (
              <li key={a.label}>
                <TrackedLink href={a.href ?? '/dashboard/find-my-job?breadth=wide'} event="market_size_step_clicked" properties={track('expand', a.label)} className={LINK}>
                  {a.label}
                </TrackedLink>{' '}
                <span className="text-muted-foreground">
                  · {a.openNow.toLocaleString()} open
                  {a.growth !== null && Math.abs(a.growth) >= 0.1 && ` · ${a.growth > 0 ? 'growing' : 'shrinking'} ${Math.round(Math.abs(a.growth) * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {prompt !== 'healthy' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">Learn</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <TrackedLink href="/dashboard/skills-assessments" event="market_size_step_clicked" properties={track('learn_skills_gap')} className={LINK}>
                  See the skills these jobs ask for that you don&apos;t show yet
                </TrackedLink>
              </li>
              <li>
                <TrackedLink href="/dashboard/learning" event="market_size_step_clicked" properties={track('learn_courses')} className={LINK}>
                  Courses and certificates for the gap
                </TrackedLink>
              </li>
              <li>
                <TrackedLink href="/dashboard/pivot-paths" event="market_size_step_clicked" properties={track('learn_pivot_paths')} className={LINK}>
                  Pivot paths from your background
                </TrackedLink>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Network</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <TrackedLink href="/dashboard/find-my-job#job-recommendations" event="market_size_step_clicked" properties={track('network_who_to_contact')} className={LINK}>
                  Who to contact at the jobs that fit
                </TrackedLink>
              </li>
              <li>
                <TrackedLink href="/dashboard/companies" event="market_size_step_clicked" properties={track('network_companies')} className={LINK}>
                  Companies hiring, and members who worked there
                </TrackedLink>
              </li>
              <li>
                <TrackedLink href="/dashboard/network" event="market_size_step_clicked" properties={track('network_contacts')} className={LINK}>
                  Your network: who to reach out to this week
                </TrackedLink>
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
