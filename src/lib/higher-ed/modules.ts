// Portal features a college switches on or off (Admin › Services). Off means
// gone for alumni (tab or section hidden) and a plain "switched off" note for
// staff. Client-safe: the rail and forms read it too. Stored in
// enabledFeatures.modules; anything not stored is on.

export type ModuleKey =
  | 'alumniJobs'
  | 'projects'
  | 'directory'
  | 'groups'
  | 'intros'
  | 'askAlumni'
  | 'mentors'
  | 'officeHours'
  | 'mentoringCohorts'
  | 'events'
  | 'programs'
  | 'courseAuditing'
  | 'volunteer'
  | 'news'
  | 'giveBack'

export const MODULES: { key: ModuleKey; label: string; what: string; area: 'Work' | 'People' | 'Mentoring' | 'Learning' | 'College' }[] = [
  { key: 'alumniJobs', label: 'Alumni-only jobs', what: 'Roles employers post just for your alumni.', area: 'Work' },
  { key: 'projects', label: 'Projects and boards', what: 'Alumni post short projects, fractional roles and board seats to fellow alumni.', area: 'Work' },
  { key: 'directory', label: 'Alumni directory', what: 'An opt-in directory: only alumni who choose to be listed appear.', area: 'People' },
  { key: 'groups', label: 'Groups and chapters', what: 'Class, major and city groups; affinity groups and regional chapters.', area: 'People' },
  { key: 'intros', label: 'Alumni intros', what: 'Ask an alum at a company for 15 minutes.', area: 'People' },
  { key: 'askAlumni', label: 'Ask an alum', what: 'Students and alumni post questions; alumni answer.', area: 'People' },
  { key: 'mentors', label: 'Mentors', what: 'A mentor directory and call requests.', area: 'Mentoring' },
  { key: 'officeHours', label: 'Office hours', what: 'Mentors post 20-minute slots alumni can book.', area: 'Mentoring' },
  { key: 'mentoringCohorts', label: 'Mentoring programs', what: 'Matched mentor–mentee pairs for a set number of weeks.', area: 'Mentoring' },
  { key: 'events', label: 'Events', what: 'Career panels, employer nights and workshops with RSVPs.', area: 'College' },
  { key: 'programs', label: 'Programs', what: 'Exec Ed programs alumni can apply to, with credentials.', area: 'Learning' },
  { key: 'courseAuditing', label: 'Course auditing', what: 'Faculty open regular courses to alumni auditors.', area: 'Learning' },
  { key: 'volunteer', label: 'Ways to give time', what: 'Admissions interviews, guest lectures, class agents and more.', area: 'College' },
  { key: 'news', label: 'College news', what: 'News from the college on the alum’s home page.', area: 'College' },
  { key: 'giveBack', label: 'Give back', what: 'A giving link and Resilience Fund on the alum’s home.', area: 'College' },
]

export type Modules = Record<ModuleKey, boolean>

export function modulesFrom(enabledFeatures: unknown): Modules {
  const stored = ((enabledFeatures as { modules?: Record<string, unknown> } | null)?.modules ?? {}) as Record<string, unknown>
  return Object.fromEntries(MODULES.map((m) => [m.key, stored[m.key] !== false])) as Modules
}
