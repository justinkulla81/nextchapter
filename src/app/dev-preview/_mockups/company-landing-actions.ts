'use server'

import type { JourneyState } from '@/lib/leads/actions'

// Stand-ins for the company-page preview: nothing is saved or sent.
export async function previewLead(_prev: JourneyState, formData: FormData): Promise<JourneyState> {
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.', email }
  await new Promise((r) => setTimeout(r, 500))
  return { done: true, email }
}

const SAMPLE = [
  { id: 'uw', name: 'University of Washington', place: 'Seattle, WA', path: '/higher-education/washington' },
  { id: 'seattleu', name: 'Seattle University', path: null, place: 'Seattle, WA' },
  { id: 'bellevue', name: 'Bellevue College', path: null, place: 'Bellevue, WA' },
  { id: 'wgu', name: 'Western Governors University', path: null, place: 'Online' },
  { id: 'ul', name: 'University of Louisville', path: null, place: 'Louisville, KY' },
  { id: 'umich', name: 'University of Michigan', path: null, place: 'Ann Arbor, MI' },
]
export async function previewSchools(q: string) {
  const s = q.toLowerCase()
  return SAMPLE.filter((x) => x.name.toLowerCase().includes(s))
}
