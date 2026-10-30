/** The "Date added" filter shared by the People and Organizations lists. */
export const ADDED_OPTIONS = [
  { value: '', label: 'Any date added' },
  { value: 'today', label: 'Added today' },
  { value: '7d', label: 'Added in the last 7 days' },
  { value: '30d', label: 'Added in the last 30 days' },
]

export function readAdded(v: string | undefined): string {
  return v === 'today' || v === '7d' || v === '30d' ? v : ''
}

/** Start of the window for an `added` value; today means since local midnight. */
export function addedSince(v: string): Date {
  const d = new Date()
  if (v === 'today') { d.setHours(0, 0, 0, 0); return d }
  d.setDate(d.getDate() - (v === '7d' ? 7 : 30))
  return d
}

export const addedLabel = (when: Date) => when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
