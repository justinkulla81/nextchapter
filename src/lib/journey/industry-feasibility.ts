// How hard is a move into a different industry, keeping your function? Pure and
// client-safe. Usually much easier than changing function: Finance is Finance in
// retail and in software. The exception is a regulated industry, where the rules
// are part of the job. If the member has worked in the industry before (Track
// Record sector history), it is a head start. Industry names come from the same
// buckets the community uses (src/lib/constants/industry-buckets.ts).

import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'

export type IndustryTier = 'SAME' | 'EASY' | 'DOMAIN' | 'REGULATED'

const REGULATED = new Set([
  'Healthcare & Hospital Systems',
  'Pharmaceuticals & Biotech',
  'Medical Devices',
  'Financial Services & Banking',
  'Insurance',
  'Legal Services',
  'Aerospace & Defense',
  'Energy & Utilities',
  'Government & Public Sector',
  'Education & EdTech',
])

// Functions that carry over into any industry with little change.
const PORTABLE = new Set(['Finance', 'Human Resources', 'Administration', 'Legal', 'Data & Analytics', 'Engineering', 'Design'])

const DOMAIN_LEARNING: Record<string, string[]> = {
  'Healthcare & Hospital Systems': ['Learn the basics of HIPAA and how hospitals are paid', 'Talk to two people who work in a health system'],
  'Pharmaceuticals & Biotech': ['Learn the outline of FDA regulation and quality (GxP)', 'Learn how a drug moves from trial to market'],
  'Medical Devices': ['Learn the outline of FDA device regulation', 'Learn how hospitals buy devices'],
  'Financial Services & Banking': ['Learn the regulators and rules that apply to your role (SEC, FINRA, banking)', 'Learn the products and how the firm makes money'],
  Insurance: ['Learn how underwriting, claims and reserves work', 'Learn the state regulation outline'],
  'Legal Services': ['Learn how law firms bill and staff matters'],
  'Aerospace & Defense': ['Learn the procurement and security-clearance basics', 'Check which roles need a clearance and whether you qualify'],
  'Energy & Utilities': ['Learn how rates and regulation work', 'Learn the safety culture'],
  'Government & Public Sector': ['Learn how public procurement and hiring work', 'Check eligibility rules and timelines for applying'],
  'Education & EdTech': ['Learn how schools or universities are funded', 'Talk to two people who work in education'],
}

export type IndustryMove = {
  to: string
  bucket: string | null
  tier: IndustryTier
  headline: string
  detail: string
  learn: string[]
}

export function assessIndustryMove(
  fromText: string | null,
  toText: string,
  fn: string | null,
  opts: { sectorHistory?: string[] } = {},
): IndustryMove {
  const from = fromText ? normalizeIndustryBucket(fromText) : null
  const to = normalizeIndustryBucket(toText)
  // Track Record uses short sector names; match them loosely against the bucket name.
  const worked = (opts.sectorHistory ?? []).some((s) => !!to && to.toLowerCase().includes(s.toLowerCase().replace(/_/g, ' ')))
  if (!to) return { to: toText, bucket: null, tier: 'EASY', headline: 'Your function carries over', detail: 'We could not place this industry, so we cannot say more than that.', learn: [] }
  if (from && from === to) return { to: toText, bucket: to, tier: 'SAME', headline: 'Your current industry', detail: 'Nothing to bridge.', learn: [] }
  if (worked) return { to: toText, bucket: to, tier: 'EASY', headline: 'You have worked in this industry', detail: 'Say so in your pitch. It is a head start.', learn: [] }
  const regulated = REGULATED.has(to)
  if (!regulated) return { to: toText, bucket: to, tier: 'EASY', headline: 'An easy move', detail: `${fn ?? 'Your function'} works much the same here. Learn the vocabulary and the customers and you are ready to apply.`, learn: ['Read the trade press for two weeks and write down the terms you do not know', 'Ask two people in the industry what is different'] }
  if (fn && PORTABLE.has(fn)) return { to: toText, bucket: to, tier: 'DOMAIN', headline: 'Your function carries over; the rules need learning', detail: `${to} has its own regulation. ${fn} roles travel well, but expect to be asked what you know about it.`, learn: DOMAIN_LEARNING[to] ?? [] }
  return { to: toText, bucket: to, tier: 'REGULATED', headline: 'Regulated, and the domain matters in your role', detail: `${to} roles in ${fn ?? 'your function'} usually ask for experience with the rules. Plan on learning them, and consider a first role at a vendor, supplier or adjacent employer.`, learn: DOMAIN_LEARNING[to] ?? [] }
}
