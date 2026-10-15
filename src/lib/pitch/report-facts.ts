import type { Fact } from './types'

// Figures quoted from the NextChapter White Collar Employment Report, September 2026
// (Version 1.72, revised October 13, 2026). Every value below is copied from
// a named exhibit; nothing is derived here. Update this file, not the slide
// rules, when a new edition changes a number. Keyed by slide id.

export const REPORT_EDITION = 'NextChapter White Collar Employment Report, September 2026 (Version 1.72)'

/** Slide-level citations, one per exhibit used. */
export const SOURCES = {
  midcareer: `${REPORT_EDITION}, Ch. 06 Exhibit 19 and Ch. 14 Exhibit 33. NextChapter calculation from Census CPS microdata, January to August, not seasonally adjusted; margins are 90%.`,
  wioa: `${REPORT_EDITION}, Ch. 13 Exhibit 32. DOL Employment and Training Administration, PY2024 WIOA National Performance Summary (Nov 2025); Federal Register WIOA allotments notice (Apr 2026). Training share is a NextChapter calculation.`,
  aiRules: `${REPORT_EDITION}, Ch. 03, Ch. 08 and Ch. 13; Littler (Oct 2026) as cited in the report.`,
} as const

export const FIXED_FACTS: Record<string, Fact[]> = {
  // Exhibit 19: out 27+ weeks as a share of the labor force, ages 22+, January to August.
  'h-midcareer': [
    { label: 'Bachelor\'s or higher, out 27+ weeks (share of labor force)', value: '0.88%', note: 'Up from 0.57% in 2022, beyond margin of error. NextChapter calc., CPS' },
    { label: 'Master\'s holders, out 27+ weeks', value: '0.83%', note: 'Up 0.26 pts from 2025 (±0.16), beyond margin of error. NextChapter calc., CPS' },
    { label: '25+ years of experience, out 27+ weeks', value: '1.02%', note: 'Up 0.23 pts from 2025 (±0.15), beyond margin of error. NextChapter calc., CPS' },
    { label: 'Recent graduates (22 to 27) unemployment vs 2019', value: '+1.5 pts', note: 'Bachelor\'s or higher; beyond margin of error (±0.7). NextChapter calc., CPS' },
  ],
  // Exhibit 32: the WIOA Dislocated Worker program.
  'w-wioa': [
    { label: 'Dislocated Worker appropriation, fiscal 2026', value: '$1.396B', note: 'Essentially unchanged from 2025. DOL; Federal Register' },
    { label: 'Participants served, program year 2024', value: '187,108', note: 'July 2024 to June 2025. DOL ETA' },
    { label: 'Received training', value: '37,119', note: 'About 20%, or 1 in 5. NextChapter calculation from DOL data' },
    { label: 'White-collar workers out 27+ weeks', value: '~546,000', note: 'Jan to Aug 2026 average; a size comparison only. NextChapter, CPS' },
  ],
}
