// The report's time window: 90 days, 365 days or all time (the default).
export type SkillsMatchWindow = '90' | '365' | 'all'
export const WINDOWS: { key: SkillsMatchWindow; label: string }[] = [
  { key: '90', label: 'Last 90 days' },
  { key: '365', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
]
export function parseWindow(raw: string | null | undefined): SkillsMatchWindow {
  return raw === '90' || raw === '365' ? raw : 'all'
}
export function windowSince(w: SkillsMatchWindow): Date | undefined {
  return w === 'all' ? undefined : new Date(Date.now() - Number(w) * 86_400_000)
}
