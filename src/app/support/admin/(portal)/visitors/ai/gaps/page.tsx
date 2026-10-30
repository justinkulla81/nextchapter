import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { monthlyCapUsd, OUR_DOMAIN } from '@/lib/ai-visibility/run'
import { PROVIDERS } from '@/lib/ai-visibility/providers'
import { CITATION_PROMPTS, GROUP_LABEL } from '@/lib/ai-visibility/prompts'
import { GENERAL_PER_RUN } from '@/lib/ai-visibility/prompts-data'
import { buildGapReport, fullRunCostUsd, GAP_WINDOW_DAYS, pct } from '@/lib/ai-visibility/gaps'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

function now(): Date {
  return new Date()
}

export default async function CitationGapsPage() {
  await requireAdmin()
  const since = new Date(now().getTime() - GAP_WINDOW_DAYS * 86_400_000)
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [rows, spent] = await Promise.all([
    prisma.aiCitationResult.findMany({ where: { createdAt: { gte: since } }, select: { provider: true, promptKey: true, cited: true, mentioned: true, error: true, citedDomains: true, createdAt: true } }),
    prisma.aiCitationResult.aggregate({ _sum: { estCostUsd: true }, where: { createdAt: { gte: monthStart } } }),
  ])
  const report = buildGapReport(rows, OUR_DOMAIN, now())
  const live = PROVIDERS.filter((p) => p.enabled())
  const perQuestion = fullRunCostUsd(live, 1)
  const cap = monthlyCapUsd()
  const weekly = perQuestion * GENERAL_PER_RUN
  const s = report.share
  const asked = report.statuses.length - report.notAsked

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm"><Link href="/support/admin/visitors/ai" className="text-brand underline underline-offset-4">AI assistants</Link></p>
        <h1 className="mt-1 text-2xl font-semibold">Citation gaps</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          For each of the {CITATION_PROMPTS.length} questions people ask AI assistants about job search, career change and layoffs, and résumés and interviews: whether {OUR_DOMAIN} was cited or NextChapter named, and who was cited instead. Uses each assistant’s newest answer from the last {GAP_WINDOW_DAYS} days. {asked} of {report.statuses.length} questions have been asked so far.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium">Baseline share</h2>
        <p className="mt-1 text-sm text-muted-foreground">Share of assistant answers that cite {OUR_DOMAIN} or name NextChapter.</p>
        {s.answers === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No answers yet.</p>
        ) : (
          <table className="mt-2 w-full max-w-3xl text-sm">
            <thead><tr className="text-left"><th>Assistant</th><th>Answers</th><th>Cited</th><th>Named</th><th>Cited or named</th></tr></thead>
            <tbody>
              {s.byProvider.map((p) => (
                <tr key={p.provider}><td>{p.provider}</td><td>{p.answers}</td><td>{p.cited} ({pct(p.cited, p.answers)})</td><td>{p.mentioned} ({pct(p.mentioned, p.answers)})</td><td>{p.present} ({pct(p.present, p.answers)})</td></tr>
              ))}
              <tr className="font-medium"><td>All</td><td>{s.answers}</td><td>{s.cited} ({pct(s.cited, s.answers)})</td><td>{s.mentioned} ({pct(s.mentioned, s.answers)})</td><td>{s.present} ({pct(s.present, s.answers)})</td></tr>
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium">What a run costs</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Per question, across the {live.length} live assistants ({live.map((p) => p.id).join(', ') || 'none'}): about ${perQuestion.toFixed(3)}.</li>
          <li>All {CITATION_PROMPTS.length} questions once: about ${fullRunCostUsd(live, CITATION_PROMPTS.length).toFixed(2)}. That is more than the monthly cap of ${cap}, so a full pass is not run in one go.</li>
          <li>The weekly run asks {GENERAL_PER_RUN} of them plus the week’s filing questions: about ${weekly.toFixed(2)} for the general ones. The list is covered in {Math.ceil(CITATION_PROMPTS.length / GENERAL_PER_RUN)} weeks.</li>
          <li>Spent this month: ${Number(spent._sum.estCostUsd ?? 0).toFixed(2)} of the ${cap} cap.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Gaps ({report.gaps.length} questions where we are absent)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sorted by how many assistants miss us. {report.notAsked} questions have no answer yet and are not listed.</p>
        {report.gaps.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No gaps in the answers collected so far.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left align-bottom"><th className="pr-3">Question</th><th className="pr-3">Group</th><th className="pr-3">Missing us</th><th className="pr-3">Cited instead</th><th>Page brief</th></tr></thead>
            <tbody>
              {report.gaps.map((g) => (
                <tr key={g.key} className="border-t align-top">
                  <td className="py-2 pr-3">{g.prompt}</td>
                  <td className="py-2 pr-3">{GROUP_LABEL[g.group]}</td>
                  <td className="py-2 pr-3">{g.missedBy.length} of {g.answered.length}: {g.missedBy.join(', ')}</td>
                  <td className="py-2 pr-3">{g.rivals.join(', ') || 'none sourced'}</td>
                  <td className="py-2">{g.page ? <a href={g.page} className="text-brand underline underline-offset-4">{g.page}</a> : null} {g.brief}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
