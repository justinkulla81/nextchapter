// The sample alumni a college demo can be seen as (owner, 2026-11-21): one story each, so a prospect sees how the
// portal changes with the alum's situation. Client-safe; the server side is ./demo-alumni.ts.

export const DEMO_ALUM_COOKIE = 'he_demo_alum'

export const DEMO_ALUMNI = [
  { key: 'featured', label: 'Weighing a move' },
  { key: 'laid_off', label: 'Laid off' },
  { key: 'changing', label: 'Changing fields' },
  { key: 'manager', label: 'New manager' },
  { key: 'newgrad', label: 'Recent graduate' },
] as const

export type DemoAlumKey = (typeof DEMO_ALUMNI)[number]['key']
export const isDemoAlumKey = (x: unknown): x is DemoAlumKey => DEMO_ALUMNI.some((a) => a.key === x)
