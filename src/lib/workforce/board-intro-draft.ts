import { ALONGSIDE, CLOSE, SIGN_OFF, greetingFor } from '@/lib/warn/layoff-alert-drafts'

// The first email to a workforce board's director, in the same voice and with the same intro, "sit alongside" paragraph, 15-minute close and
// signature as the layoff alert notes (src/lib/warn/layoff-alert-drafts.ts, which this imports, so the two cannot drift). Unlike an alert note
// it is not about one layoff: it opens on the board's own area, a number the reader can check on the page we link. Pure: the numbers come in.

export interface BoardIntroInput {
  /** The director's full name, for the greeting; "team" when there is none. */
  contactName: string | null
  /** How the email names the board: "EmployIndy", "the Workforce Council". */
  org: string
  /** The board's page on our site. */
  page: string
  /** Where it serves, as it reads in a sentence: "Marion County", "Jefferson County and 6 nearby counties". */
  area: string
  jobs: number
  entryLevel: number
  /** The employers hiring most, in order; the first three are named. */
  topEmployers: string[]
  /** Layoff notices (WARN) nationally in the last 12 months, and the workers they name. */
  nationalNotices: number
  nationalWorkers: number
  /** The same for the board's own area. */
  areaNotices: number
  areaWorkers: number
}

const n = (x: number) => x.toLocaleString('en-US')
const list = (a: string[]) => (a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)
/** 271,304 workers reads "271,000": a round number, never above the real one. */
const roundDown = (x: number) => (x >= 10_000 ? Math.floor(x / 1000) * 1000 : x)

/** A local layoff figure is shown only when there are enough notices for it to mean something; under 3 the email gives the national number alone. */
export const MIN_LOCAL_NOTICES = 3

export function boardIntroDraft(i: BoardIntroInput): { subject: string; body: string } {
  const hello = `Hi ${greetingFor(i.contactName)},`
  const local = i.areaNotices >= MIN_LOCAL_NOTICES ? `, including ${n(i.areaNotices)} notices and ${n(i.areaWorkers)} workers in your area` : ''
  const top = i.topEmployers.slice(0, 3)
  const hiring = top.length >= 2 ? `, and ${list(top)} are hiring the most` : ''
  const body = [
    hello,
    `I'm Justin Kulla, founder of NextChapter, the leading job transition platform built for laid-off professionals. I've spent about 20 years building and investing in education, training and workforce companies.`,
    `White-collar workers, the core of the middle class, are being hit by the economy and by AI, and few services are built for them. In the past year employers filed ${n(i.nationalNotices)} layoff notices nationally, covering ${n(roundDown(i.nationalWorkers))} workers${local}. Meanwhile ${n(i.jobs)} professional jobs are open in ${i.area}, ${n(i.entryLevel)} of them entry-level${hiring}. I put it all on one page for ${i.org}, updated daily, in your colors: ${i.page}`,
    ALONGSIDE,
    CLOSE,
    SIGN_OFF,
  ].join('\n\n')
  return { subject: `${n(i.jobs)} open jobs in ${i.area}`, body }
}
