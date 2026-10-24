// The about-to-graduate plan for students and new grads: position yourself, use your school's network, and build proof, timed to
// the graduation date. It is for people who may not have a job lined up, or any job experience: class projects, clubs and campus
// jobs count, and the school is the best network they have. Pure and client-safe: src/test/graduation-plan.test.ts.
//
// The first-job checklist (./checklist.ts) is the standing list of what an employer looks for; this is the same work ordered by how
// close graduation is. Nothing here is sent to anyone: the member writes and sends their own notes.

export type GradPhase = 'far' | 'building' | 'launch' | 'graduated'

export const GRAD_PHASE_LABEL: Record<GradPhase, string> = {
  far: 'More than a year out',
  building: '6 to 12 months out',
  launch: 'Under 6 months out',
  graduated: 'Graduated',
}

export type GradTrack = 'position' | 'school' | 'proof'

export const GRAD_TRACK_LABEL: Record<GradTrack, string> = {
  position: 'Position yourself',
  school: 'Use your school’s network',
  proof: 'Build proof',
}

export type GradStep = { id: string; track: GradTrack; text: string; why: string; href: string; actionType?: string }

const MONTH_DAYS = 30.44
const DAY = 86_400_000

/** Whole months from now to graduation. Negative after it. Null with no date. */
export function monthsToGraduation(graduation: Date | null | undefined, now: Date = new Date()): number | null {
  if (!graduation) return null
  return (graduation.getTime() - now.getTime()) / DAY / MONTH_DAYS
}

/** Where the member is on the way to graduation. No date counts as 6 to 12 months out, the most useful default. */
export function gradPhase(graduation: Date | null | undefined, now: Date = new Date()): GradPhase {
  const m = monthsToGraduation(graduation, now)
  if (m === null) return 'building'
  if (m > 12) return 'far'
  if (m > 6) return 'building'
  if (m > 0) return 'launch'
  return 'graduated'
}

const S = (id: string, track: GradTrack, text: string, why: string, href: string, actionType?: string): GradStep => ({ id, track, text, why, href, actionType })

const STEPS: Record<GradPhase, GradStep[]> = {
  far: [
    S('far-roles', 'position', 'Write down the two or three kinds of work you lean toward, and one reason for each', 'You do not need to be sure. A short list makes every class, club and internship choice easier.', '/dashboard/early-career#roles'),
    S('far-center', 'school', 'Meet your career center and ask which employers recruit from your school, and when', 'Recruiting for many roles starts a year before graduation. The career center knows the calendar.', '/dashboard/early-career'),
    S('far-alumni', 'school', 'Find three alumni from your major and read how their careers started', 'Your school’s alumni are the people most likely to answer a student.', '/dashboard/groups', 'OUTREACH_CALL'),
    S('far-lead', 'proof', 'Join one club or class project where you can lead something', 'A real story to tell: what you took charge of and what happened.', '/dashboard/early-career'),
    S('far-intern', 'proof', 'Find out when internship applications open in your field, and put the date in your calendar', 'An internship is the strongest proof you can have before a first job.', '/dashboard/companies'),
  ],
  building: [
    S('b-story', 'position', 'Write your one-line story: who you are, what you studied and the work you want', 'It is the first thing you say in every message, interview and LinkedIn headline.', '/dashboard/strengths'),
    S('b-resume', 'position', 'Build your résumé from projects, coursework, clubs and campus jobs, each with a result', 'No full-time experience is normal. Employers hiring new grads read these.', '/dashboard/resume', 'RESUME_UPDATE'),
    S('b-linkedin', 'position', 'Set up LinkedIn: a photo, a headline naming the work you want, and your school', 'Recruiters and alumni look there first.', '/dashboard/linkedin', 'LINKEDIN_SETUP'),
    S('b-alumni', 'school', 'Find five alumni in roles you want, and send each a short note as a student asking for 15 minutes', 'Alumni say yes to students far more often than strangers do. Write it yourself; we give you a start below.', '/dashboard/groups', 'OUTREACH_MESSAGE'),
    S('b-prof', 'school', 'Ask a professor who knows your work to introduce you to someone in the field', 'Professors know people in industry and often will say a good word.', '/dashboard/network', 'OUTREACH_MESSAGE'),
    S('b-project', 'proof', 'Turn one class project into a résumé line with a result and a number', 'A project with a result is evidence, the same as a job.', '/dashboard/resume'),
  ],
  launch: [
    S('l-apply', 'position', 'Apply to the roles on your list each week, and track each one', 'Most first jobs come from steady weekly effort, not one big push.', '/dashboard/find-my-job', 'JOB_APPLICATION_SUBMITTED'),
    S('l-refer', 'school', 'Ask two alumni at companies you applied to for a referral or a word with the recruiter', 'A referral from an alum moves an application out of the pile.', '/dashboard/groups', 'OUTREACH_MESSAGE'),
    S('l-events', 'school', 'Go to your school’s career fair or recruiting event, and follow up within a day', 'Employers recruiting on campus are looking for students from your school.', '/dashboard/early-career'),
    S('l-practice', 'position', 'Practice interviews with your career center or a friend, and use the interview practice here', 'Entry-level interviews test how you think and work with people.', '/dashboard/interview-prep', 'INTERVIEW_PREP'),
    S('l-nojob', 'proof', 'If you do not have an offer yet: finish a project you can show, or take a leadership role in a club', 'Something concrete to talk about beats waiting.', '/dashboard/early-career'),
  ],
  graduated: [
    S('g-school', 'school', 'Ask your career center and alumni office how long recent graduates can keep using them', 'Most schools keep career services and the alumni network open for a year or more.', '/dashboard/groups'),
    S('g-alumni', 'school', 'Send two alumni a short note as a recent grad asking for 15 minutes', 'You are still a student of the school in their eyes, and that opens doors.', '/dashboard/groups', 'OUTREACH_MESSAGE'),
    S('g-project', 'proof', 'Finish one small real project you can show: a portfolio piece, volunteer work or a freelance job', 'It gives you something to talk about while the search runs.', '/dashboard/early-career'),
    S('g-apply', 'position', 'Apply to the roles on your list each week, and track each one', 'Steady weekly effort wins first jobs.', '/dashboard/find-my-job', 'JOB_APPLICATION_SUBMITTED'),
    S('g-prof', 'school', 'Stay in touch with a professor or club contact and tell them what you are looking for', 'They hear of openings before they are posted.', '/dashboard/network', 'OUTREACH_MESSAGE'),
  ],
}

/** All steps for a phase, in the order a student should do them. */
export function gradSteps(phase: GradPhase): GradStep[] {
  return STEPS[phase]
}

/** The phase's steps grouped by track, for the page. */
export function gradStepsByTrack(phase: GradPhase): { track: GradTrack; label: string; steps: GradStep[] }[] {
  const all = gradSteps(phase)
  return (['position', 'school', 'proof'] as const).map((track) => ({ track, label: GRAD_TRACK_LABEL[track], steps: all.filter((s) => s.track === track) })).filter((g) => g.steps.length > 0)
}

/** Weekly plan steps: one positioning or network step and one proof step, rotating through the phase's list. Nothing sends itself. */
export function gradPlanItems(graduation: Date | null | undefined, weekNumber: number, now: Date = new Date()): { text: string; actionType?: string }[] {
  const phase = gradPhase(graduation, now)
  const all = gradSteps(phase)
  const lead = all.filter((s) => s.track !== 'proof')
  const proof = all.filter((s) => s.track === 'proof')
  const w = Math.max(0, weekNumber - 1)
  const out: { text: string; actionType?: string }[] = []
  if (lead.length) out.push({ text: lead[w % lead.length].text, actionType: lead[w % lead.length].actionType })
  if (proof.length && phase !== 'launch') out.push({ text: proof[w % proof.length].text, actionType: proof[w % proof.length].actionType })
  return out
}

/** Where a student can turn for help, besides alumni. Shown as a short list; the member decides who to ask. */
export const SCHOOL_HELP: readonly { who: string; what: string }[] = [
  { who: 'Career center', what: 'Résumé reviews, practice interviews, the employer calendar and the school’s job board. Often open to alumni for a year or more.' },
  { who: 'Alumni network and directory', what: 'Alumni who agreed to talk to students. Filter by major, employer and city.' },
  { who: 'Professors and advisors', what: 'Introductions, references and word of openings. Office hours are the easy way in.' },
  { who: 'Clubs and student organizations', what: 'Leadership you can name on a résumé, and alumni who come back to speak.' },
  { who: 'Class projects, capstones and competitions', what: 'Real work with a result. If you have no job experience, this is your experience.' },
  { who: 'Campus jobs and research', what: 'Count as work. A reference from a supervisor is worth asking for.' },
  { who: 'Entrepreneurship center', what: 'If you want to start something: advisors, an incubator and pitch competitions, often open to alumni.' },
]

/** A start for a student's note to an alum. The member edits it and sends it themselves. */
export const STUDENT_NOTE_STARTER =
  'Hi [name], I am a [year] studying [major] at [school] and I am interested in [role or field]. I saw you work at [company] and graduated from [school]. Could I ask you two or three questions about how you got started? Fifteen minutes by phone or a few lines by message is plenty. Thank you either way.'
