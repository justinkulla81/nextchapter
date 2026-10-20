import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { premiumPhrase } from '@/lib/skills/ai-market'

/** 27,743 -> "27,700+": a floor, so the public number is never above the live count. */
export function publicCount(n: number): string {
  if (n < 1000) return n.toLocaleString('en-US')
  return `${(Math.floor(n / 100) * 100).toLocaleString('en-US')}+`
}

/**
 * The public AI-jobs number from the live board snapshot (ai-market-live.ts, recomputed daily).
 * "AI-skill jobs" = open jobs whose posting asks for a specific AI skill (the strict metric).
 * The b2b variant adds the broader AI-exposed count and the posted-pay premium, raw and
 * like-for-like together. Nothing renders before the first snapshot.
 */
export async function AiJobsStat({ variant = 'home' }: { variant?: 'home' | 'b2b' }) {
  const live = await loadAiMarket()
  if (!live || live.counts.aiSkill <= 0) return null
  const premium = premiumPhrase(live.overall, 'same function, level and industry')
  return (
    <section className="bg-white pb-12" aria-labelledby={`ai-jobs-stat-${variant}`}>
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p id={`ai-jobs-stat-${variant}`} className="font-display text-2xl font-semibold tracking-tight text-ink">
          {publicCount(live.counts.aiSkill)} AI-skill jobs, refreshed daily
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Open jobs on our board whose posting asks for a specific AI skill, such as using AI tools in the work, building with LLMs, or AI governance.
          {variant === 'b2b' && (
            <>
              {' '}
              {publicCount(live.counts.aiExposed)} open jobs involve AI in the role more broadly (an AI title, AI tools named, or AI in a data role).
              {premium && <> Where a posting asks for an AI skill, {premium}. Posted pay ranges only.</>}
            </>
          )}
        </p>
      </div>
    </section>
  )
}
