import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'

/** "NOT_VERY_COMFORTABLE" → "Not very comfortable". */
export function humanize(v: string): string {
  const s = v.replace(/_/g, ' ').toLowerCase().trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const SENIORITY: Record<string, string> = { EARLY: 'Early career', MID: 'Mid-level', SENIOR: 'Senior', EXECUTIVE: 'Executive' }
const AGE: Record<string, string> = { UNDER_35: 'Under 35', A35_44: '35–44', A45_54: '45–54', A55_64: '55–64', A65_PLUS: '65 and over' }
const EDUCATION: Record<string, string> = {
  HIGH_SCHOOL: 'High school', SOME_COLLEGE: 'Some college', ASSOCIATE: 'Associate', BACHELORS: "Bachelor's", MASTERS: "Master's",
  MBA: 'MBA', MPH: 'MPH', JD: 'JD', MD: 'MD', DO: 'DO', PHARMD: 'PharmD', DDS: 'DDS', DVM: 'DVM', PSYD: 'PsyD', PHD: 'PhD', OTHER: 'Other',
}
const CHANNEL: Record<string, string> = {
  COLD_APPLICATION: 'Cold application', REFERRAL: 'Referral', RECRUITER_OUTREACH: 'Recruiter outreach',
  WARM_NETWORK_INTRO: 'Warm network intro', OTHER: 'Other',
}
const SEARCH_INTENSITY: Record<string, string> = {
  ACTIVELY_SEARCHING: 'Actively searching', CASUALLY_LOOKING: 'Casually looking', EXPLORING: 'Exploring', OPEN: 'Open to offers',
}

export const labelSeniority = (v: string) => SENIORITY[v] ?? humanize(v)
export const labelAge = (v: string) => AGE[v] ?? humanize(v)
export const labelEducation = (v: string) => EDUCATION[v] ?? humanize(v)
export const labelChannel = (v: string) => CHANNEL[v] ?? humanize(v)
export const labelSearchIntensity = (v: string) => SEARCH_INTENSITY[v] ?? humanize(v)
export const labelJobStatus = (v: string) => (CURRENT_JOB_STATUS_LABELS as Record<string, string>)[v] ?? humanize(v)
