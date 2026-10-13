// Institution.profile: public, sourced facts the portal shows about a
// college and its region. Multi-tenant: any institution can carry one; the
// demo seed fills it from a fixture. Rules for anything stored here:
//   - every figure has a source URL and the period it describes;
//   - nothing about an individual member, ever;
//   - missing data is omitted, never estimated.

export type Sourced<T> = T & { source: string; sourceUrl?: string | null; asOf?: string | null }

export type InstitutionPhoto = { url: string; alt: string; credit?: string | null; pageUrl?: string | null; license?: string | null }

export type InstitutionProfile = {
  // Set from NextChapter admin › Institutions (src/lib/institution/admin.ts).
  heroImageUrl?: string
  tagline?: string
  college?: {
    // The federal IPEDS unit id: links the college to its CollegeProfile
    // record for the peer benchmark (College Scorecard / IPEDS data).
    unitid?: string
    shortName?: string
    city?: string
    state?: string // two-letter
    founded?: number
    mascot?: string
    colors?: string[]
    websiteUrl?: string
    careerCenter?: { name: string; url?: string | null; email?: string | null; phone?: string | null }
    // Published numbers (enrollment, living alumni, outcomes), each sourced.
    facts?: Sourced<{ label: string; value: string }>[]
  }
  photos?: InstitutionPhoto[]
  region?: {
    name: string // e.g. "Washington County, PA"
    state: string // two-letter, for the live WARN lookup
    counties: string[] // lowercase county names, for the live WARN/board lookup
    unemployment?: Sourced<{ area: string; rate: number; period: string; laborForce?: number | null }>[]
    // Monthly county rate, oldest first, for the trend line.
    unemploymentTrend?: Sourced<{ area: string; points: { period: string; rate: number }[] }>
    medianHouseholdIncome?: Sourced<{ area: string; value: number }>
    topEmployers?: Sourced<{ names: string[] }>
    industries?: Sourced<{ names: string[] }>
  }
  workforce?: {
    board?: Sourced<{ name: string; website?: string | null; counties?: string[]; phone?: string | null }>
    careerLinks?: Sourced<{ name: string; address?: string | null; phone?: string | null; website?: string | null }>[]
  }
  news?: { headline: string; outlet: string; date: string; url: string; summary: string }[]
}

export function readProfile(json: unknown): InstitutionProfile {
  return json && typeof json === 'object' ? (json as InstitutionProfile) : {}
}
