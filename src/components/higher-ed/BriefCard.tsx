import { latestBrief } from '@/lib/staff-agents/briefing-run'
import type { BriefAgent } from '@/lib/staff-agents/briefing'

// This week's brief from the staff agent for a workspace: counts, what to do, and a draft note staff can send themselves.
// Renders nothing when no brief exists (the agent is off for this organization, or nothing changed).
export async function BriefCard({ institutionId, agent }: { institutionId: string; agent: BriefAgent }) {
  const brief = await latestBrief(institutionId, agent)
  if (!brief) return null
  return (
    <section aria-label="This week’s brief" className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">{brief.title}</h2>
      <p className="whitespace-pre-wrap text-sm">{brief.body}</p>
    </section>
  )
}
