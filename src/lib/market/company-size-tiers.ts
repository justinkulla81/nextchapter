// Curated starter list of well-known companies' approximate employee-count
// band, checked BEFORE the cache/LLM path in company-size.ts — matched via
// normalizeOrgName() at lookup time (src/lib/text/org-name-match.ts), same
// dedup convention as WorkHistoryEntry.companyNameNormalized. These never
// cost an LLM call and never drift once someone spot-checks a number here.
// Meant to grow over time, same "expand it, not exhaustive on day one"
// spirit as ATS_COMPANIES (ats-companies.ts) — several entries below
// deliberately overlap with that list, since ats-job-board-feed.ts resolves
// a size band for every company in it.

import type { CompanySizeBand } from '@prisma/client'

export interface CompanySizeTier {
  name: string
  sizeBand: CompanySizeBand
}

export const COMPANY_SIZE_TIERS: CompanySizeTier[] = [
  // Mega (100,000+) — the extreme end that makes "VP at Google" the
  // headline example this whole feature exists to handle correctly.
  { name: 'Google', sizeBand: 'MEGA' },
  { name: 'Alphabet', sizeBand: 'MEGA' },
  { name: 'Amazon', sizeBand: 'MEGA' },
  { name: 'Microsoft', sizeBand: 'MEGA' },
  { name: 'Apple', sizeBand: 'MEGA' },
  { name: 'Meta', sizeBand: 'MEGA' },
  { name: 'Facebook', sizeBand: 'MEGA' },
  { name: 'Walmart', sizeBand: 'MEGA' },
  { name: 'IBM', sizeBand: 'MEGA' },
  { name: 'Accenture', sizeBand: 'MEGA' },
  { name: 'JPMorgan Chase', sizeBand: 'MEGA' },
  { name: 'Deloitte', sizeBand: 'MEGA' },

  // Enterprise (20,001-100,000)
  { name: 'Salesforce', sizeBand: 'ENTERPRISE' },
  { name: 'Adobe', sizeBand: 'ENTERPRISE' },
  { name: 'Netflix', sizeBand: 'ENTERPRISE' },
  { name: 'Uber', sizeBand: 'ENTERPRISE' },
  { name: 'Goldman Sachs', sizeBand: 'ENTERPRISE' },
  { name: 'Nike', sizeBand: 'ENTERPRISE' },
  { name: 'Cisco', sizeBand: 'ENTERPRISE' },
  { name: 'Lyft', sizeBand: 'ENTERPRISE' },
  { name: 'Reddit', sizeBand: 'ENTERPRISE' },

  // Large (5,001-20,000)
  { name: 'Airbnb', sizeBand: 'LARGE' },
  { name: 'Palantir', sizeBand: 'LARGE' },
  { name: 'Datadog', sizeBand: 'LARGE' },
  { name: 'Cloudflare', sizeBand: 'LARGE' },
  { name: 'Robinhood', sizeBand: 'LARGE' },
  { name: 'Pinterest', sizeBand: 'LARGE' },
  { name: 'Stripe', sizeBand: 'LARGE' },
  { name: 'Coinbase', sizeBand: 'LARGE' },
  { name: 'Dropbox', sizeBand: 'LARGE' },
  { name: 'Discord', sizeBand: 'LARGE' },
  { name: 'Databricks', sizeBand: 'LARGE' },
  { name: 'Instacart', sizeBand: 'LARGE' },

  // Mid-large (1,001-5,000)
  { name: 'Asana', sizeBand: 'MID_LARGE' },
  { name: 'Notion', sizeBand: 'MID_LARGE' },
  { name: 'Figma', sizeBand: 'MID_LARGE' },
  { name: 'Brex', sizeBand: 'MID_LARGE' },
  { name: 'Gusto', sizeBand: 'MID_LARGE' },
  { name: 'Affirm', sizeBand: 'MID_LARGE' },
  { name: 'Duolingo', sizeBand: 'MID_LARGE' },
  { name: 'MongoDB', sizeBand: 'MID_LARGE' },
  { name: 'Webflow', sizeBand: 'MID_LARGE' },
  { name: 'OpenAI', sizeBand: 'MID_LARGE' },
  { name: 'Roblox', sizeBand: 'MID_LARGE' },

  // Small-mid / small — deliberately sparse here: well-known small/growth
  // companies churn constantly (headcount swings fast, brand recognition
  // doesn't imply a stable band) — this tier is the one most worth leaving
  // to the LLM/cache path rather than hand-curating, so only a couple of
  // durable examples are seeded to prove the shape.
  { name: 'Linear', sizeBand: 'SMALL_MID' },
  { name: 'Ramp', sizeBand: 'SMALL_MID' },
  { name: 'Basecamp', sizeBand: 'SMALL' },
]
