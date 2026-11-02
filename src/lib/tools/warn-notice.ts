// Draft WARN notices from a few facts: the one to each employee, the one to a union, and the one to the State and local
// government. Pure text, no AI and no network, so the draft is the same every time and nothing leaves the browser.
//
// The required contents follow 20 C.F.R. 639.7 (https://www.law.cornell.edu/cfr/text/20/639.7, read 2026-10-30): each
// recipient's list of items is the regulation's. It is a draft to have a lawyer read: it does not cover state-law
// additions, exceptions that shorten notice, or the facts of any one case. Tested in src/test/warn-notice.test.ts.

export const FEDERAL_NOTICE_DAYS = 60

export interface NoticePosition { title: string; count: number }

export interface NoticeInput {
  company: string
  siteName: string
  siteAddress: string
  contactName: string
  contactPhone: string
  action: 'closing' | 'layoff'
  duration: 'permanent' | 'temporary'
  /** A closing of the whole plant, not one unit in it. Only asked for a closing. */
  entirePlant: boolean
  /** YYYY-MM-DD */
  firstSeparation: string
  /** When the rest of the separations follow, in the employer's words. */
  schedule: string
  positions: NoticePosition[]
  bumping: boolean
  /** Empty when no union represents the affected employees. */
  unionName: string
  unionOfficer: string
  unionOfficerAddress: string
  /** The date on the notices, YYYY-MM-DD. */
  noticeDate: string
}

export interface NoticeSet {
  employee: string
  /** Null when no union represents the affected employees. */
  union: string | null
  government: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-12-31" to "December 31, 2026"; anything that is not a real date comes back as typed. */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const month = Number(m[2])
  const day = Number(m[3])
  const probe = new Date(Date.UTC(Number(m[1]), month - 1, day))
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return iso
  return `${MONTHS[month - 1]} ${day}, ${m[1]}`
}

/** The last day notice can go out and still be `days` calendar days ahead of the first separation (YYYY-MM-DD, or null if the date is not real). */
export function noticeDeadline(firstSeparation: string, days: number = FEDERAL_NOTICE_DAYS): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstSeparation)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (new Date(t).toISOString().slice(0, 10) !== firstSeparation) return null
  return new Date(t - days * 86_400_000).toISOString().slice(0, 10)
}

/** What is missing before the notices can be drafted, in plain words. Empty when the draft can be made. */
export function noticeProblems(i: NoticeInput): string[] {
  const out: string[] = []
  if (!i.company.trim()) out.push('Enter the company name.')
  if (!i.siteAddress.trim()) out.push('Enter the address of the site.')
  if (!i.contactName.trim() || !i.contactPhone.trim()) out.push('Enter a company official to contact, with a phone number. Every notice must name one.')
  if (noticeDeadline(i.firstSeparation) === null) out.push('Enter the date of the first separation.')
  const positions = i.positions.filter((p) => p.title.trim())
  if (positions.length === 0 || positions.some((p) => !Number.isInteger(p.count) || p.count < 1)) out.push('List each job title affected with the number of employees in it (at least 1).')
  if (i.unionName.trim() && (!i.unionOfficer.trim() || !i.unionOfficerAddress.trim())) out.push('For a union, enter the name and address of its chief elected officer.')
  return out
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

function describeAction(i: NoticeInput): string {
  const what = i.action === 'closing'
    ? i.entirePlant ? `the shutdown of the entire plant` : `the shutdown of a single site or operating unit`
    : `a reduction in force`
  const length = i.duration === 'permanent' ? 'expected to be permanent' : 'expected to be temporary'
  const site = i.siteName.trim() ? `${i.siteName.trim()}, ${i.siteAddress.trim()}` : i.siteAddress.trim()
  const entire = i.action === 'closing' && i.entirePlant ? ' The entire plant will close.' : ''
  return `${i.company.trim()} is planning ${what} at ${site}. The action is ${length}.${entire}`
}

export function buildNotices(i: NoticeInput): NoticeSet {
  const positions = i.positions.filter((p) => p.title.trim()).map((p) => ({ title: p.title.trim(), count: p.count }))
  const total = positions.reduce((s, p) => s + p.count, 0)
  const first = longDate(i.firstSeparation)
  const date = longDate(i.noticeDate)
  const contact = `${i.contactName.trim()}, ${i.contactPhone.trim()}`
  const schedule = i.schedule.trim() ? ` ${i.schedule.trim()}` : ''
  const bumping = i.bumping ? 'Bumping rights exist for the affected positions.' : 'No bumping rights exist for the affected positions.'
  const site = i.siteName.trim() ? `${i.siteName.trim()}, ${i.siteAddress.trim()}` : i.siteAddress.trim()
  const kind = i.action === 'closing' ? 'plant closing' : 'mass layoff'
  const titles = positions.map((p) => `- ${p.title}: ${plural(p.count, 'employee', 'employees')}`).join('\n')

  const employee = [
    `${date}`,
    ``,
    `To: [Employee name]`,
    `Re: Notice of ${kind} under the Worker Adjustment and Retraining Notification Act`,
    ``,
    `${describeAction(i)}`,
    ``,
    `The ${kind} is expected to begin on ${first}. Your own expected separation date is [individual separation date].${schedule}`,
    ``,
    `${bumping}`,
    ``,
    `For more information, contact ${contact}.`,
    ``,
    `[Employer signature block]`,
  ].join('\n')

  const union = i.unionName.trim()
    ? [
        `${date}`,
        ``,
        `To: ${i.unionName.trim()}, representing affected employees`,
        `Re: Notice of ${kind} under the Worker Adjustment and Retraining Notification Act`,
        ``,
        `Employment site: ${site}`,
        `Company official to contact: ${contact}`,
        ``,
        `${describeAction(i)}`,
        ``,
        `Expected date of the first separation: ${first}.${schedule || ' Separations will follow on the schedule below.'}`,
        ``,
        `Job titles of positions to be affected, with the names of the workers who currently hold them:`,
        ...positions.map((p) => `- ${p.title}: [names of the ${plural(p.count, 'worker', 'workers')} in this position]`),
        ``,
        `[Employer signature block]`,
      ].join('\n')
    : null

  const unionLine = i.unionName.trim()
    ? `Union representing affected employees: ${i.unionName.trim()}. Chief elected officer: ${i.unionOfficer.trim()}, ${i.unionOfficerAddress.trim()}.`
    : `No union represents the affected employees.`
  const government = [
    `${date}`,
    ``,
    `To: [State dislocated worker unit / rapid response unit] and [chief elected official of the unit of local government]`,
    `Re: Notice of ${kind} under the Worker Adjustment and Retraining Notification Act`,
    ``,
    `Employment site: ${site}`,
    `Company official to contact: ${contact}`,
    ``,
    `${describeAction(i)}`,
    ``,
    `Expected date of the first separation: ${first}.${schedule}`,
    ``,
    `Job titles of positions to be affected, and the number of affected employees in each (${plural(total, 'employee', 'employees')} in all):`,
    titles,
    ``,
    `${bumping}`,
    unionLine,
    ``,
    `[Employer signature block]`,
  ].join('\n')

  return { employee, union, government }
}
