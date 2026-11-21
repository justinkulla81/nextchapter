// "Start with" on a college demo (owner, 2026-11-21): a university doesn't have to buy for every office. A prospect picks
// which offices are on and sees the portal as it would be, and on the alum's page what each office would add by joining.
// Client-safe.

export const DEMO_START_COOKIE = 'he_demo_start'

// Always on: the alum's own view, the employer view and Admin (where the college switches things on).
export const ALWAYS_ON = ['candidate', 'employer', 'admin'] as const

export const DEMO_STARTS = [
  { key: 'all', label: 'Every office', workspaces: null },
  { key: 'career', label: 'Career center only', workspaces: ['career'] },
  { key: 'career_alumni', label: 'Career center and Alumni', workspaces: ['career', 'alumni'] },
  { key: 'advancement', label: 'Alumni and Development', workspaces: ['alumni', 'development'] },
] as const

export type DemoStartKey = (typeof DEMO_STARTS)[number]['key']
export const isDemoStartKey = (x: unknown): x is DemoStartKey => DEMO_STARTS.some((s) => s.key === x)

/** The workspaces a demo shows with this start, from those the person could open. */
export function workspacesForStart<W extends string>(all: W[], start: string | null | undefined): W[] {
  const preset = DEMO_STARTS.find((s) => s.key === start)
  if (!preset?.workspaces) return all
  const keep = new Set<string>([...ALWAYS_ON, ...preset.workspaces])
  return all.filter((w) => keep.has(w))
}
