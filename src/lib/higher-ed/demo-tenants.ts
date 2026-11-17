// Demo tenant fixtures: data, not code paths. Each one is seeded by
// resetDemoInstitution() (./demo-seed.ts) and reset from the portal's demo
// bar. Nothing in the portal branches on a slug; a sales demo for a named
// college is just another fixture here.
//
// Rules: staff names, members and gifts are always fictional. `profile`
// holds only public facts, each with its source and period (see
// ./profile.ts); a fact we couldn't source is left out, not estimated.

import type { InstitutionUserRole } from '@prisma/client'
import type { InstitutionProfile } from './profile'
import type { ServiceSetting } from './services'
import { WASHJEFF_TENANT } from './demo-tenants/washjeff'
import { CMU_TENANT } from './demo-tenants/cmu'

export type DemoTenant = {
  slug: string
  name: string
  programBrandName: string
  accentColor: string
  logoUrl?: string | null
  domains: string[]
  alumniCount: number
  includedSeats: number
  givingUrl: string
  staffEmailDomain: string
  staff: [InstitutionUserRole, string][]
  // Fictional employers for fictional members.
  employers: string[]
  majors: string[]
  memberCount?: number
  // Starting service choices, merged over the catalog defaults.
  services?: Record<string, Partial<ServiceSetting>>
  annualCheckInMonth?: number
  profile?: InstitutionProfile
  // License tier; INSTITUTION opens Lifelong Learning (Exec Ed) and Teaching. Default ADVANCEMENT.
  tier?: 'CAREER' | 'ADVANCEMENT' | 'INSTITUTION'
  // The college's own programs (at least three: the seed builds cohorts and capstones on the first three).
  // Real programs carry their public name, price and the skills they teach (the skills bridge reads them).
  programs?: DemoProgram[]
  // Courses faculty open to auditors (at least two). Default: two generic ones.
  auditCourses?: { title: string; courseCode: string | null; term: string; schedule: string; modality: 'online' | 'in_person' | 'hybrid'; seats: number; description: string; skills: string[] }[]
  // Which school or college each major belongs to, so members get a school (groups and targeting by school).
  majorSchools?: Record<string, string>
  // Exactly five groups: two chapters first, then three affinity groups (the seed assigns members by position).
  // An affinity group's majors make alumni with those majors join it automatically.
  groups?: { kind: 'chapter' | 'affinity'; name: string; metro: string | null; description: string; majors?: string[] }[]
  // Research requests from the tenant's fictional professor (Teaching › Industry groups); default: the generic ones.
  researchRequests?: { title: string; lab: string; description: string; fields: string[]; durationWeeks: number | null; compensation: 'volunteer' | 'paid' }[]
}

export type DemoProgram = {
  name: string
  summary: string
  audience: string
  credential: string | null
  priceCents: number
  wioaEligible: boolean
  skills: string[]
  cipCode?: string | null
  hours?: number | null
  credentialType?: string | null
  prerequisites?: string | null
}

const DEMO_COLLEGE: DemoTenant = {
  slug: 'demo',
  name: 'Demo College',
  programBrandName: 'Demo College Career Network',
  accentColor: '#1F4E79',
  domains: ['democollege.test'],
  alumniCount: 11_000,
  includedSeats: 330,
  givingUrl: 'https://example.org/give',
  staffEmailDomain: 'democollege.test',
  staff: [
    ['INSTITUTION_ADMIN', 'Pat Okafor'],
    ['ALUMNI_RELATIONS', 'Sam Lindqvist'],
    ['DEVELOPMENT', 'Alex Moreau'],
    ['CAREER_SERVICES', 'Jamie Castellanos'],
    ['EMPLOYER_RELATIONS', 'Robin Achterberg'],
    ['COACH', 'Dana Whitfield'],
    ['FACULTY', 'Prof. Lee Okonkwo'],
    ['EXEC_ED', 'Sam Varga'],
  ],
  employers: ['Harbor Ridge Manufacturing', 'Blue Heron Health', 'Kestrel Logistics', 'Maple Fork Bank', 'Summit Lantern Software', 'Copperline Energy', 'Wren & Vale Consulting', 'Granite Arch Insurance', 'Tidewater Foods', 'Northgate Media'],
  majors: ['Economics', 'Biology', 'English', 'Accounting', 'Political Science', 'Chemistry', 'History', 'Psychology', 'Computer Science', 'Business'],
}

export const DEMO_TENANTS: Record<string, DemoTenant> = {
  [DEMO_COLLEGE.slug]: DEMO_COLLEGE,
  [WASHJEFF_TENANT.slug]: WASHJEFF_TENANT,
  [CMU_TENANT.slug]: CMU_TENANT,
}
