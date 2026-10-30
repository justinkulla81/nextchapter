// Whether the agent-delivered outplacement runs at all. OFF by default: it makes metered model calls for each activated seat,
// so it stays off until the owner has approved the cost model (docs/OUTPLACEMENT_AGENT.md) and sets OUTPLACEMENT_AGENT_ENABLED=on
// in Vercel production. Off means no cron work, no model calls and nothing shown on the member's This week page.

export function isOutplacementAgentOn(env: Record<string, string | undefined> = process.env): boolean {
  return (env.OUTPLACEMENT_AGENT_ENABLED ?? '').trim().toLowerCase() === 'on'
}
