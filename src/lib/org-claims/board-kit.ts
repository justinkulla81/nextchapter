import { KIT_MIN_COUNT } from '@/lib/cohorts/launch-kit'

// A workforce board's launch kit: a few tracked links (one per place the board sends people from), and the words to send with them.
// The links are ReferralLinks labelled `ob:<boardId>:<source>`, the same machinery the layoff-cohort kit uses, so every click and every
// person who registers after following one is counted against the place it came from. This file is the pure part (labels, URLs, copy);
// board-kit-data.ts reads and writes the links.

export const BOARD_KIT_SOURCES = [
  { source: 'email', label: 'Email to your list', note: 'Your newsletter, a mailing to past participants, or a note to employers and partners' },
  { source: 'web', label: 'Your website', note: 'A banner, a button or a line on your own pages' },
  { source: 'social', label: 'Social posts', note: 'LinkedIn, Facebook and the rest' },
  { source: 'print', label: 'Flyer and QR code', note: 'Handed out at job centers, events and sessions' },
] as const
export type BoardKitSource = (typeof BOARD_KIT_SOURCES)[number]['source']

export { KIT_MIN_COUNT }

export function boardKitLabel(boardId: string, source: BoardKitSource): string {
  return `ob:${boardId}:${source}`
}

export function parseBoardKitLabel(label: string): { boardId: string; source: string } | null {
  const m = /^ob:([^:]+):([a-z]+)$/.exec(label)
  return m ? { boardId: m[1], source: m[2] } : null
}

/**
 * A tracked link that lands on the board's own page on NextChapter, which carries the offer in the board's colors. Short on purpose, since it
 * gets pasted into emails and printed: the code in the address already says which place it is for, so no tags ride along.
 */
export function boardKitLink(appUrl: string, code: string, landingPath: string): string {
  return `${appUrl.replace(/\/$/, '')}/api/r/${code}?to=${landingPath}`
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

/** The link for a QR code. A QR holds 213 characters at most, so a landing page too long to fit is dropped and the code alone is used. */
export function boardKitQrLink(appUrl: string, code: string, landingPath: string): string {
  const link = boardKitLink(appUrl, code, landingPath)
  return link.length <= 213 ? link : `${appUrl.replace(/\/$/, '')}/api/r/${code}`
}

export interface BoardKitCopy {
  email: { subject: string; body: string }
  newsletter: string
  social: string
  flyer: { headline: string; lines: string[]; scan: string }
}

/**
 * The words that go with the links. Plain, one idea each, and nothing the product does not do today: a free Market Reality Assessment,
 * the jobs open nearby, and a plan. `area` reads as "the Greater Louisville area".
 */
export function boardKitCopy(input: { boardName: string; area: string; links: Record<BoardKitSource, string> }): BoardKitCopy {
  const { boardName, area, links } = input
  return {
    email: {
      subject: `A free tool for job seekers in ${area}`,
      body: [
        `If you are looking for work, or worried about your job, there is a free tool that shows where you stand in today's job market.`,
        `You upload your resume and get a Market Reality Assessment: an honest read of how your experience matches what employers in ${area} are hiring for, the jobs open near you, and a plan for the weeks ahead.`,
        `It is free for job seekers, and nothing is shared with anyone unless you choose to share it.`,
        links.email,
        `${boardName} shared this link. NextChapter is an independent platform and is not run by ${boardName}.`,
      ].join('\n\n'),
    },
    newsletter: [
      `Free for job seekers: a Market Reality Assessment from NextChapter.`,
      `Upload your resume to see how your experience matches what employers in ${area} are hiring for, the jobs open near you, and a plan for the weeks ahead.`,
      links.web,
    ].join('\n\n'),
    social: [
      `Looking for work in ${area}? This free tool shows how your experience matches what local employers are hiring for, the jobs open near you, and a plan for the weeks ahead.`,
      links.social,
    ].join('\n\n'),
    flyer: {
      headline: 'Looking for work? See where you stand.',
      lines: [
        `A free Market Reality Assessment for job seekers in ${area}.`,
        'Upload your resume. See how your experience matches what employers here are hiring for, the jobs open near you, and a plan for the weeks ahead.',
        'Free. Nothing is shared unless you choose to share it.',
      ],
      scan: 'Scan to start',
    },
  }
}

/** Clicks and joins per place, with the joined count held back under the floor so a small group cannot be read person by person. */
export interface BoardKitStats {
  sources: { source: string; label: string; clicks: number; joined: number | null }[]
  totalJoined: number | null
  totalClicks: number
}

export function summarizeBoardKit(rows: { source: string; clicks: number; joined: number }[]): BoardKitStats {
  const totalJoined = rows.reduce((a, r) => a + r.joined, 0)
  const show = totalJoined >= KIT_MIN_COUNT
  return {
    sources: BOARD_KIT_SOURCES.map(({ source, label }) => {
      const r = rows.find((x) => x.source === source)
      return { source, label, clicks: r?.clicks ?? 0, joined: show ? r?.joined ?? 0 : null }
    }),
    totalJoined: show ? totalJoined : null,
    totalClicks: rows.reduce((a, r) => a + r.clicks, 0),
  }
}

