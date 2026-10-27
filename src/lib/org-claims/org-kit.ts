import { KIT_MIN_COUNT } from '@/lib/cohorts/launch-kit'

// An organization's launch kit: a few tracked links (one per place it sends people from), and the words to send with them. Works for the kinds
// of organization that have a public page here: a workforce board, an American Job Center, an economic development organization, a college and
// an employer. The links are ReferralLinks, the same machinery the layoff-cohort kit uses, so every click and every person who registers after
// following one is counted against the place it came from. This file is the pure part (labels, URLs, copy); org-kit-data.ts reads and writes.
//
// Labels: a workforce board keeps `ob:<boardId>:<place>` (the first five kits were made with it); every other kind is
// `ok:<KIND>:<id>:<place>`.

export type KitKind = 'WORKFORCE_BOARD' | 'JOB_CENTER' | 'ECON_DEV' | 'COLLEGE' | 'EMPLOYER'

export const KIT_SOURCES = [
  { source: 'email', label: 'Email to your list', note: 'Your newsletter, a mailing to your own people, or a note to partners' },
  { source: 'web', label: 'Your website', note: 'A banner, a button or a line on your own pages' },
  { source: 'social', label: 'Social posts', note: 'LinkedIn, Facebook and the rest' },
  { source: 'print', label: 'Flyer and QR code', note: 'Handed out at events, sessions and meetings' },
] as const
export type KitSource = (typeof KIT_SOURCES)[number]['source']

export { KIT_MIN_COUNT }

export function kitLabel(kind: KitKind, id: string, source: KitSource): string {
  return kind === 'WORKFORCE_BOARD' ? `ob:${id}:${source}` : `ok:${kind}:${id}:${source}`
}

export function parseKitLabelAny(label: string): { kind: KitKind; id: string; source: string } | null {
  const board = /^ob:([^:]+):([a-z]+)$/.exec(label)
  if (board) return { kind: 'WORKFORCE_BOARD', id: board[1], source: board[2] }
  const m = /^ok:(JOB_CENTER|ECON_DEV|COLLEGE|EMPLOYER|WORKFORCE_BOARD):(.+):([a-z]+)$/.exec(label)
  return m ? { kind: m[1] as KitKind, id: m[2], source: m[3] } : null
}

/** The prefix every label of one organization starts with, to find all of its links. */
export function kitLabelPrefix(kind: KitKind, id: string): string {
  return kind === 'WORKFORCE_BOARD' ? `ob:${id}:` : `ok:${kind}:${id}:`
}

/**
 * A tracked link that lands on the organization's own page on NextChapter, which carries the offer in its colors. Short on purpose, since it
 * gets pasted into emails and printed: the code in the address already says which place it is for, so no tags ride along.
 */
export function kitLink(appUrl: string, code: string, landingPath: string): string {
  return `${appUrl.replace(/\/$/, '')}/api/r/${code}?to=${landingPath}`
}

/** The link for a QR code. A QR holds 213 characters at most, so a landing page too long to fit is dropped and the code alone is used. */
export function kitQrLink(appUrl: string, code: string, landingPath: string): string {
  const link = kitLink(appUrl, code, landingPath)
  return link.length <= 213 ? link : `${appUrl.replace(/\/$/, '')}/api/r/${code}`
}

/** The area as it reads in a sentence: "Jefferson County", "A, B and C", "Jefferson County and 6 nearby counties", "all of Ohio". */
export function areaPhrase(area: { statewide: boolean; counties: { name: string; population?: number | null }[] }, stateName: string): string {
  if (area.statewide) return `all of ${stateName}`
  // The biggest county first, so "Jefferson County and 6 nearby counties" leads with the place people know.
  const names = [...area.counties].sort((a, b) => (b.population ?? -1) - (a.population ?? -1)).map((c) => c.name)
  if (names.length === 0) return `the ${stateName} area`
  if (names.length === 1) return names[0]
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names[0]} and ${names.length - 1} nearby counties`
}

export interface KitCopy {
  email: { subject: string; body: string }
  newsletter: string
  social: string
  flyer: { headline: string; lines: string[]; scan: string }
}

const NOTHING_SHARED = 'It is free, and nothing is shared with anyone unless you choose to share it.'

/**
 * The words that go with the links. Plain, one idea each, and nothing the product does not do today: a free Market Reality Assessment, the
 * jobs open nearby, and a plan. `area` reads as "Jefferson County and 6 nearby counties"; an employer has none.
 */
export function kitCopy(input: { kind: KitKind; name: string; area: string; links: Record<KitSource, string> }): KitCopy {
  const { kind, name, area, links } = input
  const independent = `NextChapter is an independent platform and is not run by ${name}.`
  const assessment = (where: string) => `how your experience matches what employers ${where} are hiring for, the jobs open near you, and a plan for the weeks ahead`

  if (kind === 'EMPLOYER') {
    return {
      email: {
        subject: `Support for people affected by changes at ${name}`,
        body: [
          `If you are affected by the changes at ${name}, there is a free tool that shows where you stand in today's job market.`,
          `You upload your resume and get a Market Reality Assessment: an honest read of ${assessment('are')}.`,
          `It is free, and nothing is shared with ${name} unless you choose to share it.`,
          links.email,
          independent,
        ].join('\n\n'),
      },
      newsletter: [`Free for people affected by changes at ${name}: a Market Reality Assessment from NextChapter.`, `Upload your resume to see ${assessment('are')}.`, links.web].join('\n\n'),
      social: [`If you are affected by changes at ${name}, this free tool shows ${assessment('are')}.`, links.social].join('\n\n'),
      flyer: {
        headline: `Affected by changes at ${name}? See where you stand.`,
        lines: ['A free Market Reality Assessment.', `Upload your resume. See ${assessment('are')}.`, `Free. Nothing is shared with ${name} unless you choose to share it.`],
        scan: 'Scan to start',
      },
    }
  }

  const audience = kind === 'COLLEGE' ? 'students and alumni' : 'job seekers'
  const intro = kind === 'COLLEGE'
    ? `If you are a student or graduate looking for work, or worried about your job, there is a free tool that shows where you stand in today's job market.`
    : `If you are looking for work, or worried about your job, there is a free tool that shows where you stand in today's job market.`
  const where = area ? `in ${area}` : 'nearby'
  return {
    email: {
      subject: kind === 'COLLEGE' ? `A free tool for ${name} students and alumni` : `A free tool for job seekers ${area ? `in ${area}` : 'near you'}`,
      body: [
        intro,
        `You upload your resume and get a Market Reality Assessment: an honest read of ${assessment(where)}.`,
        NOTHING_SHARED,
        links.email,
        `${name} shared this link. ${independent}`,
      ].join('\n\n'),
    },
    newsletter: [`Free for ${audience}: a Market Reality Assessment from NextChapter.`, `Upload your resume to see ${assessment(where)}.`, links.web].join('\n\n'),
    social: [`Looking for work${area ? ` in ${area}` : ''}? This free tool shows ${assessment('here')}.`, links.social].join('\n\n'),
    flyer: {
      headline: 'Looking for work? See where you stand.',
      lines: [
        `A free Market Reality Assessment for ${audience}${area ? ` in ${area}` : ''}.`,
        `Upload your resume. See ${assessment('here')}.`,
        'Free. Nothing is shared unless you choose to share it.',
      ],
      scan: 'Scan to start',
    },
  }
}

/** Clicks and joins per place, with the joined count held back under the floor so a small group cannot be read person by person. */
export interface KitStats {
  sources: { source: string; label: string; clicks: number; joined: number | null }[]
  totalJoined: number | null
  totalClicks: number
}

export function summarizeKit(rows: { source: string; clicks: number; joined: number }[]): KitStats {
  const totalJoined = rows.reduce((a, r) => a + r.joined, 0)
  const show = totalJoined >= KIT_MIN_COUNT
  return {
    sources: KIT_SOURCES.map(({ source, label }) => {
      const r = rows.find((x) => x.source === source)
      return { source, label, clicks: r?.clicks ?? 0, joined: show ? r?.joined ?? 0 : null }
    }),
    totalJoined: show ? totalJoined : null,
    totalClicks: rows.reduce((a, r) => a + r.clicks, 0),
  }
}
