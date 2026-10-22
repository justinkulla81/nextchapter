import { Fragment } from 'react'
import { requireAdmin } from '@/lib/admin/auth'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { AI_LEVELS, AI_LEVEL_LABEL, asOfText, premiumPhrase, type AiPremium } from '@/lib/skills/ai-market'
import { aiSkillItem } from '@/lib/skills/ai-skills'

export const dynamic = 'force-dynamic'

const usd = (n: number) => `$${Math.round(n / 1000)}k`
const pct = (n: number | undefined) => (n === undefined ? '—' : `${n > 0 ? '+' : ''}${n}%`)

function PremiumCells({ p }: { p?: AiPremium }) {
  if (!p) return <td className="px-2 py-1 text-muted-foreground" colSpan={4}>too few paid postings (under 30 a side)</td>
  return (
    <>
      <td className="px-2 py-1 whitespace-nowrap">{usd(p.medAi)} vs {usd(p.medBase)}</td>
      <td className="px-2 py-1">{pct(p.rawPct)}</td>
      <td className="px-2 py-1">{p.likePct === undefined ? '—' : `${pct(p.likePct)} (${usd(p.likeUsd ?? 0)})`}</td>
      <td className="px-2 py-1 whitespace-nowrap">{p.nAi.toLocaleString()} / {p.nBase.toLocaleString()}</td>
    </>
  )
}

/**
 * The two AI metrics and the live AI pay premium (ai-market-live.ts), for the admin and the B2B
 * pitch. Use "AI-skill jobs" for public claims; "AI-in-role" (the aiExposed column) is the broader, labelled
 * count — renamed on screen 2026-10-22 so it is not confused with AI exposure from the Anthropic Economic Index.
 */
export default async function AiMarketAdminPage() {
  await requireAdmin()
  const live = await loadAiMarket()
  if (!live) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">AI jobs and pay</h1>
        <p className="text-sm">No snapshot yet. The ai-market cron computes one daily; run it from Background job health.</p>
      </div>
    )
  }
  const c = live.counts
  const fns = Object.entries(live.functions).sort((a, b) => b[1].aiSkill - a[1].aiSkill)
  const overall = premiumPhrase(live.overall, 'same function, level and industry')
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">AI jobs and pay</h1>
        <p className="text-sm text-muted-foreground">Live board snapshot, {asOfText(live.asOf)}. Recomputed daily after the crawler import.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="AI job counts">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">AI-skill jobs (use this one in public claims)</p>
          <p className="text-3xl font-semibold">{c.aiSkill.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            Ask for a specific AI skill (24 items, boilerplate filtered, about 86% precision hand-checked). {((100 * c.aiSkill) / Math.max(1, c.live)).toFixed(1)}% of {c.live.toLocaleString()} live jobs;{' '}
            {((100 * c.aiSkillFullText) / Math.max(1, c.fullText)).toFixed(1)}% of the {c.fullText.toLocaleString()} read from a full description.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">AI-in-role jobs (broader; always say what it means)</p>
          <p className="text-3xl font-semibold">{c.aiExposed.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            Not the board&apos;s &quot;AI exposure (Anthropic Economic Index)&quot;, which measures AI use on the occupation&apos;s tasks.{' '}
            A specific AI skill, an AI/ML term in the title, a data &amp; AI role whose role text mentions AI, or an AI tool named in the role text.{' '}
            {((100 * c.aiExposed) / Math.max(1, c.live)).toFixed(1)}% of live jobs; {((100 * c.aiExposedFullText) / Math.max(1, c.fullText)).toFixed(1)}% of full-text jobs.
          </p>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Text the AI fields were read from: own full description {(c.fullText - c.twin).toLocaleString()}, the same role&apos;s full text at a direct source {c.twin.toLocaleString()},
        excerpt only {c.excerpt.toLocaleString()} (title and excerpt rules; skill asks may be missed), not read yet {c.unread.toLocaleString()}.
      </p>

      {overall && (
        <p className="text-sm">
          <span className="font-medium">Pay, all functions:</span> where a posting asks for an AI skill, {overall}. Posted pay ranges only; compared with full-text postings
          that mention no AI. Cross-sectional: it shows which roles and employers pay more, not that adding AI to the same job raises pay.
        </p>
      )}

      <section className="space-y-2" aria-labelledby="ai-pay-table">
        <h2 id="ai-pay-table" className="text-lg font-semibold">Pay premium by function and level</h2>
        <p className="text-xs text-muted-foreground">
          Raw = median vs median. Like-for-like = within the same level and industry (function rows) or industry (level rows), cells with 30+ paid postings on both sides.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-2 py-1">Function / level</th>
                <th className="px-2 py-1">AI share</th>
                <th className="px-2 py-1">Median AI vs no-AI</th>
                <th className="px-2 py-1">Raw</th>
                <th className="px-2 py-1">Like-for-like</th>
                <th className="px-2 py-1">n AI / no-AI</th>
              </tr>
            </thead>
            <tbody>
              {fns.map(([code, f]) => (
                <Fragment key={code}>
                  <tr className="border-t border-border font-medium">
                    <td className="px-2 py-1">{f.label}</td>
                    <td className="px-2 py-1">{f.sharePct}% ({f.aiSkill.toLocaleString()})</td>
                    <PremiumCells p={f.premium} />
                  </tr>
                  {AI_LEVELS.filter((l) => f.levels[l]).map((l) => (
                    <tr key={`${code}-${l}`} className="text-muted-foreground">
                      <td className="px-2 py-1 pl-6">{AI_LEVEL_LABEL[l]}</td>
                      <td className="px-2 py-1" />
                      <PremiumCells p={f.levels[l]} />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="ai-top-skills">
        <h2 id="ai-top-skills" className="text-lg font-semibold">What each function asks for</h2>
        <ul className="space-y-2 text-sm">
          {fns.filter(([, f]) => f.topItems.length > 0).map(([code, f]) => (
            <li key={code}>
              <span className="font-medium">{f.label}:</span> {f.topItems.slice(0, 5).map((i) => `${aiSkillItem(i.id)?.label ?? i.id} (${i.n.toLocaleString()})`).join(' · ')}
              {f.topTools.length > 0 && <span className="text-muted-foreground"> — tools: {f.topTools.slice(0, 5).map((t) => `${t.name} (${t.n.toLocaleString()})`).join(', ')}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
