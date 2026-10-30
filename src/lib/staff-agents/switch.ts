// Whether the staff agents (rapid response, and the audience agents that follow, docs/STAFF_AGENTS.md) run at all. OFF by default: each
// agent makes metered model calls per customer organization. Set STAFF_AGENTS_ENABLED=on in Vercel production once the owner has
// approved the cost model. Even then an agent only runs for an organization that has it switched on in enabledFeatures.agents.

export function isStaffAgentsOn(env: Record<string, string | undefined> = process.env): boolean {
  return (env.STAFF_AGENTS_ENABLED ?? '').trim().toLowerCase() === 'on'
}

export type StaffAgentKey = 'rapidResponse' | 'careerServices'

/** True when the organization's enabledFeatures turns this agent on. Anything not stored is off. */
export function agentSwitchedOn(enabledFeatures: unknown, key: StaffAgentKey): boolean {
  const agents = enabledFeatures && typeof enabledFeatures === 'object' ? (enabledFeatures as { agents?: unknown }).agents : null
  return !!agents && typeof agents === 'object' && (agents as Record<string, unknown>)[key] === true
}
