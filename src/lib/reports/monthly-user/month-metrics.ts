import type { MemberFacts } from './facts'
import { inWindow } from './period'

export interface Win { start: Date; end: Date }

/** What one member did inside one month. */
export interface MemberMonth {
  applications: number
  tracked: number
  interviews: number
  offers: number
  declines: number
  outreach: number
  linkedin: number
  community: number
  checkIns: number
  logins: number
  courses: number
  coachSessions: number
  newContacts: number
  hires: number
  /** Any real action in the month. Auto-assigned weekly sprints do not count. */
  active: boolean
  /** Applications + outreach + posts + check-ins: one rough "how much did they do" number. */
  effort: number
}

const count = (dates: Array<Date | null | undefined>, w: Win) => dates.filter((d) => inWindow(d, w)).length

export function memberMonth(m: MemberFacts, w: Win): MemberMonth {
  const applications = count(m.applications.map((a) => a.appliedAt), w)
  const tracked = count(m.applications.map((a) => a.createdAt), w)
  const interviews = count(m.applications.map((a) => a.interviewAt), w)
  const offers = count(m.applications.map((a) => a.offerAt), w)
  const declines = count(m.applications.map((a) => a.declinedAt), w)
  const outreach = count(m.outreach.map((o) => o.at), w)
  const linkedin = count(m.linkedinPosts, w)
  const community = count(m.communityPosts, w)
  const checkIns = count(m.checkIns.map((c) => c.at), w)
  const logins = count(m.logins, w)
  const courses = count(m.courses.map((c) => c.at), w)
  const coachSessions = count(m.coachSessions.map((s) => s.at), w)
  const newContacts = count(m.contactsAdded.map((c) => c.at), w)
  const hires = count(m.hires, w)
  const active =
    applications + tracked + interviews + offers + outreach + linkedin + community + checkIns + logins + courses + coachSessions + newContacts > 0
  return {
    applications, tracked, interviews, offers, declines, outreach, linkedin, community, checkIns, logins, courses,
    coachSessions, newContacts, hires, active,
    effort: applications + outreach + linkedin + community + checkIns,
  }
}
