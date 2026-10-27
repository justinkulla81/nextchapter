import { Section, LINK } from '@/components/topics/blocks'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { PREMIUM_METHOD, aiPremiumForFunction, aiPremiumSentence } from '@/lib/pay/ai-premium'

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/**
 * "Do AI skills change <title> pay?" on a salary page. Shown only when the title belongs to a function (a clear majority of its
 * listings are tagged with it) and that function's premium rests on 30 or more paid postings on each side. It is the function's
 * premium, not a per-title one: a single title almost never has 30 paid postings on both sides, and the block says so. The
 * snapshot is held on the server instance for 30 minutes, so this adds no query per page.
 */
export async function AiPremiumSection({ title, slug, fn }: { title: string; slug: string; fn: string | null | undefined }) {
  const p = aiPremiumForFunction(await loadAiMarket(), fn)
  if (!p) return null
  const asOf = new Date(p.asOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const properties = { page: 'salary', title: slug, fn: p.fn }

  return (
    <Section
      id="ai-skills"
      title={`Do AI skills change ${title.toLowerCase()} pay?`}
      note={`For ${p.label} roles in general, as of ${asOf}. This is the function’s figure, not one for ${title.toLowerCase()} alone: one title rarely has enough listings on both sides.`}
    >
      <p className="max-w-3xl text-base text-navy">{aiPremiumSentence(p)}</p>
      <dl className="mt-4 grid max-w-2xl grid-cols-2 gap-4 text-center">
        <div className="rounded-xl border border-border bg-white p-5">
          <dt className="text-xs text-muted-foreground">Listings that ask for an AI skill</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-navy">{usd(p.medAi)}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">median, from {p.nAi.toLocaleString('en-US')} paid listings</dd>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <dt className="text-xs text-muted-foreground">Listings that never mention AI</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-navy">{usd(p.medBase)}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">median, from {p.nBase.toLocaleString('en-US')} paid listings</dd>
        </div>
      </dl>
      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        {PREMIUM_METHOD} A difference in what is advertised is not a promise of what you would be paid, and it does not show that learning a skill causes a raise.
      </p>
      <p className="mt-3 text-sm">
        <TrackedLink href="/resources/ai-skills-pay-premium" event="ai_pay_link_clicked" properties={{ ...properties, cta: 'explainer' }} className={LINK}>
          See the AI-skill pay table for every function
        </TrackedLink>
        {' · '}
        <TrackedLink href="/tools/pay-check" event="ai_pay_link_clicked" properties={{ ...properties, cta: 'pay_check' }} className={LINK}>
          Check your own pay against these listings
        </TrackedLink>
      </p>
    </Section>
  )
}
