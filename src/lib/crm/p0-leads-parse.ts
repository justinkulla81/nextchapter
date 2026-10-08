import type { CrmOrgType, CrmPersonRole } from '@prisma/client'

/** What prompted the lead. */
export const P0_TRIGGER_KINDS = ['WARN', 'LAYOFF_NEWS', 'RFP', 'LOCAL_NEWS', 'CITED'] as const
export type P0TriggerKind = (typeof P0_TRIGGER_KINDS)[number]

// The organization types a rapid-response lead can be. Investors and search
// firms are left out on purpose: a layoff is not a reason to call either.
const ORG_TYPES: CrmOrgType[] = [
  'EMPLOYER', 'OUTPLACEMENT_LEAD', 'GOVERNMENT', 'UNIVERSITY', 'NONPROFIT',
  'FOUNDATION', 'FUNDER_GRANT', 'THINK_TANK', 'MEDIA', 'OTHER',
]
const PERSON_ROLES: CrmPersonRole[] = [
  'OUTPLACEMENT_BUYER', 'HIRING_MANAGER', 'BD_PARTNER', 'GRANTS', 'POLICY_ANALYST',
  'ALUMNI_OFFICE', 'PRESS', 'CONNECTOR', 'OTHER',
]

export interface P0Lead {
  trigger: {
    kind: P0TriggerKind
    headline: string
    sourceUrl: string
    publishedAt: Date | null
    state: string | null
    county: string | null
    city: string | null
    employees: number | null
    /** RFP due date, or the layoff's effective date. */
    deadline: Date | null
    summary: string | null
  }
  org: { name: string; type: CrmOrgType; website: string | null; city: string | null; state: string | null }
  person: {
    fullName: string
    title: string | null
    linkedinUrl: string | null
    email: string | null
    role: CrmPersonRole | null
    quote: string | null
    /** As the contact shared it, digits checked. Never inferred. */
    phone: string | null
  } | null
  /**
   * False records the contact (a shared phone number, a new title) without
   * tiering them P0 or setting a follow-up — for an existing relationship that
   * already has its own tier and next step.
   */
  p0: boolean
  /** One line: why this organization should hear from us about this trigger. */
  why: string
}

export type ParseResult = { leads: P0Lead[]; errors: { index: number; error: string }[] }

const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

const date = (v: unknown): Date | null => {
  const s = str(v, 40)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const phone = (v: unknown): string | null => {
  const s = str(v, 40)
  if (!s) return null
  const digits = s.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 && /^[+\d\s().-]+(\s*(x|ext\.?)\s*\d+)?$/i.test(s) ? s : null
}

const state = (v: unknown): string | null => {
  const s = str(v, 2)?.toUpperCase()
  return s && /^[A-Z]{2}$/.test(s) ? s : null
}

/**
 * Validates the digest's payload. Bad rows are reported, never half-written:
 * an import that silently drops a field is how a lead loses its source link.
 */
export function parseP0Leads(body: unknown): ParseResult {
  const rows = (body as { leads?: unknown })?.leads
  if (!Array.isArray(rows)) return { leads: [], errors: [{ index: -1, error: 'body.leads must be an array' }] }

  const leads: P0Lead[] = []
  const errors: ParseResult['errors'] = []
  rows.forEach((raw, index) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const t = (r.trigger ?? {}) as Record<string, unknown>
    const o = (r.org ?? {}) as Record<string, unknown>
    const p = r.person as Record<string, unknown> | null | undefined

    const kind = t.kind as P0TriggerKind
    if (!P0_TRIGGER_KINDS.includes(kind)) return errors.push({ index, error: `trigger.kind must be one of ${P0_TRIGGER_KINDS.join(', ')}` })
    const headline = str(t.headline, 300)
    const sourceUrl = str(t.sourceUrl, 1000)
    if (!headline) return errors.push({ index, error: 'trigger.headline is required' })
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return errors.push({ index, error: 'trigger.sourceUrl must be an http(s) link' })

    const orgName = str(o.name, 200)
    const orgType = o.type as CrmOrgType
    if (!orgName) return errors.push({ index, error: 'org.name is required' })
    if (!ORG_TYPES.includes(orgType)) return errors.push({ index, error: `org.type must be one of ${ORG_TYPES.join(', ')}` })

    let person: P0Lead['person'] = null
    if (p) {
      const fullName = str(p.fullName, 120)
      if (!fullName || !fullName.includes(' ')) return errors.push({ index, error: 'person.fullName needs a first and last name' })
      const role = p.role ? (p.role as CrmPersonRole) : null
      if (role && !PERSON_ROLES.includes(role)) return errors.push({ index, error: `person.role must be one of ${PERSON_ROLES.join(', ')}` })
      person = {
        fullName, role,
        title: str(p.title, 200),
        linkedinUrl: str(p.linkedinUrl, 300),
        email: str(p.email, 200),
        quote: str(p.quote, 500),
        phone: phone(p.phone),
      }
      if (p.phone && !person.phone) return errors.push({ index, error: 'person.phone is not a phone number' })
    }

    const employees = Number(t.employees)
    leads.push({
      trigger: {
        kind, headline, sourceUrl,
        publishedAt: date(t.publishedAt),
        state: state(t.state),
        county: str(t.county, 80)?.replace(/\s+(county|parish)$/i, '') ?? null,
        city: str(t.city, 80),
        employees: Number.isFinite(employees) && employees > 0 ? Math.round(employees) : null,
        deadline: date(t.deadline),
        summary: str(t.summary, 1000),
      },
      org: { name: orgName, type: orgType, website: str(o.website, 300), city: str(o.city, 80), state: state(o.state) },
      person,
      p0: r.p0 !== false,
      why: str(r.why, 500) ?? '',
    })
  })
  return { leads, errors }
}
