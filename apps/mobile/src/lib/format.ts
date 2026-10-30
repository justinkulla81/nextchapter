export const usd = (n: number) => `$${n.toLocaleString('en-US')}`
export function pay(min: number | null, max: number | null): string | null {
  const k = (n: number) => `$${Math.round(n / 1000)}k`
  if (min && max) return `${k(min)}–${k(max)}`
  if (min) return `From ${k(min)}`
  if (max) return `Up to ${k(max)}`
  return null
}
export function ago(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 30 ? `${days} days ago` : `${Math.floor(days / 30)} mo ago`
}
