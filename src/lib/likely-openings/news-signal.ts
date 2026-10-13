import { createHash } from 'node:crypto'
import type { LikelyOpeningSignalType } from '@prisma/client'
import { companyKey, NEWS_CIK, ROLE_PATTERNS, SIGNAL_TTL_DAYS, type OfficerRole } from './roles'

// A likely-opening signal read from a news report, for the companies no SEC
// filing covers (private ones like Automattic). It is stored in the same table
// and ranked the same way as a filing-based one; cik "news" marks where it came
// from. Only company-level officer seats count — a role we cannot name as one
// of the officer roles stays a Market Pulse lead and makes no signal.

export interface NewsExecEvent {
  company: string
  summary: string
  role: string | null
  direction: 'departure' | 'appointment' | 'search' | null
  url: string | null
}

export interface NewsSignalRow {
  companyName: string
  companyNameNormalized: string
  cik: string
  signalType: LikelyOpeningSignalType
  roles: string[]
  filingDate: Date
  accessionNumber: string
  filingUrl: string
  summary: string
  amountRaised: null
  industry: null
  location: null
  expiresAt: Date
}

/** The officer seat a title names ("Chief Financial Officer", "CFO"), or null. Never "Vice President". */
export function officerRoleFromTitle(title: string | null): OfficerRole | null {
  if (!title) return null
  for (const { role, re } of ROLE_PATTERNS) {
    re.lastIndex = 0
    if (re.test(title)) return role
  }
  return null
}

/** Pure. null when the event names no officer seat, no direction, or has no story to point at. */
export function newsSignalFromEvent(e: NewsExecEvent, now = new Date()): NewsSignalRow | null {
  const role = officerRoleFromTitle(e.role)
  if (!role || !e.direction || !e.url) return null
  // A departure or an open search is the opening; a new permanent leader is a rebuild.
  const signalType: LikelyOpeningSignalType = e.direction === 'appointment' ? 'EXEC_APPOINTMENT' : 'EXEC_DEPARTURE'
  const key = companyKey(e.company)
  if (!key) return null
  const month = now.toISOString().slice(0, 7)
  const accessionNumber = `news:${createHash('sha1').update(`${key}|${role}|${signalType}|${month}`).digest('hex').slice(0, 20)}`
  return {
    companyName: e.company, companyNameNormalized: key, cik: NEWS_CIK, signalType, roles: [role],
    filingDate: now, accessionNumber, filingUrl: e.url, summary: e.summary,
    amountRaised: null, industry: null, location: null,
    expiresAt: new Date(now.getTime() + SIGNAL_TTL_DAYS * 86_400_000),
  }
}
