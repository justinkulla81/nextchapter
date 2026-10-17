// Fake-job check for a posting someone submitted to the job board. Same idea
// as the email check (src/lib/scam-shield/assess-recruiter-email.ts): does the
// contact and the apply link belong to the company the posting names? A real
// "Acme Health" posting is applied to on Acme Health's site or a known ATS and
// is handled by someone at an Acme Health address. Pure, so it can run at
// submission and again at review time.

import { extractDomain } from '@/lib/email-tracking/email-address'
import {
  FREE_MAIL,
  TRUSTED_HOSTS,
  SUSPICIOUS_TLDS,
  URGENCY,
  SENSITIVE_INFO,
  MONEY_REQUEST,
  OFF_PLATFORM,
  TOO_GOOD,
  LIKELY_FAKE_THRESHOLD,
  SUSPICIOUS_THRESHOLD,
  rootDomain,
  rootLabel,
  tld,
  hostOf,
  domainBelongsTo,
  isLookalike,
  type ScamLevel,
  type ScamSignal,
  type ScamSignalCode,
} from './assess-recruiter-email'

export interface JobPostingScamInput {
  title: string
  companyName: string
  url: string
  contactEmail: string | null
  description: string | null
  // Recruiter-led searches legitimately post for a client, so the company
  // won't match the poster's own domain.
  postingType: string | null
  salaryMax?: number | null
}

export interface JobPostingScamAssessment {
  level: ScamLevel
  score: number
  flaggedDomains: string[]
  signals: ScamSignal[]
}

export function assessJobPosting(input: JobPostingScamInput): JobPostingScamAssessment {
  const signals: ScamSignal[] = []
  const flagged = new Set<string>()
  const add = (code: ScamSignalCode, weight: number, detail: string) => signals.push({ code, weight, detail })
  const company = input.companyName.trim()
  const recruiterLed = input.postingType === 'recruiter_search'
  const text = `${input.title}\n${input.description ?? ''}`

  const applyHost = hostOf(input.url)
  const applyRoot = applyHost ? rootDomain(applyHost) : null
  const contactDomain = input.contactEmail ? extractDomain(input.contactEmail) : null
  const contactRoot = contactDomain ? rootDomain(contactDomain) : null

  // Contact address.
  if (contactRoot && !recruiterLed) {
    if (FREE_MAIL.has(contactRoot)) {
      add('freemail_recruiter', 20, `The contact uses a personal ${contactRoot} address instead of a ${company} address.`)
    } else if (!TRUSTED_HOSTS.has(contactRoot)) {
      if (isLookalike(contactRoot, company)) {
        add('lookalike_domain', 40, `The contact's domain, ${contactRoot}, imitates ${company}'s name without being ${company}'s domain.`)
        flagged.add(contactRoot)
      } else if (!domainBelongsTo(contactRoot, company)) {
        add('sender_domain_mismatch', 30, `The contact's domain, ${contactRoot}, doesn't look like ${company}'s.`)
        flagged.add(contactRoot)
      }
    }
  }

  // Apply link.
  if (applyRoot && !TRUSTED_HOSTS.has(applyRoot)) {
    if (isLookalike(applyRoot, company)) {
      add('lookalike_domain', 40, `The apply link goes to ${applyRoot}, which imitates ${company}'s name.`)
      flagged.add(applyRoot)
    } else if (!domainBelongsTo(applyRoot, company) && !recruiterLed) {
      add('link_domain_mismatch', 30, `The apply link goes to ${applyRoot}, which isn't ${company}'s domain or a known job-application site.`)
      flagged.add(applyRoot)
    }
  }

  for (const root of [contactRoot, applyRoot]) {
    if (!root || TRUSTED_HOSTS.has(root) || FREE_MAIL.has(root)) continue
    if (SUSPICIOUS_TLDS.has(tld(root)) || /(?:web|mail|secure|portal|login|hr|apply)\d{1,4}$/.test(rootLabel(root))) {
      add('odd_domain_shape', 10, `${root} has the look of a throwaway domain.`)
      flagged.add(root)
      break
    }
  }

  if (URGENCY.test(text)) add('urgency', 10, 'The posting pressures applicants to act quickly.')
  if (SENSITIVE_INFO.test(text)) add('sensitive_info_request', 35, 'The posting asks for sensitive personal or financial information.')
  if (MONEY_REQUEST.test(text)) add('money_request', 40, 'The posting involves the applicant paying money, buying equipment, or handling a check.')
  if (OFF_PLATFORM.test(text)) add('off_platform_chat', 20, 'The posting moves the process to a messaging app.')
  if (TOO_GOOD.test(text)) add('too_good_to_be_true', 15, 'The posting promises a job or pay with little or no vetting.')

  const score = signals.reduce((sum, s) => sum + s.weight, 0)
  const level: ScamLevel = score >= LIKELY_FAKE_THRESHOLD ? 'likely_fake' : score >= SUSPICIOUS_THRESHOLD ? 'suspicious' : 'none'
  return { level, score, flaggedDomains: Array.from(flagged), signals: signals.sort((a, b) => b.weight - a.weight) }
}
