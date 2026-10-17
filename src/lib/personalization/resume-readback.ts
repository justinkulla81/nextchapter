// "We read your résumé and found N facts": the profile facts matching uses, as chips, right
// after an upload. Pure: src/test/personalization.test.ts. The facts are what the profile now
// holds (the upload's extraction fills blanks and its own unconfirmed values, resume-prefill.ts);
// `fromResume` marks the ones this résumé filled and the member hasn't confirmed.

import { CLEARANCE_LABEL, LICENSE_LABEL, type ClearanceLevel, type LicenseKey } from '@/lib/jobs/requirements'
import type { PrefillField } from '@/lib/resume/resume-prefill'

export type ReadbackFactKey = 'city' | 'years' | 'title' | 'industries' | 'tools' | 'licenses' | 'clearance'

export interface ReadbackFact {
  key: ReadbackFactKey
  label: string
  value: string
  /** Filled from the résumé and not confirmed yet. */
  fromResume: boolean
  /** The prefill marks "Looks right" clears for it. */
  fields: PrefillField[]
  href: string
}

export interface ReadbackProfile {
  currentCity: string | null
  currentState: string | null
  yearsExperience: number | null
  resumeLatestJobTitle: string | null
  industries: string[]
  resumeKeywords: string[]
  licensesHeld: string[]
  clearanceLevel: string | null
  resumePrefilledFields: string[]
}

const MAX_TOOLS = 5

export function readbackFacts(p: ReadbackProfile): ReadbackFact[] {
  const marked = new Set(p.resumePrefilledFields)
  const out: ReadbackFact[] = []
  const add = (key: ReadbackFactKey, label: string, value: string | null, fields: PrefillField[], href: string) => {
    if (!value) return
    out.push({ key, label, value, fromResume: fields.some((f) => marked.has(f)), fields, href })
  }
  add('city', 'City', [p.currentCity?.trim(), p.currentState?.trim()].filter(Boolean).join(', ') || null, ['currentCity', 'currentState'], '/dashboard/profile/personal#basics')
  add('years', 'Experience', typeof p.yearsExperience === 'number' && p.yearsExperience > 0 ? `${p.yearsExperience} years` : null, ['yearsExperience'], '/dashboard/profile/personal#function-experience')
  add('title', 'Latest title', p.resumeLatestJobTitle?.trim() || null, ['resumeLatestJobTitle'], '/dashboard/profile/personal#function-experience')
  add('industries', 'Industries', p.industries.length > 0 ? p.industries.slice(0, 3).join(', ') : null, ['industryContext'], '/dashboard/profile/personal#industry')
  const tools = [...new Set(p.resumeKeywords.map((k) => k.trim()).filter(Boolean))].slice(0, MAX_TOOLS)
  add('tools', 'Skills and tools', tools.length > 0 ? `${tools.join(', ')}${p.resumeKeywords.length > MAX_TOOLS ? ` +${p.resumeKeywords.length - MAX_TOOLS} more` : ''}` : null, ['resumeKeywords'], '/dashboard/skills-assessment#tools')
  const licenses = p.licensesHeld.filter((l): l is LicenseKey => l in LICENSE_LABEL).map((l) => LICENSE_LABEL[l])
  add('licenses', 'Licenses', licenses.length > 0 ? licenses.join(', ') : null, ['licensesHeld'], '/dashboard/profile/screening#screening-questions')
  const clr = p.clearanceLevel && p.clearanceLevel in CLEARANCE_LABEL && p.clearanceLevel !== 'unspecified' ? CLEARANCE_LABEL[p.clearanceLevel as ClearanceLevel] : null
  add('clearance', 'Clearance', clr, ['clearanceLevel'], '/dashboard/profile/screening#screening-questions')
  return out
}
