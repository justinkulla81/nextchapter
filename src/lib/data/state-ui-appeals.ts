// First-level appeal deadlines for a denied unemployment claim, one per state.
// Source: U.S. Department of Labor, Comparison of State Unemployment Insurance Laws (2023), Chapter 7, Table 7-2,
// the claimant first-level appeal column. Each value was checked in October 2026 against the state's own published rule or page.
// Where the state differs from DOL, the state is used and `source` points to it; where official pages conflict, the shorter deadline is shown with a note.
// The deadline printed on the claimant's own notice always controls, and the pages say so.

export interface AppealDeadline {
  /** Days to file a first-level appeal. */
  days: number
  /** True when the source says calendar days. False means the source does not say. */
  calendar: boolean
  /** What the days count from, when the source says. */
  from: string
  /** Extra time the source gives, e.g. for mailing. */
  extra: string | null
  source: string
  asOf: string
}

const DOL = 'https://oui.doleta.gov/unemploy/pdf/uilawcompar/2023/appeals.pdf'
const DOL_AS_OF = '2023-01-01'

type Row = [days: number, calendar: boolean, from: string, extra?: string]

const MAILING = 'the date the notice was mailed'
const MAIL_OR_DELIVERY = 'the date the notice was mailed or delivered'

const ROWS: Record<string, Row> = {
  AL: [15, true, MAILING, '7 calendar days if you count from delivery'],
  AK: [30, false, 'the date the notice was mailed or personally delivered', '3 more days if it was mailed'],
  AZ: [15, true, MAILING, '7 calendar days if you count from delivery'],
  AR: [20, true, MAIL_OR_DELIVERY],
  CA: [30, true, 'the mailing date on the notice or personal service'],
  CO: [20, true, 'the date the notice was mailed or personally delivered'],
  CT: [21, true, 'the date the notice was mailed or provided'],
  DE: [10, true, MAILING, 'Delaware’s statute says 15; file within 10 to be safe'],
  DC: [15, true, 'the date the notice was mailed or actually delivered'],
  FL: [20, true, MAIL_OR_DELIVERY],
  GA: [15, true, 'the decision release date'],
  HI: [10, false, MAIL_OR_DELIVERY],
  ID: [14, false, MAIL_OR_DELIVERY],
  IL: [30, true, MAIL_OR_DELIVERY],
  IN: [10, false, MAIL_OR_DELIVERY, '3 more calendar days if it was mailed; one Indiana page says 15, so file within 10 to be safe'],
  IA: [10, true, 'the date of the decision'],
  KS: [16, true, MAIL_OR_DELIVERY],
  KY: [30, false, MAILING],
  LA: [15, false, MAILING, 'Louisiana does not count weekends, holidays or office closures'],
  ME: [15, true, MAILING, 'Maine’s current page may allow 30; file within 15 to be safe'],
  MD: [15, true, 'the date the determination was mailed', 'a statute excerpt mentions 30; file within 15 to be safe'],
  MA: [10, false, MAIL_OR_DELIVERY],
  MI: [30, false, 'the date the notice was mailed, faxed or sent electronically'],
  MN: [45, true, 'the date the determination was sent'],
  MS: [14, false, 'notification or mailing'],
  MO: [30, false, 'the date of notification or mailing'],
  MT: [10, false, MAILING],
  NE: [20, true, 'delivery or mailing'],
  NV: [11, false, 'the date the notice was mailed or personally served'],
  NH: [14, true, MAILING],
  NJ: [21, true, MAILING],
  NM: [15, true, 'the date on the notice'],
  NY: [30, false, 'the date the notice was mailed or personally delivered'],
  NC: [30, false, 'notification or mailing, whichever is earlier'],
  ND: [12, false, 'mailing or service'],
  OH: [21, true, 'the date the determination was mailed'],
  OK: [10, true, MAIL_OR_DELIVERY],
  OR: [20, false, MAIL_OR_DELIVERY],
  PA: [21, false, 'the determination date'],
  RI: [15, true, MAILING],
  SC: [10, true, MAILING],
  SD: [15, false, MAILING],
  TN: [15, true, 'mailing or delivery, whichever comes first'],
  TX: [14, true, MAILING],
  UT: [15, true, 'the date the notice was sent'],
  VT: [30, true, 'the date of the determination'],
  VA: [30, true, 'the mailing date or delivery'],
  WA: [30, false, 'notification or mailing, whichever is earlier'],
  WV: [8, true, MAIL_OR_DELIVERY],
  WI: [14, false, 'mailing or delivery, whichever occurs first'],
  WY: [28, true, MAILING],
}

/** States where the agency's own page differs from or replaces the DOL table. */
const AGENCY: Record<string, { source: string; asOf: string }> = {
  MN: { source: 'https://www.revisor.mn.gov/statutes/cite/268.105', asOf: '2026-10-29' },
  UT: { source: 'https://jobs.utah.gov/appeals/ui/filing.html', asOf: '2026-10-29' },
}

export const APPEAL_DEADLINES: Record<string, AppealDeadline> = Object.fromEntries(
  Object.entries(ROWS).map(([code, [days, calendar, from, extra]]) => [
    code,
    { days, calendar, from, extra: extra ?? null, source: AGENCY[code]?.source ?? DOL, asOf: AGENCY[code]?.asOf ?? DOL_AS_OF } satisfies AppealDeadline,
  ]),
)

/** "15 calendar days" / "30 days". */
export function appealDaysLabel(a: AppealDeadline): string {
  return `${a.days} ${a.calendar ? 'calendar ' : ''}days`
}

/** When the filing steps, ready list and appeal deadlines were added to the state pages. */
export const FILING_GUIDE_UPDATED = '2026-10-29'
