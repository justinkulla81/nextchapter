import { requireAdmin, ADMIN_NOTIFICATION_EMAIL } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from '@/lib/senior-brief/draft'
import { weeklyCeiling } from '@/lib/senior-brief/rules'
import { TestSendForm } from './TestSendForm'

export const dynamic = 'force-dynamic'

const WEEKS = 8

export default async function SeniorBriefAdminPage() {
  await requireAdmin()
  const enabled = process.env.SENIOR_BRIEF_ENABLED === 'true'
  const ceiling = weeklyCeiling(process.env.SENIOR_BRIEF_WEEKLY_CEILING)

  const since = new Date(startOfWeek(new Date()).getTime() - (WEEKS - 1) * 7 * 86_400_000)
  let rows: { weekKey: string; candidateId: string; status: string; estCostUsd: number; inputTokens: number; outputTokens: number; openedAt: Date | null; itemKind: string }[] | null = null
  try {
    rows = await prisma.seniorBriefDraft.findMany({
      where: { isTest: false, createdAt: { gte: since } },
      select: { weekKey: true, candidateId: true, status: true, estCostUsd: true, inputTokens: true, outputTokens: true, openedAt: true, itemKind: true },
    })
  } catch (e) {
    console.error('Senior brief admin failed to load', e)
  }

  const byWeek = new Map<string, { drafts: number; members: Set<string>; cost: number; inTok: number; outTok: number; emailed: number; opened: number }>()
  for (const r of rows ?? []) {
    const w = byWeek.get(r.weekKey) ?? { drafts: 0, members: new Set<string>(), cost: 0, inTok: 0, outTok: 0, emailed: 0, opened: 0 }
    w.drafts += 1
    w.members.add(r.candidateId)
    w.cost += r.estCostUsd
    w.inTok += r.inputTokens
    w.outTok += r.outputTokens
    if (r.status === 'EMAILED') w.emailed += 1
    if (r.openedAt) w.opened += 1
    byWeek.set(r.weekKey, w)
  }
  const weeks = [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const total = weeks.reduce((s, [, w]) => s + w.cost, 0)
  const totalMembers = new Set((rows ?? []).map((r) => r.candidateId)).size

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Senior Monday brief</h1>
        <p className="text-sm" role="status">
          {enabled ? 'On.' : 'Off.'} Set <code>SENIOR_BRIEF_ENABLED=true</code> to send it on Mondays. Weekly ceiling: {ceiling} drafts (<code>SENIOR_BRIEF_WEEKLY_CEILING</code>). One draft per member per 6 days, always.
        </p>
      </div>

      {rows === null ? (
        <p className="text-sm">The draft table could not be loaded. Apply <code>prisma/manual/senior-brief.sql</code> and reload.</p>
      ) : weeks.length === 0 ? (
        <p className="text-sm">No drafts yet. Send yourself a test below.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Drafts, members and estimated model cost by week</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-4">Week of</th>
                <th scope="col" className="py-2 pr-4">Drafts</th>
                <th scope="col" className="py-2 pr-4">Members</th>
                <th scope="col" className="py-2 pr-4">Emailed</th>
                <th scope="col" className="py-2 pr-4">Opened</th>
                <th scope="col" className="py-2 pr-4">Tokens in / out</th>
                <th scope="col" className="py-2 pr-4">Est. cost</th>
                <th scope="col" className="py-2 pr-4">Per member</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(([week, w]) => (
                <tr key={week}>
                  <th scope="row" className="py-2 pr-4 font-medium">{week}</th>
                  <td className="py-2 pr-4">{w.drafts}</td>
                  <td className="py-2 pr-4">{w.members.size}</td>
                  <td className="py-2 pr-4">{w.emailed}</td>
                  <td className="py-2 pr-4">{w.opened}</td>
                  <td className="py-2 pr-4">{w.inTok.toLocaleString()} / {w.outTok.toLocaleString()}</td>
                  <td className="py-2 pr-4">${w.cost.toFixed(4)}</td>
                  <td className="py-2 pr-4">${(w.cost / Math.max(1, w.members.size)).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pt-2 text-sm">
            Last {WEEKS} weeks: {totalMembers} members, ${total.toFixed(4)} estimated at Claude Haiku 4.5 list price. Test sends are not counted.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Review the first one</h2>
        <TestSendForm adminEmail={ADMIN_NOTIFICATION_EMAIL} />
      </section>
    </div>
  )
}
