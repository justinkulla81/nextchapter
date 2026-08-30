// Pure, zero-dependency (safe for client AND server use) — deliberately
// split out of access-gate.ts, which imports prisma and is not safe to pull
// into a client bundle. This matters because the exemption check moved from
// a server-side headers()-based pathname read (unreliable — see
// HardGateGate.tsx for why) to usePathname() inside a client component,
// which needs to import this function directly without dragging prisma
// along with it.

// Paths that must stay reachable at every gate stage — the gate's own
// required pages, the pages needed to satisfy it, and account-level actions
// that must never be blocked (settings/logout/support). Prefix-matched
// against the pathname.
export const GATE_EXEMPT_PATH_PREFIXES = [
  '/dashboard/search-strategy',
  '/dashboard/skills-assessment', // singular quiz route
  '/dashboard/skills-assessments', // hub route
  '/dashboard/network', // Gmail/Calendar connect prompt + LinkedIn CSV import both live here
  '/dashboard/profile',
  '/dashboard/settings',
  '/dashboard/support',
  // Resume upload/analysis and the guided walkthrough happen naturally
  // before a candidate has settled on a Search Strategy, not after — and
  // the resume itself often informs what they put in Search Strategy.
  // Gating it behind Search Strategy completion had it backwards.
  '/dashboard/resume',
  // A gated candidate must be able to view their own already-generated
  // report — it was missing from this list entirely, silently blocking a
  // candidate from seeing their own Market Reality Report before they'd
  // cleared the hard gate. Fixed alongside §12's Unified dashboard work
  // (the report is also one of that section's "always unlocked" items).
  '/dashboard/market-reality',
]

export function isGateExemptPath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    GATE_EXEMPT_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  )
}
