// National white-collar snapshot for generic decks and as context on local
// ones. BLS CPS unemployment rate, not seasonally adjusted, 3-month averages.
// REFRESH MONTHLY on jobs-report day: the daily digest keeps the live copy in
// ~/.claude/scheduled-tasks/nextchapter-daily-digest/wc-trend.json.
export const NATIONAL = {
  asOf: 'September 2026',
  whiteCollar: { avg3: 2.77, yearAgo: 2.73, series: 'LNU04032215', label: 'Management, professional and related occupations' },
  blueCollarConstruction: { avg3: 3.87, yearAgo: 3.7, series: 'LNU04032222' },
  blueCollarProduction: { avg3: 4.83, yearAgo: 5.5, series: 'LNU04032226' },
  information: { avg3: 6.5, yearAgo: 5.67, series: 'LNU04032237', label: 'Information industry' },
  overall: { avg3: 4.13, yearAgo: 4.33, series: 'LNS14000000' },
}
