// One definition for each number the layoff pages print. Pure text, so any page, the data file and the press kit can quote
// the same words. The counts that go with them come from src/lib/warn/layoff-counts.ts.
//
// Why this exists: /layoffs said "2,112 layoffs", /data said "3,200 notices" and the headline worker total (637,659 for
// 2026) included 128 announcements with no U.S. state, among them a foreign government and rows whose employer name was a
// headline fragment. All of those were real database rows counted under different rules and labelled loosely. The rules
// are now written down here, and the pages show them next to the numbers.

export const LAYOFF_TERMS = [
  {
    key: 'filing',
    term: 'Filing',
    definition:
      'One row in a state labor department’s WARN list. A state may file one row per site, so one employer can have several filings on one day. /data counts filings.',
  },
  {
    key: 'layoff',
    term: 'Layoff',
    definition:
      'Every filing by one employer, in one state, with one notice date, counted once. The tracker at /layoffs counts layoffs, so its totals are lower than the number of filings.',
  },
  {
    key: 'reported',
    term: 'Reported layoff',
    definition:
      'A layoff from the press, layoffs.fyi or an announcement that has a U.S. state and no state filing by the same employer within 45 days. It is labelled “reported” wherever it is listed and it is not a WARN notice.',
  },
  {
    key: 'workers',
    term: 'Workers named',
    definition:
      'The number of employees a notice or report gives. Some states leave it out, so the figure is a floor, never a count of everyone laid off.',
  },
  {
    key: 'not-counted',
    term: 'Not counted',
    definition:
      'Announcements with no U.S. state (a company’s global cuts, a foreign government) and rows a person has dismissed. They are not U.S. layoffs, so no total here includes them.',
  },
] as const

/** The sentence a page puts under a headline number so a reader can tell which unit it is. */
export const LAYOFF_UNIT_NOTE =
  'Layoffs here means one employer, one state and one notice date, counted once, from state WARN filings plus reported layoffs with a U.S. state.'
